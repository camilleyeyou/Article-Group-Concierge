/**
 * Aggregate several graded runs: mean, sample SD and min-max per metric, with
 * deltas of the mean against the frozen baseline and its re-grade.
 *
 * Usage: npm run eval:aggregate -- --dirs <dir1>,<dir2>[,...]
 */

import * as fs from 'fs';
import * as path from 'path';
import { FROZEN_BASELINE_ID, RESULTS_DIR, argValue } from './lib';
import { METRIC_DEFS, computeRunMetrics, findRegradeDir, formatDelta, formatValue, summarize } from './metrics';

export function aggregateRuns(dirs: string[], opts: { baselineDir?: string; regradeDir?: string | null } = {}): string {
  const ms = dirs.map(computeRunMetrics);
  const baselineDir =
    opts.baselineDir ??
    (process.env.EVAL_BASELINE_DIR ? path.resolve(process.env.EVAL_BASELINE_DIR) : path.join(RESULTS_DIR, FROZEN_BASELINE_ID));
  const regradeDir = opts.regradeDir !== undefined ? opts.regradeDir : findRegradeDir(FROZEN_BASELINE_ID);
  const base = fs.existsSync(path.join(baselineDir, 'responses.json')) ? computeRunMetrics(baselineDir) : null;
  const regrade = regradeDir && fs.existsSync(path.join(regradeDir, 'responses.json')) ? computeRunMetrics(regradeDir) : null;

  const out: string[] = [`# Eval aggregate (${dirs.length} runs)`, ''];
  for (const m of ms) {
    out.push(
      `- \`${m.run_id}\`: route ${m.models.route ?? 'not recorded'}, generation \`${m.models.generation ?? 'not recorded'}\`, judge \`${m.models.judge}\``,
    );
  }
  out.push('');

  const headers = [
    'Metric', 'Mean', 'SD', 'Min–max', 'n', 'Frozen baseline', 'Δ mean vs frozen', 'Baseline re-graded', 'Δ mean vs re-graded',
  ];
  out.push(`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`);
  for (const def of METRIC_DEFS) {
    const s = summarize(ms.map(def.get));
    const b = base ? def.get(base) : null;
    const r = regrade ? def.get(regrade) : null;
    const sd = s.sd === null ? '–' : s.sd.toFixed(2);
    const range = s.min === null || s.max === null ? 'n/a' : `${formatValue(def, s.min)}–${formatValue(def, s.max)}`;
    out.push(
      `| ${[
        def.label,
        formatValue(def, s.mean),
        sd,
        range,
        String(s.n),
        base ? formatValue(def, b) : '–',
        base ? formatDelta(def, s.mean, b, base, ms[0]) : '–',
        regrade ? formatValue(def, r) : '–',
        regrade ? formatDelta(def, s.mean, r, regrade, ms[0]) : '–',
      ].join(' | ')} |`,
    );
  }
  out.push('', 'Spread: sample SD (n−1) and min–max across runs. With one run SD is undefined.');
  return out.join('\n') + '\n';
}

if (require.main === module) {
  const dirs = (argValue('--dirs') ?? '').split(',').filter(Boolean).map(d => path.resolve(d));
  if (dirs.length === 0) {
    console.error('Usage: npm run eval:aggregate -- --dirs <dir1>,<dir2>[,...]');
    process.exit(1);
  }
  process.stdout.write(aggregateRuns(dirs));
}
