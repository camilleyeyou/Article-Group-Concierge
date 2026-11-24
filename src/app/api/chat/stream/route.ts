/**
 * Article Group AI Concierge - Streaming Chat Route (Phase 5)
 *
 * POST /api/chat/stream (text/event-stream)
 *
 * Same retrieval and orchestration as POST /api/chat, but sends instant teasers
 * after retrieval and hero/components/narrative while the model writes, then an
 * authoritative `final` event. The JSON route is unchanged (D-509).
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrieveContext } from '@/lib/supabase';
import type { HybridSearchResult } from '@/types';
import { getCatalogue, catalogueIsCold, lastCatalogueLoad } from '@/lib/catalogue';
import { createPerfMarks } from '@/lib/perf-marks';
import { orchestrateStream } from '@/lib/orchestrator';
import { decideInstantTeasers } from '@/lib/instant-teasers';
import { classifyError } from '@/lib/chat-errors';
import { validateChatBody, debugEnabled, teasersOnlyEnabled, toPublicOutput, buildDebugPayload } from '@/lib/chat-request';
import { encodeSse, SSE_KEEPALIVE, type StreamEvent } from '@/lib/stream-events';
import { APILogger } from '@/lib/logger';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { analytics } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<Response> {
  const teasersOnlyProbe = process.env.EVAL_DEBUG === 'true';
  const marks = createPerfMarks(teasersOnlyProbe || process.env.PERF_TIMING === 'true');
  const rateLimitResponse = rateLimiter.check(request, RATE_LIMITS.CHAT);
  if (rateLimitResponse) return rateLimitResponse;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Missing or invalid query' }, { status: 400 });
  }
  const parsed = validateChatBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const { body, query } = parsed;
  // Debug gate lives in debugEnabled() only.
  const debug = debugEnabled(body);
  const teasersOnly = teasersOnlyEnabled(body);
  marks.mark('body_parsed');

  const abort = new AbortController();
  request.signal.addEventListener('abort', () => abort.abort());

  const requestTimer = analytics.startTimer('chat_request');
  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => {
        try {
          controller.enqueue(encodeSse(e));
        } catch {
          // client gone
        }
      };
      keepalive = setInterval(() => {
        try {
          controller.enqueue(SSE_KEEPALIVE);
        } catch {
          // client gone
        }
      }, 15000);

      try {
        APILogger.info('Processing streamed query', { query: query.slice(0, 50) + '...' });
        // Teasers need only the chunks (search RPC) and the catalogue. retrieveContext reports the
        // chunks as soon as the search is done, so the event goes out without waiting for the
        // visual-asset, taxonomy and metrics fetches.
        marks.mark('catalogue_cold', catalogueIsCold() ? 1 : 0);
        const cataloguePromise = getCatalogue().then(c => {
          marks.mark('catalogue_ready');
          return c;
        });
        type Decision = ReturnType<typeof decideInstantTeasers>;
        let teasersSent: Promise<Decision> | null = null;
        const emitTeasers = (chunks: HybridSearchResult[]) => {
          if (teasersSent) return;
          teasersSent = cataloguePromise.then(cat => {
            const decision = decideInstantTeasers(query, chunks, cat);
            marks.mark('decided');
            if (decision.suppressed) {
              send({ type: 'suppressed', reason: decision.suppressed });
            } else if (decision.teasers.length === 0) {
              send({ type: 'suppressed', reason: 'no_case_studies' });
            } else {
              send({ type: 'teasers', items: decision.teasers });
            }
            marks.mark('teasers_sent');
            return decision;
          });
          teasersSent.catch(() => {}); // surfaced by the await below; avoid an unhandled rejection if retrieval fails first
        };
        const [context, catalogue] = await Promise.all([
          retrieveContext({
            query,
            capabilitySlugs: body.filters?.capabilities,
            industrySlugs: body.filters?.industries,
            maxChunks: 10,
            maxAssets: 5,
            skipCache: debug,
            onChunks: emitTeasers,
            marks,
          }),
          cataloguePromise,
        ]);
        if (!teasersSent) emitTeasers(context.chunks);
        const decision: Decision = await teasersSent!;

        if (teasersOnly) {
          // Timing probe (EVAL_DEBUG only): report marks and stop before any generation spend.
          for (const [k, v] of Object.entries(lastCatalogueLoad)) if (v != null) marks.mark(`cat_${k}`, v);
          send({
            type: 'timing',
            marks: marks.snapshot(),
            chunkKeys: context.chunks.map(c => `${c.document_id}:${c.chunk_id}`),
            teaserSlugs: decision.teasers.map(t => t.slug),
            suppressed: decision.suppressed ?? null,
          });
          return;
        }
        if (process.env.PERF_TIMING === 'true') APILogger.info('teaser marks', marks.snapshot());

        for await (const ev of orchestrateStream(
          {
            userQuery: query,
            context,
            conversationHistory: body.conversationHistory,
            skipCache: debug,
          },
          { signal: abort.signal, catalogue },
        )) {
          if (ev.type === 'final') {
            const count = ev.output.layoutPlan.layout.length;
            send({ type: 'final', output: toPublicOutput(ev.output) });
            requestTimer({ success: true, components: count });
            analytics.trackQuery({
              query,
              componentsGenerated: count,
              cacheHit: ev.cached,
              error: false,
            });
            ev.output.layoutPlan.layout.forEach(item => analytics.trackComponentUsage(item.component));
            if (debug) {
              send({
                type: 'debug',
                debug: await buildDebugPayload(ev.output, context, {
                  instant: {
                    slugs: decision.teasers.map(t => t.slug),
                    suppressed: decision.suppressed,
                    maxSemantic: decision.maxSemantic,
                  },
                }),
              });
            }
          } else {
            send(ev);
          }
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          APILogger.error('Chat stream error', error);
          requestTimer({ success: false, error: true });
          analytics.trackQuery({ query: 'unknown', error: true });
          const c = classifyError(error);
          send({
            type: 'error',
            explanation: c.explanation,
            errorCode: c.errorCode,
            retryable: c.retryable,
            contactCTA: c.contactCTA,
          });
        }
      } finally {
        if (keepalive) clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abort.abort();
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
