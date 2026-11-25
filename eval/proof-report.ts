/**
 * Phase 6 proof report: ready-bar table (PROOF-01) and before/after source data
 * (PROOF-02) from 1-3 proof run dirs, their production timing batches and the
 * static-check file.
 *
 * Usage:
 *   npm run eval:proof-report -- --runs <d1>[,<d2>,<d3>] [--timing <t1.json>[,<t2>,<t3>]] \
 *     [--static <06-STATIC-CHECKS.json>] [--out <md path>]
 *
 * Exit: 0 PASS, 1 FAIL, 2 INCOMPLETE, 3 INVALID (runs on different code/models, D-608).
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RESULTS_DIR, argValue, readJson, timestamp, writeJson, type RunFile } from './lib';
import { aggregateRuns } from './aggregate';
import {
  METRIC_DEFS,
  computeRunMetrics,
  findRegradeDir,
  phase6Gates,
  summarize,
  summarizeTiming,
  timingGates,
  type GateRow,
  type RunMetrics,
} from './metrics';
import { HELD_OUT_ID_PATTERN } from './subsets';
import type { ProdTimingFile } from './prod-timing-types';
import { FROZEN_BASELINE_ID } from './lib';

export interface StaticChecks {
  site_work_missing: number;
  mismatched_videos: number;
  checked_at: string;
}

/** True when the code that affects results is identical between two commits (planning docs may differ). */
export function sameCode(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    execFileSync(
      'git',
      ['diff', '--quiet', a, b, '--', 'src', 'eval/*.ts', 'eval/queries.json', 'package.json', 'package-lock.json', 'supabase'],
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}

interface Row {
  check: string;
  bar: string;
  values: Array<string>; // per run
  nums: Array<number | null>;
  passes: Array<boolean | null>;
}

const NOT = 'not measured';

function fmtGate(g: GateRow): string {
  if (g.value === null) return 'n/a';
  return Number.isInteger(g.value) ? String(g.value) : g.value.toFixed(g.gate.startsWith('median') ? 0 : 2);
}

function gateRow(rows: GateRow[][], idx: number): Row {
  const first = rows.find(r => r[idx])?.[idx];
  return {
    check: first!.gate,
    bar: first!.limit,
    values: rows.map(r => (r[idx] ? fmtGate(r[idx]) : NOT)),
    nums: rows.map(r => r[idx]?.value ?? null),
    passes: rows.map(r => (r[idx] ? r[idx].pass : null)),
  };
}

const share = (n: number, d: number) => (d ? `${n} of ${d} (${((100 * n) / d).toFixed(0)}%)` : 'n/a');

function cells(row: Row, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 3; i++) out.push(i < n ? row.values[i] ?? NOT : '–');
  const nums = row.nums.slice(0, n);
  const s = summarize(nums);
  const f = (v: number | null) => (v === null ? 'n/a' : Number.isInteger(v) ? String(v) : v.toFixed(2));
  const measured = row.passes.slice(0, n).every(p => p !== null);
  const holds = !measured ? '–' : row.passes.slice(0, n).every(p => p === true) ? 'yes' : 'NO';
  return [...out, f(s.mean), s.min === null ? 'n/a' : `${f(s.min)}–${f(s.max)}`, holds];
}

function heldOutSection(dirs: string[]): string[] {
  const out = ['## Held-out (25) vs original (50)', '', 'Held-out queries were never used for tuning (D-602). They are also included in the totals above.', ''];
  const hdr = ['Run', 'Set', 'Graded', 'Recall', 'Responses with unsupported claims', 'goal_as_result', 'capability_not_shown', 'invention-bait presupposed', 'Voice', 'Grounded'];
  out.push(`| ${hdr.join(' | ')} |`, `| ${hdr.map(() => '---').join(' | ')} |`);
  for (const dir of dirs) {
    const sets: Array<[string, RunMetrics]> = [
      ['original', computeRunMetrics(dir, { filter: r => !HELD_OUT_ID_PATTERN.test(r.id) })],
      ['held-out', computeRunMetrics(dir, { filter: r => HELD_OUT_ID_PATTERN.test(r.id) })],
    ];
    for (const [label, m] of sets) {
      out.push(
        `| ${[
          m.run_id,
          label,
          `${m.graded}/${m.total}`,
          share(m.recall.hit, m.recall.total),
          share(m.responses_with_unsupported_claims, m.graded),
          m.claims_by_kind ? String(m.claims_by_kind.goal_as_result) : 'n/a',
          m.claims_by_kind ? String(m.claims_by_kind.capability_not_shown) : 'n/a',
          m.invention_bait_presupposed === null ? 'n/a' : String(m.invention_bait_presupposed),
          m.criteria.voice === null ? 'n/a' : m.criteria.voice.toFixed(2),
          m.criteria.grounded === null ? 'n/a' : m.criteria.grounded.toFixed(2),
        ].join(' | ')} |`,
      );
    }
  }
  return out;
}

/** Count-type metrics shown as shares so a 50-query baseline compares fairly with 75-query proof runs. */
function shareSection(ms: RunMetrics[], base: RunMetrics | null, regrade: RunMetrics | null): string[] {
  const out = [
    '## Count metrics as shares (baseline 50 queries, proof runs 75)',
    '',
    'Baseline: 50 queries; proof runs: 75. Compare counts only as shares. Δ is in percentage points of queries.',
    '',
  ];
  const hdr = ['Metric', 'Mean share', 'Run values', 'Frozen baseline', 'Δ vs frozen (pp)', 'Baseline re-graded', 'Δ vs re-graded (pp)'];
  out.push(`| ${hdr.join(' | ')} |`, `| ${hdr.map(() => '---').join(' | ')} |`);
  const pp = (v: number | null) => (v === null ? 'n/a' : `${v.toFixed(0)}%`);
  const delta = (a: number | null, b: number | null) =>
    a === null || b === null ? 'n/a' : `${a - b > 0 ? '+' : ''}${(a - b).toFixed(1)} pp`;
  for (const def of METRIC_DEFS.filter(d => d.unit === 'count' && d.better !== 'none')) {
    const shares = ms.map(m => {
      const v = def.get(m);
      return v === null || !m.total ? null : (100 * v) / m.total;
    });
    const sh = (m: RunMetrics | null) => {
      if (!m) return null;
      const v = def.get(m);
      return v === null || !m.total ? null : (100 * v) / m.total;
    };
    const mean = summarize(shares).mean;
    const runVals = ms.map(m => {
      const v = def.get(m);
      return v === null ? 'n/a' : `${Math.round(v)} of ${m.total}`;
    });
    out.push(
      `| ${[
        def.label,
        pp(mean),
        runVals.join(', '),
        base ? (def.get(base) === null ? 'n/a' : `${Math.round(def.get(base)!)} of ${base.total} (${pp(sh(base))})`) : '–',
        base ? delta(mean, sh(base)) : '–',
        regrade ? (def.get(regrade) === null ? 'n/a' : `${Math.round(def.get(regrade)!)} of ${regrade.total} (${pp(sh(regrade))})`) : '–',
        regrade ? delta(mean, sh(regrade)) : '–',
      ].join(' | ')} |`,
    );
  }
  return out;
}

function main(): void {
  const dirs = (argValue('--runs') ?? '').split(',').filter(Boolean).map(d => path.resolve(d));
  if (dirs.length < 1 || dirs.length > 3) {
    console.error('Usage: npm run eval:proof-report -- --runs <d1>[,<d2>,<d3>] [--timing <t1.json>[,...]] [--static <file>] [--out <md>]');
    process.exit(1);
  }
  const timingPaths = (argValue('--timing') ?? '').split(',').filter(Boolean).map(p => path.resolve(p));
  const staticPath = argValue('--static');
  const n = dirs.length;

  // D-608: same code and models across runs and timing batches
  const runFiles = dirs.map(d => readJson<RunFile>(path.join(d, 'responses.json')));
  const ms = dirs.map(d => computeRunMetrics(d));
  const timings = timingPaths.map(p => readJson<ProdTimingFile>(p));
  const problems: string[] = [];
  const c0 = runFiles[0].git_commit;
  for (let i = 1; i < n; i++) {
    const ci = runFiles[i].git_commit;
    if (!c0 || !ci) problems.push(`run ${i + 1} or run 1 has no git_commit`);
    else if (!sameCode(c0, ci)) problems.push(`run ${i + 1} (${ci}) differs from run 1 (${c0}) in code`);
    if (ms[i].models.generation !== ms[0].models.generation) problems.push(`run ${i + 1} generation model differs`);
    if (ms[i].models.judge !== ms[0].models.judge) problems.push(`run ${i + 1} judge model differs`);
  }
  for (const [i, t] of timings.entries()) {
    if (t.git_commit_expected && c0 && !sameCode(c0, t.git_commit_expected)) {
      problems.push(`timing batch ${i + 1} expects ${t.git_commit_expected}, which differs from run 1 (${c0}) in code`);
    }
  }
  if (problems.length) {
    console.error(`INVALID: runs are not on the same code/models (D-608)\n- ${problems.join('\n- ')}`);
    process.exit(3);
  }

  const statics: StaticChecks | null = staticPath && fs.existsSync(staticPath) ? readJson<StaticChecks>(path.resolve(staticPath)) : null;

  // ---- ready-bar rows
  const missing: string[] = [];
  const rows: Row[] = [];
  const g6 = ms.map(m => phase6Gates(m));
  for (let i = 0; i < g6[0].length; i++) rows.push(gateRow(g6, i));

  const tg = timings.map(t => timingGates(summarizeTiming(t)));
  const timingNames = timingGates(summarizeTiming({ records: [] } as unknown as ProdTimingFile));
  for (let i = 0; i < timingNames.length; i++) {
    if (tg.length === 0) {
      rows.push({ check: timingNames[i].gate, bar: timingNames[i].limit, values: [], nums: [], passes: [] });
    } else {
      const r = gateRow(tg, i);
      // pad runs without a timing batch
      while (r.values.length < n) {
        r.values.push(NOT);
        r.nums.push(null);
        r.passes.push(null);
      }
      rows.push(r);
    }
  }
  if (timings.length === 0) missing.push('production timing batches');
  else if (timings.length < n) missing.push(`timing batches (${timings.length} of ${n})`);

  const staticRow = (check: string, v: number | null): Row => ({
    check,
    bar: '= 0',
    values: Array.from({ length: n }, () => (v === null ? NOT : String(v))),
    nums: Array.from({ length: n }, () => v),
    passes: Array.from({ length: n }, () => (v === null ? null : v === 0)),
  });
  rows.push(staticRow('site work missing from index = 0', statics ? statics.site_work_missing : null));
  rows.push(staticRow('mismatched videos = 0', statics ? statics.mismatched_videos : null));
  if (!statics) missing.push('static checks file');

  // Pad run columns for every row to n entries
  for (const r of rows) {
    while (r.values.length < n) {
      r.values.push(NOT);
      r.nums.push(null);
      r.passes.push(null);
    }
  }
  const unmeasured = rows.filter(r => r.passes.slice(0, n).some(p => p === null));
  for (const r of unmeasured) {
    if (!(r.check.startsWith('median t_') || r.check.startsWith('cache-safe') || r.check.startsWith('site work') || r.check.startsWith('mismatched'))) {
      missing.push(`${r.check} (not graded)`);
    }
  }
  const failed = rows.filter(r => r.passes.slice(0, n).some(p => p === false)).map(r => r.check);

  let verdict: string;
  let exit: number;
  if (missing.length) {
    verdict = `VERDICT: INCOMPLETE (${[...new Set(missing)].join('; ')})`;
    exit = 2;
  } else if (failed.length) {
    verdict = `VERDICT: FAIL (${failed.join('; ')})`;
    exit = 1;
  } else {
    verdict = `VERDICT: PASS (all checks hold on all ${n} runs)`;
    exit = 0;
  }

  // ---- markdown
  const out: string[] = [`# Phase 6 proof report`, '', verdict, ''];
  for (const [i, m] of ms.entries()) {
    out.push(
      `- Run ${i + 1}: \`${m.run_id}\`, code \`${runFiles[i].git_commit ?? 'unknown'}\`, generation \`${m.models.generation ?? 'not recorded'}\`, judge \`${m.models.judge}\`, ${m.graded}/${m.total} graded`,
    );
  }
  out.push('', '## Ready bar', '');
  const hdr = ['Check', 'Bar', 'Run 1', 'Run 2', 'Run 3', 'Mean', 'Min–max', 'Holds on all runs'];
  out.push(`| ${hdr.join(' | ')} |`, `| ${hdr.map(() => '---').join(' | ')} |`);
  for (const r of rows) out.push(`| ${[r.check, r.bar, ...cells(r, n)].join(' | ')} |`);
  out.push(
    '',
    'Unsupported-claim bar is a share of graded responses (D-604). Speed rows use warm, cache-miss production timings only (D-605); cold timings are reported below.',
    '',
  );

  out.push(...heldOutSection(dirs), '');

  const baselineDir = path.join(RESULTS_DIR, FROZEN_BASELINE_ID);
  const base = fs.existsSync(path.join(baselineDir, 'responses.json')) ? computeRunMetrics(baselineDir) : null;
  const regradeDir = findRegradeDir(FROZEN_BASELINE_ID);
  const regrade = regradeDir && fs.existsSync(path.join(regradeDir, 'responses.json')) ? computeRunMetrics(regradeDir) : null;
  out.push(...shareSection(ms, base, regrade), '');
  out.push('## Baseline deltas (all metrics, raw values)', '', aggregateRuns(dirs), '');

  const agreementPath = path.join(dirs[0], 'agreement.json');
  if (fs.existsSync(agreementPath)) {
    const a = readJson<{ n: number; agreementScore: number; second_model: string }>(agreementPath);
    out.push('## Second grader', '', `\`${a.second_model}\` agreed with the judge within ±1 on ${(100 * a.agreementScore).toFixed(0)}% of scores (sample ${a.n} responses, run 1).`, '');
  }

  out.push('## Cold-start (reported, never gating)', '');
  if (timings.length === 0) out.push(NOT, '');
  else {
    const ch = ['Batch', 'Requests', 'Warm', 'Cold', 'Cold median t_teasers', 'Cold median t_hero_first', 'Warm p90 t_teasers', 'Warm p90 t_hero_first'];
    out.push(`| ${ch.join(' | ')} |`, `| ${ch.map(() => '---').join(' | ')} |`);
    const ms_ = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v)} ms`);
    for (const [i, t] of timings.entries()) {
      const s = summarizeTiming(t);
      out.push(
        `| ${[i + 1, s.n, s.warm_n, s.cold_n, ms_(s.teasers_cold_median), ms_(s.hero_first_cold_median), ms_(s.p90_teasers_warm), ms_(s.p90_hero_first_warm)].join(' | ')} |`,
      );
    }
    out.push('');
  }

  out.push(verdict, '');
  const outPath = path.resolve(argValue('--out') ?? path.join(RESULTS_DIR, `proof-${timestamp()}`, 'proof-report.md'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out.join('\n'));
  writeJson(path.join(path.dirname(outPath), 'proof.json'), {
    verdict,
    runs: ms.map((m, i) => ({ run_id: m.run_id, git_commit: runFiles[i].git_commit, graded: m.graded, total: m.total })),
    rows,
    timing: timings.map(summarizeTiming),
    static_checks: statics,
  });
  console.log(out.join('\n'));
  console.log(`Report written to ${outPath}`);
  process.exit(exit);
}

if (require.main === module) main();
