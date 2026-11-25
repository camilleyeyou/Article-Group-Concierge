/**
 * Consumes the /api/chat/stream SSE response (the same one production uses) and records
 * when each kind of event arrived (D-510). Pure: the clock is injectable for tests.
 */

import { SseDecoder, type PublicOrchestratorOutput, type StreamEvent, type SuppressReason } from '../src/lib/stream-events';
import type { ProdPerfFlags } from './prod-timing-types';

export interface StreamCapture {
  t_teasers_ms: number | null;
  t_suppressed_ms: number | null;
  t_hero_first_ms: number | null;
  t_hero_done_ms: number | null;
  t_complete_ms: number | null;
  instant_teaser_slugs: string[] | null;
  suppressed_reason: SuppressReason | null;
  final: PublicOrchestratorOutput | null;
  debug: Record<string, unknown> | null;
  error: { errorCode: string; explanation: string; retryable: boolean } | null;
  events: number;
  perf: ProdPerfFlags | null;
}

export async function consumeChatStream(
  res: Response,
  t0: number,
  now: () => number = () => performance.now(),
  opts: { stopAfterHeroDone?: boolean } = {},
): Promise<StreamCapture> {
  const cap: StreamCapture = {
    t_teasers_ms: null,
    t_suppressed_ms: null,
    t_hero_first_ms: null,
    t_hero_done_ms: null,
    t_complete_ms: null,
    instant_teaser_slugs: null,
    suppressed_reason: null,
    final: null,
    debug: null,
    error: null,
    events: 0,
    perf: null,
  };
  const decoder = new SseDecoder();
  const td = new TextDecoder();

  // PERF_TIMING comments (': perf {...}' / ': perf-final {...}') are ignored by SseDecoder; read them from a line buffer.
  let lineBuf = '';
  const readPerfLine = (line: string) => {
    const m = /^: (perf|perf-final) (.*)$/.exec(line.replace(/\r$/, ''));
    if (!m) return;
    try {
      const data = JSON.parse(m[2]) as Record<string, unknown>;
      if (!data || typeof data !== 'object') return;
      const perf: ProdPerfFlags = cap.perf ?? {
        rag_cache_hit: null,
        embed_cache_hit: null,
        orch_cached: null,
        instance_req: null,
        instance_age_s: null,
      };
      const flag = (v: unknown): 0 | 1 | null => (v === 0 || v === 1 ? v : null);
      const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      if (m[1] === 'perf') {
        perf.rag_cache_hit = flag(data.rag_cache_hit);
        perf.embed_cache_hit = flag(data.embed_cache_hit);
        perf.instance_req = num(data.instance_req);
        perf.instance_age_s = num(data.instance_age_s);
      } else {
        perf.orch_cached = typeof data.orch_cached === 'boolean' ? data.orch_cached : null;
      }
      cap.perf = perf;
    } catch {
      // malformed comment: ignored
    }
  };
  const feedPerf = (text: string) => {
    lineBuf += text;
    const lines = lineBuf.split('\n');
    lineBuf = lines.pop() ?? '';
    for (const l of lines) readPerfLine(l);
  };

  const handle = (ev: StreamEvent, t: number) => {
    cap.events += 1;
    switch (ev.type) {
      case 'teasers':
        if (cap.t_teasers_ms === null) {
          cap.t_teasers_ms = t;
          cap.instant_teaser_slugs = ev.items.map(i => i.slug);
        }
        break;
      case 'suppressed':
        if (cap.t_suppressed_ms === null) {
          cap.t_suppressed_ms = t;
          cap.suppressed_reason = ev.reason;
        }
        break;
      case 'hero':
        if (cap.t_hero_first_ms === null) cap.t_hero_first_ms = t;
        break;
      case 'hero_done':
        if (cap.t_hero_first_ms === null) cap.t_hero_first_ms = t;
        if (cap.t_hero_done_ms === null) cap.t_hero_done_ms = t;
        break;
      case 'final':
        cap.t_complete_ms = t;
        cap.final = ev.output;
        break;
      case 'debug':
        cap.debug = ev.debug;
        break;
      case 'error':
        cap.error = { errorCode: ev.errorCode, explanation: ev.explanation, retryable: ev.retryable };
        break;
      default:
        break;
    }
  };

  let stoppedEarly = false;
  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const t = now() - t0;
      const text = td.decode(value, { stream: true });
      feedPerf(text);
      for (const ev of decoder.push(text)) handle(ev, t);
      if (opts.stopAfterHeroDone && cap.t_hero_done_ms !== null && !cap.final) {
        // Timing runs: close the connection once the hero is done to save generation spend.
        stoppedEarly = true;
        await reader.cancel().catch(() => {});
        break;
      }
    }
  }
  const tEnd = now() - t0;
  readPerfLine(lineBuf);
  for (const ev of decoder.flush()) handle(ev, tEnd);

  if (!cap.final && !cap.error && !stoppedEarly) {
    cap.error = { errorCode: 'stream_incomplete', explanation: 'Stream ended without a final or error event', retryable: true };
  }
  return cap;
}
