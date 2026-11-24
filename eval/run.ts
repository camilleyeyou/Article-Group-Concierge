/**
 * Eval step 2: run every query against the chat API.
 *
 * Posts each query to /api/chat with debug: true, which (when the dev server
 * runs with EVAL_DEBUG=true) bypasses caches and returns the raw model output
 * and retrieved context. Writes eval/results/<timestamp>/responses.json after
 * every query, so a crash keeps partial results.
 *
 * Usage:
 *   npm run eval:run
 *   npm run eval:run -- --persona p5      # one persona
 *   npm run eval:run -- --limit 3         # smoke test
 *   npm run eval:run -- --subset phase4-smoke   # or --ids p1-q01,p2-q01
 *
 * Env: EVAL_BASE_URL (default http://localhost:3000), EVAL_DELAY_MS (default 4000),
 *      EVAL_ROUTE=stream|json (default stream: /api/chat/stream; json: legacy /api/chat)
 */

import * as path from 'path';
import { execSync } from 'child_process';
import {
  argValue,
  QUERIES_PATH,
  readJson,
  RESULTS_DIR,
  sleep,
  timestamp,
  writeJson,
  type EvalQuery,
  type QueriesFile,
  type RetrievalSnapshot,
  type RunFile,
  type RunModels,
  type RunRecord,
} from './lib';
import { runPreflight, PreflightError } from './preflight';
import { consumeChatStream, type StreamCapture } from './stream-client';
import { resolveIds } from './subsets';
import type { GenerationUsage, OrchestratorOutput } from '../src/types';

const BASE_URL = (process.env.EVAL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
// The chat route allows 20 requests/minute; 4s keeps us well under it
const DELAY_MS = Number(process.env.EVAL_DELAY_MS || 4000);
const REQUEST_TIMEOUT_MS = 120_000;
const RATE_LIMIT_WAIT_MS = 60_000;
// 'stream' (default) exercises /api/chat/stream like production; EVAL_ROUTE=json keeps the old /api/chat path
const ROUTE = (process.env.EVAL_ROUTE || 'stream') as 'stream' | 'json';

type DebugResponse = OrchestratorOutput & {
  error?: string;
  debug?: {
    rawResponse: string | null;
    modelRawResponse?: string | null;
    orchestratorError: string | null;
    retrieval: RetrievalSnapshot;
    models?: RunModels;
    usage?: GenerationUsage | null;
    catalogue?: { version: string; text: string } | null;
  };
};

class DebugDisabledError extends Error {
  constructor() {
    super('The chat API did not return debug data. Add EVAL_DEBUG=true to .env.local and restart `npm run dev`.');
  }
}

function gitCommit(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

async function postQuery(query: string): Promise<{ status: number; body: DebugResponse | null; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, debug: true }),
      signal: controller.signal,
    });
    const text = await res.text();
    let body: DebugResponse | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      // Non-JSON body (e.g. a Next.js error page) - kept as text for the error message
    }
    return { status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

type StreamPost =
  | { kind: 'stream'; status: number; capture: StreamCapture; elapsedMs: number }
  | { kind: 'json'; status: number; body: DebugResponse | null; text: string };

async function postStream(query: string): Promise<StreamPost> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, debug: true }),
      signal: controller.signal,
    });
    if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      const text = await res.text();
      let body: DebugResponse | null = null;
      try {
        body = JSON.parse(text);
      } catch {
        // kept as text for the error message
      }
      return { kind: 'json', status: res.status, body, text };
    }
    const capture = await consumeChatStream(res, t0);
    return { kind: 'stream', status: res.status, capture, elapsedMs: performance.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

function applyDebug(record: RunRecord, debug: NonNullable<DebugResponse['debug']>): RunModels | null {
  record.raw_response = debug.rawResponse;
  record.model_raw_response = debug.modelRawResponse ?? null;
  record.orchestrator_error = debug.orchestratorError;
  record.retrieval = debug.retrieval;
  record.catalogue = debug.catalogue?.text ?? null;
  record.catalogue_version = debug.catalogue?.version ?? null;
  record.usage = debug.usage ?? null;
  record.search_function = debug.retrieval?.searchFunction ?? null;
  return debug.models ?? null;
}

async function runQueryStream(q: EvalQuery, record: RunRecord): Promise<RunModels | null> {
  let models: RunModels | null = null;
  const started = Date.now();
  record.route = 'stream';
  try {
    let result = await postStream(q.text);
    if (result.status === 429) {
      console.warn(`  rate limited - waiting ${RATE_LIMIT_WAIT_MS / 1000}s and retrying once`);
      await sleep(RATE_LIMIT_WAIT_MS);
      result = await postStream(q.text);
    }
    record.http_status = result.status;

    if (result.kind === 'json') {
      record.latency_ms = Date.now() - started;
      if (!result.body) {
        record.error = `Non-JSON response (HTTP ${result.status}): ${result.text.slice(0, 200)}`;
      } else {
        record.error = `HTTP ${result.status}: ${result.body.errorCode ?? result.body.error ?? 'unknown error'}`;
      }
      return models;
    }

    const capture = result.capture;
    record.latency_ms = capture.t_complete_ms ?? Math.round(result.elapsedMs);
    record.t_teasers_ms = capture.t_teasers_ms;
    record.t_suppressed_ms = capture.t_suppressed_ms;
    record.t_hero_first_ms = capture.t_hero_first_ms;
    record.t_hero_done_ms = capture.t_hero_done_ms;
    record.t_complete_ms = capture.t_complete_ms;
    record.instant_teaser_slugs = capture.instant_teaser_slugs;
    record.suppressed = capture.suppressed_reason;
    record.response = (capture.final as unknown as OrchestratorOutput | null) ?? null;

    if (capture.error) {
      record.error = `Stream error: ${capture.error.errorCode}: ${capture.error.explanation}`;
      return models;
    }
    if (!capture.debug) throw new DebugDisabledError();
    models = applyDebug(record, capture.debug as unknown as NonNullable<DebugResponse['debug']>);
    if (record.orchestrator_error) {
      record.error = `Orchestrator error: ${record.orchestrator_error}`;
      return models;
    }
    record.status = 'ok';
  } catch (error) {
    if (error instanceof DebugDisabledError) throw error;
    record.latency_ms = Date.now() - started;
    record.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  return models;
}

async function runQuery(q: EvalQuery): Promise<{ record: RunRecord; models: RunModels | null }> {
  let models: RunModels | null = null;
  const record: RunRecord = {
    id: q.id,
    persona_id: q.persona_id,
    type: q.type,
    query: q.text,
    expected: q.expected,
    status: 'error',
    http_status: null,
    latency_ms: null,
    error: null,
    response: null,
    raw_response: null,
    orchestrator_error: null,
    retrieval: null,
  };

  if (ROUTE === 'stream') {
    models = await runQueryStream(q, record);
    return { record, models };
  }
  record.route = 'json';

  const started = Date.now();
  try {
    let result = await postQuery(q.text);
    if (result.status === 429) {
      console.warn(`  rate limited - waiting ${RATE_LIMIT_WAIT_MS / 1000}s and retrying once`);
      await sleep(RATE_LIMIT_WAIT_MS);
      result = await postQuery(q.text);
    }
    record.latency_ms = Date.now() - started;
    record.http_status = result.status;

    const body = result.body;
    if (!body) {
      record.error = `Non-JSON response (HTTP ${result.status}): ${result.text.slice(0, 200)}`;
      return { record, models };
    }

    const { debug, ...publicResponse } = body;
    record.response = publicResponse;

    if (result.status !== 200) {
      record.error = `HTTP ${result.status}: ${body.errorCode ?? body.error ?? 'unknown error'}`;
      return { record, models };
    }
    if (!debug) throw new DebugDisabledError();

    models = applyDebug(record, debug);

    // The orchestrator swallows model errors and returns a polite fallback with HTTP 200
    if (debug.orchestratorError) {
      record.error = `Orchestrator error: ${debug.orchestratorError}`;
      return { record, models };
    }
    record.status = 'ok';
  } catch (error) {
    if (error instanceof DebugDisabledError) throw error;
    record.latency_ms = Date.now() - started;
    record.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  return { record, models };
}

export async function runEval(opts: { persona?: string; limit?: number; ids?: readonly string[] } = {}): Promise<string> {
  const { queries } = readJson<QueriesFile>(QUERIES_PATH);

  let selected = queries;
  if (opts.ids) {
    const known = new Set(queries.map(q => q.id));
    const unknown = opts.ids.filter(id => !known.has(id));
    if (unknown.length) throw new Error(`Unknown query ids: ${unknown.join(', ')}`);
    const idSet = new Set(opts.ids);
    selected = selected.filter(q => idSet.has(q.id));
  }
  if (opts.persona) selected = selected.filter(q => q.persona_id === opts.persona);
  if (opts.limit) selected = selected.slice(0, opts.limit);
  if (selected.length === 0) throw new Error('No queries selected');

  await runPreflight({
    supabase: true,
    openrouter: true,
    devServer: BASE_URL,
    minCreditUsd: Number(process.env.EVAL_MIN_CREDIT_USD || (opts.ids ? Math.max(1, 0.1 * opts.ids.length) : 4)),
  });

  const outDir = path.join(RESULTS_DIR, timestamp());
  const outFile = path.join(outDir, 'responses.json');
  const run: RunFile = {
    started_at: new Date().toISOString(),
    finished_at: null,
    base_url: BASE_URL,
    git_commit: gitCommit(),
    query_count: selected.length,
    models: null,
    records: [],
  };

  console.log(`Running ${selected.length} queries against ${BASE_URL} -> ${path.relative(process.cwd(), outDir)}`);

  let modelsCaptured = false;
  for (const [i, q] of selected.entries()) {
    process.stdout.write(`[${i + 1}/${selected.length}] ${q.id} (${q.type}) `);
    const { record, models } = await runQuery(q);
    run.records.push(record);

    if (record.status === 'ok' && !modelsCaptured) {
      modelsCaptured = true;
      run.models = models;
      if (models) {
        console.log(`\nRoute: ${models.route}, generation: ${models.generation}, embedding: ${models.embedding}`);
      } else {
        console.warn('\nWarning: server did not report models (old server build?)');
      }
    }
    writeJson(outFile, run);

    const chunks = record.retrieval?.chunks.length ?? 0;
    console.log(
      record.status === 'ok'
        ? `ok ${record.latency_ms}ms, ${chunks} chunks, ${record.response?.layoutPlan.layout.length ?? 0} components` +
          (record.route === 'stream'
            ? `, teasers ${record.t_teasers_ms != null ? `${Math.round(record.t_teasers_ms)}ms` : `suppressed:${record.suppressed ?? 'none'}`}, hero ${record.t_hero_first_ms != null ? `${Math.round(record.t_hero_first_ms)}ms` : 'n/a'}`
            : '')
        : `ERROR ${record.error}`,
    );
    if (record.status === 'ok') {
      if (i === 0) console.log(`  search: ${record.search_function ?? 'unknown'}`);
      if (record.search_function !== 'hybrid_search_v2') {
        console.warn(`  Warning: ${record.id} used search function ${record.search_function ?? 'unknown'}, not hybrid_search_v2`);
      }
    }

    if (i < selected.length - 1) await sleep(DELAY_MS);
  }

  run.finished_at = new Date().toISOString();
  writeJson(outFile, run);

  const failed = run.records.filter(r => r.status === 'error').length;
  console.log(`Done: ${run.records.length - failed} ok, ${failed} errors. Results: ${outFile}`);
  return outDir;
}

if (require.main === module) {
  const limit = argValue('--limit');
  runEval({
    persona: argValue('--persona'),
    limit: limit ? Number(limit) : undefined,
    ids: resolveIds({ ids: argValue('--ids'), subset: argValue('--subset') }),
  }).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(error instanceof PreflightError ? 2 : 1);
  });
}
