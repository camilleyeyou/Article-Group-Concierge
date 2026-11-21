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
 *
 * Env: EVAL_BASE_URL (default http://localhost:3000), EVAL_DELAY_MS (default 4000)
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
import type { OrchestratorOutput } from '../src/types';

const BASE_URL = (process.env.EVAL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
// The chat route allows 20 requests/minute; 4s keeps us well under it
const DELAY_MS = Number(process.env.EVAL_DELAY_MS || 4000);
const REQUEST_TIMEOUT_MS = 120_000;
const RATE_LIMIT_WAIT_MS = 60_000;

type DebugResponse = OrchestratorOutput & {
  error?: string;
  debug?: {
    rawResponse: string | null;
    orchestratorError: string | null;
    retrieval: RetrievalSnapshot;
    models?: RunModels;
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

    record.raw_response = debug.rawResponse;
    record.orchestrator_error = debug.orchestratorError;
    record.retrieval = debug.retrieval;
    models = debug.models ?? null;

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

export async function runEval(opts: { persona?: string; limit?: number } = {}): Promise<string> {
  const { queries } = readJson<QueriesFile>(QUERIES_PATH);

  let selected = opts.persona ? queries.filter(q => q.persona_id === opts.persona) : queries;
  if (opts.limit) selected = selected.slice(0, opts.limit);
  if (selected.length === 0) throw new Error('No queries selected');

  await runPreflight({
    supabase: true,
    openrouter: true,
    devServer: BASE_URL,
    minCreditUsd: Number(process.env.EVAL_MIN_CREDIT_USD || 4),
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
        ? `ok ${record.latency_ms}ms, ${chunks} chunks, ${record.response?.layoutPlan.layout.length ?? 0} components`
        : `ERROR ${record.error}`,
    );

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
  runEval({ persona: argValue('--persona'), limit: limit ? Number(limit) : undefined }).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(error instanceof PreflightError ? 2 : 1);
  });
}
