/**
 * Phase 07 HERO-03: replay the hero restatement guard (guardHeroRestatement) over every
 * saved run, on the user-visible layout. Offline and free: no network, no database, no
 * model calls. Read-only on eval/results.
 *
 * Usage:
 *   npx tsx eval/hero-guard-replay.ts [--out <prefix>]
 * Writes <prefix>.json (every change) and prints per-run totals. The .md report and the
 * .verdicts.json review file are maintained by hand; the totals table is regenerated into
 * <prefix>.md between the TOTALS markers when that file exists.
 */

import * as fs from 'fs';
import * as path from 'path';
import { argValue, readJson, RESULTS_DIR, type RunFile } from './lib';
import { guardHeroRestatement } from '../src/lib/output-guard';
import type { LayoutPlan } from '../src/types';

const PHASE_DIR = '.planning/phases/07-fast-hero-stops-restating-the-query';
const DEFAULT_OUT = `${PHASE_DIR}/07-HERO-GUARD-REPLAY`;

export interface GuardReplayChange {
  change_id: string;
  run: string;
  id: string;
  query: string;
  action: 'drop_field' | 'drop_sentence';
  before: string;
  kept: string | null;
}

export interface GuardReplayRun {
  run: string;
  heroes: number;
  changed: number;
  drop_field: number;
  drop_sentence: number;
}

function listRunDirs(): string[] {
  return fs
    .readdirSync(RESULTS_DIR)
    .filter(d => d.startsWith('2026-'))
    .sort()
    .map(d => path.join(RESULTS_DIR, d))
    .filter(d => fs.existsSync(path.join(d, 'responses.json')));
}

export function replayRun(dir: string): { summary: GuardReplayRun; changes: GuardReplayChange[] } {
  const name = path.basename(dir);
  const file = readJson<RunFile>(path.join(dir, 'responses.json'));
  const summary: GuardReplayRun = { run: name, heroes: 0, changed: 0, drop_field: 0, drop_sentence: 0 };
  const changes: GuardReplayChange[] = [];
  for (const rec of file.records) {
    if (rec.status !== 'ok') continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layout = (rec.response as any)?.layoutPlan as LayoutPlan | undefined;
    if (!layout || layout.layout?.[0]?.component !== 'HeroBlock') continue;
    summary.heroes++;
    const g = guardHeroRestatement(layout, rec.query);
    if (g.changes.length === 0) continue;
    summary.changed++;
    const kept = (g.layout.layout[0].props as unknown as Record<string, unknown>).challengeSummary;
    g.changes.forEach((c, n) => {
      if (c.action === 'drop_field') summary.drop_field++;
      else summary.drop_sentence++;
      changes.push({
        change_id: `${name}/${rec.id}/${n}`,
        run: name,
        id: rec.id,
        query: rec.query,
        action: c.action as 'drop_field' | 'drop_sentence',
        before: c.before,
        kept: typeof kept === 'string' ? kept : null,
      });
    });
  }
  return { summary, changes };
}

export function totalsTable(runs: GuardReplayRun[]): string {
  const lines = ['| Run | Heroes | Changed | drop_field | drop_sentence |', '|---|---|---|---|---|'];
  for (const r of runs) lines.push(`| ${r.run} | ${r.heroes} | ${r.changed} | ${r.drop_field} | ${r.drop_sentence} |`);
  const t = runs.reduce(
    (a, r) => ({ heroes: a.heroes + r.heroes, changed: a.changed + r.changed, f: a.f + r.drop_field, s: a.s + r.drop_sentence }),
    { heroes: 0, changed: 0, f: 0, s: 0 },
  );
  lines.push(`| **All** | ${t.heroes} | ${t.changed} | ${t.f} | ${t.s} |`);
  return lines.join('\n');
}

function main(): void {
  const out = argValue('--out') ?? DEFAULT_OUT;
  const runs: GuardReplayRun[] = [];
  const all: GuardReplayChange[] = [];
  for (const dir of listRunDirs()) {
    const r = replayRun(dir);
    runs.push(r.summary);
    all.push(...r.changes);
  }
  fs.writeFileSync(`${out}.json`, JSON.stringify({ runs, changes: all }, null, 2) + '\n');
  const table = totalsTable(runs);
  const md = `${out}.md`;
  if (fs.existsSync(md)) {
    const s = fs.readFileSync(md, 'utf8');
    const next = s.replace(/<!-- TOTALS -->[\s\S]*?<!-- \/TOTALS -->/, `<!-- TOTALS -->\n${table}\n<!-- /TOTALS -->`);
    if (next !== s) fs.writeFileSync(md, next);
  }
  console.log(table);
  console.log(`\n${all.length} changes written to ${out}.json`);
}

if (require.main === module) main();
