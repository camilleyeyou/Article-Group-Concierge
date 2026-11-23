/**
 * Compare a run with earlier runs on the ids they have in common.
 *
 * D-416: like-for-like smoke deltas. Uses whatever metrics METRIC_DEFS defines,
 * so 04-04's new metrics appear automatically.
 *
 * Usage:
 *   npm run eval:compare -- --dir <runA> --against <runB> [--against <runC>]
 *
 * Writes <runA>/compare.md. Old run directories are never modified.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readJson, type GradeRecord, type GradesFile, type RunFile } from './lib';
import { computeRunMetrics, formatDelta, formatValue, METRIC_DEFS, type RunMetrics } from './metrics';

function multiArg(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

function loadGrades(dir: string): GradeRecord[] {
  const f = path.join(dir, 'grades.json');
  return fs.existsSync(f) ? readJson<GradesFile>(f).grades : [];
}

/** Metrics for `dir` restricted to `ids`, computed from a temp copy. */
export function metricsOnIds(dir: string, ids: Set<string>): RunMetrics {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-compare-'));
  try {
    const run = readJson<RunFile>(path.join(dir, 'responses.json'));
    const records = run.records.filter(r => ids.has(r.id));
    fs.writeFileSync(path.join(tmp, 'responses.json'), JSON.stringify({ ...run, records, query_count: records.length }));
    const gradesFile = path.join(dir, 'grades.json');
    if (fs.existsSync(gradesFile)) {
      const g = readJson<GradesFile>(gradesFile);
      fs.writeFileSync(
        path.join(tmp, 'grades.json'),
        JSON.stringify({ ...g, grades: g.grades.filter(x => ids.has(x.id)) }),
      );
    }
    return computeRunMetrics(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const dirA = path.resolve(process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : '');
  const againstDirs = multiArg('--against').map(d => path.resolve(d));
  if (!process.argv.includes('--dir') || againstDirs.length === 0) {
    console.error('Usage: npm run eval:compare -- --dir <runA> --against <runB> [--against <runC>]');
    process.exit(1);
  }

  const runA = readJson<RunFile>(path.join(dirA, 'responses.json'));
  const idsA = runA.records.map(r => r.id);
  const idSet = new Set(idsA);
  const gradesA = new Map(loadGrades(dirA).map(g => [g.id, g]));
  const metricsA = metricsOnIds(dirA, idSet);

  const others = againstDirs.map(dir => {
    const run = readJson<RunFile>(path.join(dir, 'responses.json'));
    const have = new Set(run.records.map(r => r.id));
    const missing = idsA.filter(id => !have.has(id));
    return { dir, name: path.basename(dir), metrics: metricsOnIds(dir, idSet), grades: new Map(loadGrades(dir).map(g => [g.id, g])), missing };
  });

  const nameA = path.basename(dirA);
  const lines: string[] = [];
  lines.push(`# Subset comparison: ${nameA} vs ${others.map(o => o.name).join(', ')} on ${idsA.length} common ids`, '');
  lines.push(`| Metric | ${nameA} | ${others.map(o => `${o.name} | Δ vs ${o.name}`).join(' | ')} |`);
  lines.push(`|---|---|${others.map(() => '---|---|').join('')}`);
  for (const def of METRIC_DEFS) {
    const a = def.get(metricsA);
    const cells = others.map(o => {
      const b = def.get(o.metrics);
      return `${formatValue(def, b)} | ${formatDelta(def, a, b, o.metrics, metricsA)}`;
    });
    lines.push(`| ${def.label} | ${formatValue(def, a)} | ${cells.join(' | ')} |`);
  }

  const first = others[0];
  lines.push('', '## Per-id claims', '');
  lines.push(`| ID | type | claims A | claims ${first.name} | claim kinds A |`);
  lines.push('|---|---|---|---|---|');
  for (const r of runA.records) {
    const a = gradesA.get(r.id);
    const b = first.grades.get(r.id);
    const kinds = (a?.claims ?? []).map(c => c.kind).join(', ') || '-';
    lines.push(`| ${r.id} | ${r.type} | ${a ? a.invented_claims.length : 'n/a'} | ${b ? b.invented_claims.length : 'n/a'} | ${kinds} |`);
  }

  for (const o of others) {
    if (o.missing.length) lines.push('', `## Missing in ${o.name}`, '', o.missing.join(', '));
  }

  const out = path.join(dirA, 'compare.md');
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(out);
}

if (require.main === module) main();
