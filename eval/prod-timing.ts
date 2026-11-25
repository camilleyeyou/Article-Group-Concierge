import { argValue, hasFlag, loadQueriesFile, selectQueries, writeJson, type EvalQuery, QUERY_TYPES } from './lib';
import fs from 'node:fs';
import path from 'node:path';
import { consumeChatStream } from './stream-client';
import { summarizeTiming, timingGates } from './metrics';
import type { ProdPerfFlags, ProdTimingFile, ProdTimingRecord } from './prod-timing-types';

/**
 * US-vantage production timing client (D-605, D-606, D-606a).
 *
 *   npx tsx eval/prod-timing.ts --make-batches [--seed 6] [--force]
 *   npx tsx eval/prod-timing.ts --batch <1|2|3> | --dry [--expect-commit <sha>] [--out <file>]
 *        [--no-abort-after-hero] [--allow-non-us] [--allow-local]
 *
 * Cache reasoning: the RAG cache TTL (1 h) is longer than the orchestrator TTL (30 min), and every
 * orchestrator generation follows a retrieval that sets the RAG cache on the same instance, so
 * rag_cache_hit = 0 implies an orchestrator miss on that instance even when the request is aborted
 * before `final`. Batches are disjoint (D-606a) so no batch can hit another batch's cache.
 */

const DEFAULT_BASE_URL = 'https://article-group-concierge.vercel.app';
const WARMUP_QUERY = 'What kind of work does Article Group do?';
const BATCHES_PATH = path.join(__dirname, 'timing-batches.json');
const DELAY_MS = 4000;

export interface TimingBatches {
  created_at: string;
  seed: number;
  batches: Array<{ batch: number; ids: string[] }>;
  dry_ids: string[];
}

export type Quota = Record<(typeof QUERY_TYPES)[number], number>;

/** Plan target: 20 per batch (10/4/2/2/2). Used when the pool is large enough. */
export const PLAN_QUOTA: Quota = { well_formed: 10, vague: 4, off_topic: 2, invention_bait: 2, multi_part: 2 };

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Largest per-type quota (capped at PLAN_QUOTA) that three disjoint batches can fill from this pool. */
export function defaultQuota(queries: Pick<EvalQuery, 'type'>[], nBatches = 3): Quota {
  const q = { ...PLAN_QUOTA };
  for (const t of QUERY_TYPES) {
    const have = queries.filter(x => x.type === t).length;
    q[t] = Math.min(PLAN_QUOTA[t], Math.floor(have / nBatches));
  }
  return q;
}

/**
 * Three disjoint, type-stratified batches plus 2 dry-run ids in no batch. Seeded, so the same seed
 * gives the same batches. Timing records latency only (aborted after hero), so the full 75 are used.
 */
export function makeBatches(
  queries: EvalQuery[],
  seed: number,
  quota: Quota = PLAN_QUOTA,
  nBatches = 3,
  dryCount = 2,
): TimingBatches {
  const rnd = mulberry32(seed);
  const batches: Array<{ batch: number; ids: string[] }> = Array.from({ length: nBatches }, (_, i) => ({ batch: i + 1, ids: [] }));
  const leftovers: string[] = [];
  for (const t of QUERY_TYPES) {
    const pool = shuffle(queries.filter(q => q.type === t).map(q => q.id), rnd);
    const need = quota[t] * nBatches;
    if (pool.length < need) throw new Error(`Not enough ${t} queries: need ${need}, have ${pool.length}`);
    for (let b = 0; b < nBatches; b++) batches[b].ids.push(...pool.slice(b * quota[t], (b + 1) * quota[t]));
    leftovers.push(...pool.slice(need));
  }
  if (leftovers.length < dryCount) throw new Error(`Need ${dryCount} spare queries for the dry run, have ${leftovers.length}`);
  for (const b of batches) b.ids = shuffle(b.ids, rnd);
  const dry_ids = shuffle(leftovers, rnd).slice(0, dryCount);
  return { created_at: new Date().toISOString(), seed, batches, dry_ids };
}

export function buildRecord(args: {
  id: string;
  type: string;
  warmup: boolean;
  startedAt: string;
  httpStatus: number | null;
  cap: {
    t_teasers_ms: number | null;
    t_suppressed_ms: number | null;
    t_hero_first_ms: number | null;
    t_hero_done_ms: number | null;
    t_complete_ms: number | null;
    perf: ProdPerfFlags | null;
    error: { errorCode: string } | null;
  } | null;
  abortedAfterHero: boolean;
  error?: string | null;
}): ProdTimingRecord {
  const c = args.cap;
  const aborted = args.abortedAfterHero && !!c && c.t_hero_done_ms !== null && c.t_complete_ms === null;
  return {
    id: args.id,
    type: args.type,
    warmup: args.warmup,
    t_teasers_ms: c?.t_teasers_ms ?? null,
    t_suppressed_ms: c?.t_suppressed_ms ?? null,
    t_hero_first_ms: c?.t_hero_first_ms ?? null,
    t_hero_done_ms: c?.t_hero_done_ms ?? null,
    t_complete_ms: c?.t_complete_ms ?? null,
    aborted_after_hero: aborted,
    http_status: args.httpStatus,
    perf: c?.perf ?? null,
    error: args.error ?? c?.error?.errorCode ?? null,
    started_at: args.startedAt,
  };
}

/** D-605: timing only counts from a US machine. Unknown location also refuses. */
export function vantageRefusal(country: string | null | undefined, allowNonUs: boolean): string | null {
  if (allowNonUs) return null;
  if (!country) return 'runner location unknown; D-605 needs a US machine (override with --allow-non-us for diagnostics)';
  if (country !== 'US') return `runner country is ${country}, not US; D-605 needs a US machine (override with --allow-non-us for diagnostics)`;
  return null;
}

export function baseUrlRefusal(baseUrl: string, allowLocal: boolean): string | null {
  if (allowLocal) return null;
  let host = '';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return `EVAL_BASE_URL is not a valid URL: ${baseUrl}`;
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.local')) {
    return 'EVAL_BASE_URL is local; timing proof must run against production (override with --allow-local for diagnostics)';
  }
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function fail(msg: string, code: number): never {
  console.error(msg);
  process.exit(code);
}

function makeBatchesCli() {
  const seed = Number(argValue('--seed') ?? 6);
  if (fs.existsSync(BATCHES_PATH) && !hasFlag('--force')) {
    fail(`${BATCHES_PATH} already exists; pass --force to overwrite.`, 2);
  }
  // Timing records latency only (no grading, no tuning), so all 75 queries are eligible (D-606a).
  const queries = selectQueries(loadQueriesFile().queries, { includeHeldOut: true });
  const out = makeBatches(queries, seed);
  writeJson(BATCHES_PATH, out);
  console.log(`Wrote ${BATCHES_PATH}: ${out.batches.map(b => `batch ${b.batch} = ${b.ids.length}`).join(', ')}, dry = ${out.dry_ids.length}`);
}

async function postStream(baseUrl: string, query: string, stopAfterHero: boolean) {
  const t0 = performance.now();
  const startedAt = new Date().toISOString();
  // Request body is { query } only; never a debug flag.
  const res = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (res.status === 429) return { status: 429, startedAt, cap: null };
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    return { status: res.status, startedAt, cap: null };
  }
  const cap = await consumeChatStream(res, t0, undefined, { stopAfterHeroDone: stopAfterHero });
  return { status: res.status, startedAt, cap };
}

async function timedRequest(baseUrl: string, id: string, type: string, query: string, warmup: boolean, stopAfterHero: boolean) {
  let r = await postStream(baseUrl, query, stopAfterHero);
  if (r.status === 429) {
    console.log('  429 rate limited; waiting 60 s and retrying once');
    await sleep(60000);
    r = await postStream(baseUrl, query, stopAfterHero);
  }
  return buildRecord({
    id,
    type,
    warmup,
    startedAt: r.startedAt,
    httpStatus: r.status,
    cap: r.cap,
    abortedAfterHero: stopAfterHero,
    error: r.cap ? undefined : `http_${r.status}`,
  });
}

async function runCli() {
  if (hasFlag('--help')) {
    console.log(`Usage:
  npx tsx eval/prod-timing.ts --make-batches [--seed 6] [--force]
  npx tsx eval/prod-timing.ts --batch <1|2|3> | --dry [--expect-commit <sha>] [--out <file>] [--no-abort-after-hero] [--allow-non-us] [--allow-local]
Env: EVAL_BASE_URL (default ${DEFAULT_BASE_URL}). Writes a ProdTimingFile (eval/prod-timing-types.ts).`);
    return;
  }
  if (hasFlag('--make-batches')) return makeBatchesCli();

  const dry = hasFlag('--dry');
  const batchArg = argValue('--batch');
  const batchNo = dry ? 0 : Number(batchArg);
  if (!dry && ![1, 2, 3].includes(batchNo)) fail('Pass --batch <1|2|3> or --dry.', 2);

  // Step 0: no network before the batch file is known to exist.
  if (!fs.existsSync(BATCHES_PATH)) fail('eval/timing-batches.json not found. Run --make-batches first (plan 06-09).', 2);
  const batches = JSON.parse(fs.readFileSync(BATCHES_PATH, 'utf-8')) as TimingBatches;
  const ids = dry ? batches.dry_ids : batches.batches.find(b => b.batch === batchNo)?.ids;
  if (!ids) fail(`Batch ${batchNo} not in timing-batches.json`, 2);

  const baseUrl = (process.env.EVAL_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const urlRefusal = baseUrlRefusal(baseUrl, hasFlag('--allow-local'));
  if (urlRefusal) fail(urlRefusal, 2);

  let runner: ProdTimingFile['runner'] = { country: null, region: null, city: null, org: null, github_run_id: process.env.GITHUB_RUN_ID ?? null };
  try {
    const r = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(10000) });
    const j = (await r.json()) as { country?: string; region?: string; city?: string; org?: string };
    runner = { ...runner, country: j.country ?? null, region: j.region ?? null, city: j.city ?? null, org: j.org ?? null };
  } catch (e) {
    console.error(`Location lookup failed: ${e instanceof Error ? e.message : e}`);
  }
  console.log(`Runner: ${runner.city ?? '?'}, ${runner.region ?? '?'}, ${runner.country ?? '?'} (${runner.org ?? '?'})`);
  const vantage = vantageRefusal(runner.country, hasFlag('--allow-non-us'));
  if (vantage) fail(vantage, 2);

  const byId = new Map(selectQueries(loadQueriesFile().queries, { includeHeldOut: true }).map(q => [q.id, q]));
  const queries = ids!.map(id => {
    const q = byId.get(id);
    if (!q) fail(`Query ${id} is not in queries.json.`, 2);
    return q;
  });

  const total = queries.length + 2;
  console.log(`${total} requests (2 warm-up + ${queries.length}), ~$${(total * 0.03).toFixed(2)} on the production OpenRouter key`);

  const stopAfterHero = !hasFlag('--no-abort-after-hero');
  const file: ProdTimingFile = {
    batch: batchNo,
    base_url: baseUrl,
    git_commit_expected: argValue('--expect-commit') ?? null,
    runner,
    started_at: new Date().toISOString(),
    finished_at: null,
    ids: ids!,
    records: [],
  };
  const jobs: Array<{ id: string; type: string; text: string; warmup: boolean }> = [
    { id: 'warmup-1', type: 'warmup', text: WARMUP_QUERY, warmup: true },
    { id: 'warmup-2', type: 'warmup', text: WARMUP_QUERY, warmup: true },
    ...queries.map(q => ({ id: q.id, type: q.type, text: q.text, warmup: false })),
  ];
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    try {
      const rec = await timedRequest(baseUrl, j.id, j.type, j.text, j.warmup, stopAfterHero);
      file.records.push(rec);
      console.log(`${j.warmup ? 'warm-up' : j.id}: teasers ${rec.t_teasers_ms?.toFixed(0) ?? '-'} ms, hero ${rec.t_hero_first_ms?.toFixed(0) ?? '-'} ms${rec.error ? `, error ${rec.error}` : ''}`);
    } catch (e) {
      file.records.push(buildRecord({ id: j.id, type: j.type, warmup: j.warmup, startedAt: new Date().toISOString(), httpStatus: null, cap: null, abortedAfterHero: false, error: e instanceof Error ? e.message : String(e) }));
      console.error(`${j.id}: network error ${e instanceof Error ? e.message : e}`);
    }
    if (i < jobs.length - 1) await sleep(DELAY_MS);
  }
  file.finished_at = new Date().toISOString();

  const outPath = argValue('--out') ?? path.join(__dirname, 'results', 'prod-timing', `batch${batchNo}-${file.started_at.replace(/[:.]/g, '-')}.json`);
  writeJson(outPath, file);
  console.log(`Wrote ${outPath}`);

  const summary = summarizeTiming(file);
  console.log(JSON.stringify(summary, null, 2));
  for (const g of timingGates(summary)) console.log(`${g.pass === null ? 'n/a ' : g.pass ? 'PASS' : 'FAIL'}  ${g.gate}  value=${g.value}  limit ${g.limit}`);
  // Exit 0 even on gate failure (the proof report decides); 1 only when no request got through.
  if (file.records.every(r => r.error)) process.exit(1);
}

if (require.main === module) {
  runCli().catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
