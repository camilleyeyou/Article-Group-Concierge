import './lib';
/**
 * Thinking-mode timing comparison (paid, cents). In-process: one retrieval per query, then the real
 * orchestrateStream under each generation mode, recording when the model starts and when the hero
 * and full layout are ready.
 *
 *   npx tsx eval/stream-timing.ts --ids p1-q01,p2-q01,p1-q05 --modes default,between_tools,adaptive_effort:low
 *        [--out <dir>] [--dry-run] [--max-usd 0.75] [--spent-usd <n>]
 *
 * Mode syntax: name[:effort] with name in default|between_tools|adaptive_effort and effort in low|medium|high.
 * Credit guard: refuses (exit 2) when credit is unknown/low or the estimate exceeds --max-usd, and stops
 * (exit 3) when projected credit would fall below what the full eval preflight needs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { argValue, hasFlag, QUERIES_PATH, readJson, RESULTS_DIR, selectQueries, sleep, timestamp, writeJson, type QueriesFile } from './lib';
import { FULL_EVAL_MIN_CREDIT_USD } from './preflight';
import { median } from './metrics';
import { checkProviderHealth } from '../src/lib/provider-health';
import type { GenerationConfig, GenerationEffort, GenerationMode } from '../src/lib/concierge-config';

const COST_PER_CALL_USD = 0.045;
const MIN_CREDIT_TO_START_USD = 1.0;
const MODES: readonly GenerationMode[] = ['default', 'between_tools', 'adaptive_effort'];
const EFFORTS: readonly GenerationEffort[] = ['low', 'medium', 'high'];

function usage(): void {
  console.log(`Usage: npx tsx eval/stream-timing.ts --ids <id,id> --modes <mode[:effort],...> [--out <dir>] [--dry-run] [--max-usd 0.75] [--spent-usd <n>]
Modes: default | between_tools | adaptive_effort, optional :low|:medium|:high
Estimate: $${COST_PER_CALL_USD} per call. Exits 2 on credit refusal, 3 when projected credit < $${FULL_EVAL_MIN_CREDIT_USD.toFixed(2)}.`);
}

export function parseMode(spec: string): { label: string; config: GenerationConfig } {
  const [name, effort] = spec.split(':');
  if (!MODES.includes(name as GenerationMode)) throw new Error(`Unknown mode "${name}" (expected ${MODES.join(', ')})`);
  if (effort !== undefined && !EFFORTS.includes(effort as GenerationEffort)) throw new Error(`Unknown effort "${effort}" (expected ${EFFORTS.join(', ')})`);
  return { label: spec, config: { mode: name as GenerationMode, effort: (effort as GenerationEffort | undefined) ?? null } };
}

interface CallResult {
  id: string;
  mode: string;
  t_retrieval_ms: number;
  t_first_raw_ms: number | null;
  t_first_thinking_ms: number | null;
  t_first_text_ms: number | null;
  t_hero_first_ms: number | null;
  t_hero_done_ms: number | null;
  t_complete_ms: number | null;
  usage: { input: number | null; output: number | null; cache_read: number | null; cache_creation: number | null; cost: number | null } | null;
  error: string | null;
  components: string[];
  hero_first: boolean;
}

const fmt = (v: number | null | undefined, dp = 0) => (v == null ? 'n/a' : v.toFixed(dp));
const med = (xs: Array<number | null | undefined>) => median(xs.filter((x): x is number => typeof x === 'number'));

async function credit(): Promise<{ status: string; remaining: number | null; reason: string }> {
  const h = await checkProviderHealth({ timeoutMs: 10000 });
  return { status: h.status, remaining: h.credit.remaining, reason: h.reason };
}

async function main() {
  if (hasFlag('--help')) return usage();
  const idsArg = argValue('--ids');
  const modesArg = argValue('--modes');
  if (!idsArg || !modesArg) {
    usage();
    process.exit(1);
  }
  const maxUsd = Number(argValue('--max-usd') ?? 0.75);
  const spentPrev = Number(argValue('--spent-usd') ?? 0);
  const dryRun = hasFlag('--dry-run');

  const { queries } = readJson<QueriesFile>(QUERIES_PATH);
  const ids = idsArg.split(',').map(s => s.trim()).filter(Boolean);
  selectQueries(queries, { ids }); // throws on unknown or held-out ids (D-602)
  const modes = modesArg.split(',').map(s => parseMode(s.trim()));

  const totalCalls = ids.length * modes.length;
  const estimate = totalCalls * COST_PER_CALL_USD;
  console.log(`Plan: ${totalCalls} calls (${ids.length} queries x ${modes.length} modes: ${modes.map(m => m.label).join(', ')}), estimated cost $${estimate.toFixed(2)} (max $${maxUsd.toFixed(2)}, already spent $${spentPrev.toFixed(2)})`);
  if (dryRun) {
    console.log('Dry run: no network calls made.');
    return;
  }

  // Credit gate, before the first paid call and again before every later one
  const before = await credit();
  let spentThisRun = 0;
  const finish = (code: number, msg?: string): never => {
    if (msg) console.error(msg);
    console.log(`Spend this invocation: $${spentThisRun.toFixed(3)}`);
    process.exit(code);
  };
  const guard = async (callsLeft: number, first: boolean): Promise<void> => {
    const c = first ? before : await credit();
    if (!first && before.remaining !== null && c.remaining !== null) spentThisRun = Math.max(0, before.remaining - c.remaining);
    const est = callsLeft * COST_PER_CALL_USD;
    if (c.status === 'fail') finish(2, `Refusing: provider health fail: ${c.reason}`);
    if (c.remaining === null) finish(2, `Refusing: credit unknown (${c.reason})`);
    if (c.remaining! < MIN_CREDIT_TO_START_USD) finish(2, `Refusing: credit $${c.remaining!.toFixed(2)} is below $${MIN_CREDIT_TO_START_USD.toFixed(2)}`);
    if (est > maxUsd) finish(2, `Refusing: estimate $${est.toFixed(2)} exceeds --max-usd $${maxUsd.toFixed(2)}`);
    if (spentPrev + spentThisRun + est > maxUsd) finish(2, `Refusing: spent $${(spentPrev + spentThisRun).toFixed(2)} + estimate $${est.toFixed(2)} exceeds --max-usd $${maxUsd.toFixed(2)}`);
    const projected = c.remaining! - est;
    if (projected < FULL_EVAL_MIN_CREDIT_USD) {
      console.error(`STOP: projected credit $${projected.toFixed(2)} is below the $${FULL_EVAL_MIN_CREDIT_USD.toFixed(2)} the full eval preflight needs; top up before 05-09`);
      console.log(`Spend this invocation: $${spentThisRun.toFixed(3)}`);
      process.exit(3);
    }
  };

  // env is loaded by './lib'; the orchestrator builds its client on import, so load it only now
  const { orchestrateStream } = await import('../src/lib/orchestrator');
  const { retrieveContext } = await import('../src/lib/supabase');
  const { getCatalogue } = await import('../src/lib/catalogue');

  const outDir = argValue('--out') ?? path.join(RESULTS_DIR, `stream-timing-${timestamp()}`);
  fs.mkdirSync(outDir, { recursive: true });
  const results: CallResult[] = [];
  const rawSaved = new Set<string>();
  const catalogue = await getCatalogue();

  let callsLeft = totalCalls;
  for (const id of ids) {
    const q = queries.find(x => x.id === id)!;
    await guard(callsLeft, results.length === 0);
    const tr = performance.now();
    const context = await retrieveContext({ query: q.text, maxChunks: 10, maxAssets: 5, skipCache: true });
    const t_retrieval_ms = Math.round(performance.now() - tr);

    for (const mode of modes) {
      if (results.length > 0) {
        await sleep(2000);
        await guard(callsLeft, false);
      }
      const r: CallResult = {
        id, mode: mode.label, t_retrieval_ms, t_first_raw_ms: null, t_first_thinking_ms: null, t_first_text_ms: null,
        t_hero_first_ms: null, t_hero_done_ms: null, t_complete_ms: null, usage: null, error: null, components: [], hero_first: false,
      };
      const raw: Array<{ t: number; ev: unknown }> = [];
      const start = performance.now();
      try {
        for await (const ev of orchestrateStream(
          { userQuery: q.text, context, skipCache: true },
          {
            catalogue,
            generation: mode.config,
            onRawEvent: (ev, tMs) => {
              if (r.t_first_raw_ms === null) r.t_first_raw_ms = tMs;
              const blockType = ev.content_block?.type ?? ev.delta?.type;
              if (r.t_first_thinking_ms === null && (blockType === 'thinking' || blockType === 'thinking_delta')) r.t_first_thinking_ms = tMs;
              if (r.t_first_text_ms === null && ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') r.t_first_text_ms = tMs;
              if (!rawSaved.has(mode.label)) raw.push({ t: tMs, ev });
            },
          },
        )) {
          const t = Math.round(performance.now() - start);
          if ((ev.type === 'hero' || ev.type === 'hero_done') && r.t_hero_first_ms === null) r.t_hero_first_ms = t;
          if (ev.type === 'hero_done') r.t_hero_done_ms = t;
          if (ev.type === 'final') {
            r.t_complete_ms = t;
            const layout = ev.output.layoutPlan.layout;
            r.components = layout.map(i => i.component);
            r.hero_first = layout[0]?.component === 'HeroBlock';
            const u = ev.output.usage;
            r.usage = u
              ? { input: u.input_tokens, output: u.output_tokens, cache_read: u.cache_read_input_tokens, cache_creation: u.cache_creation_input_tokens, cost: u.cost }
              : null;
          }
        }
      } catch (e) {
        r.error = e instanceof Error ? e.message : String(e);
      }
      if (!rawSaved.has(mode.label)) {
        rawSaved.add(mode.label);
        fs.writeFileSync(path.join(outDir, `raw-${mode.label.replace(':', '-')}.jsonl`), raw.map(x => JSON.stringify(x)).join('\n') + '\n');
      }
      results.push(r);
      callsLeft -= 1;
      console.log(`${id} [${mode.label}] ${r.error ? `ERROR ${r.error.slice(0, 120)}` : `hero ${fmt(r.t_hero_first_ms)}ms complete ${fmt(r.t_complete_ms)}ms`}`);
    }
  }

  writeJson(path.join(outDir, 'timing.json'), { results });

  const rows = modes.map(m => {
    const rs = results.filter(r => r.mode === m.label);
    const ok = rs.filter(r => !r.error);
    return `| ${m.label} | ${ok.length}/${rs.length} | ${fmt(med(ok.map(r => r.t_first_text_ms)))} | ${fmt(med(ok.map(r => r.t_hero_first_ms)))} | ${fmt(med(ok.map(r => r.t_complete_ms)))} | ${fmt(med(ok.map(r => r.usage?.output)))} | ${fmt(med(ok.map(r => r.usage?.cache_read)))} | ${fmt(med(ok.map(r => r.usage?.cost)), 4)} | ${rs.filter(r => r.error).map(r => r.error!.slice(0, 80)).join('; ') || 'none'} |`;
  });
  console.log(`\n| Mode | Calls ok | t_first_text ms | t_hero_first ms | t_complete ms | Output tokens | cache_read/call | Cost USD | Errors |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}`);

  const after = await credit();
  if (before.remaining !== null && after.remaining !== null) spentThisRun = Math.max(0, before.remaining - after.remaining);
  console.log(`\nWrote ${path.join(outDir, 'timing.json')}`);
  finish(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
