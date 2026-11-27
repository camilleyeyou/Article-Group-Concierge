/**
 * Phase 07 HERO-01: replay the hero restatement detector over every saved run.
 * Offline and free: no network, no database, no model calls. Read-only on eval/results.
 *
 * Usage:
 *   npx tsx eval/hero-replay.ts [--dir eval/results/<run>] [--out <prefix>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { argValue, parseLayout, readJson, RESULTS_DIR, type GradesFile, type RunFile, type RunRecord } from './lib';
import {
  detectHeroRestatement,
  HERO_RESTATEMENT_CONFIG,
  HERO_RESTATEMENT_VERSION,
  type RestatementResult,
  type RestatementSignal,
} from '../src/lib/hero-restatement';

const PHASE_DIR = '.planning/phases/07-fast-hero-stops-restating-the-query';
const DEFAULT_OUT = `${PHASE_DIR}/07-HERO-REPLAY`;
const REFERENCE_RUNS = ['2026-11-20T15-12-31', '2026-11-25T14-30-56', '2026-11-26T05-24-15'];
const SIGNALS: RestatementSignal[] = ['you_opener', 'asking_frame', 'verbatim_run'];

const LABEL_TARGET_RE = /(hero|challengeSummary|headline|opening)/i;
const LABEL_ACTION_RE = /(restat|paraphras|echo|parrot|mirror|repeat)/i;

export interface HeroRow {
  run: string;
  id: string;
  query: string;
  seen: string | null;
  graded: string | null;
  seen_result: RestatementResult | null;
  graded_result: RestatementResult | null;
  label: boolean | null;
}

export interface RunSummary {
  run: string;
  git_commit: string | null;
  heroes: number;
  seen_restates: number;
  graded_heroes: number;
  graded_restates: number;
  signals: Record<RestatementSignal, number>;
  mean_overlap: number | null;
  graded: boolean;
  label_count: number | null;
  agreement: { tp: number; fp: number; fn: number; tn: number } | null;
}

function heroSummaryOf(item: { component?: string; props?: Record<string, unknown> } | undefined): string | null | undefined {
  if (!item || item.component !== 'HeroBlock') return undefined; // no hero
  const s = item.props?.challengeSummary;
  return typeof s === 'string' ? s : null; // hero present, summary maybe missing
}

export function userSeenHero(rec: RunRecord): string | null | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const first = (rec.response as any)?.layoutPlan?.layout?.[0];
  return heroSummaryOf(first);
}

export function gradedHero(rec: RunRecord): string | null | undefined {
  const layout = parseLayout(rec.raw_response);
  return heroSummaryOf(layout?.[0]);
}

function listRunDirs(dir?: string): string[] {
  if (dir) return [dir];
  return fs
    .readdirSync(RESULTS_DIR)
    .filter(d => d.startsWith('2026-'))
    .sort()
    .map(d => path.join(RESULTS_DIR, d))
    .filter(d => fs.existsSync(path.join(d, 'responses.json')));
}

export function replayRun(dir: string): { summary: RunSummary; rows: HeroRow[] } {
  const name = path.basename(dir);
  const run = readJson<RunFile>(path.join(dir, 'responses.json'));
  const gradesFile = path.join(dir, 'grades.json');
  const grades = fs.existsSync(gradesFile) ? readJson<GradesFile>(gradesFile) : null;
  const rows: HeroRow[] = [];
  const signals = { you_opener: 0, asking_frame: 0, verbatim_run: 0 } as Record<RestatementSignal, number>;
  let heroes = 0;
  let seenRestates = 0;
  let gradedHeroes = 0;
  let gradedRestates = 0;
  let overlapSum = 0;
  let overlapN = 0;
  let labelCount = 0;
  const agreement = { tp: 0, fp: 0, fn: 0, tn: 0 };

  for (const rec of run.records) {
    if (rec.status !== 'ok') continue;
    const seen = userSeenHero(rec);
    const graded = gradedHero(rec);
    if (seen === undefined && graded === undefined) continue;
    const seenResult = seen === undefined ? null : detectHeroRestatement(rec.query, seen);
    const gradedResult = graded === undefined ? null : detectHeroRestatement(rec.query, graded);
    let label: boolean | null = null;
    if (grades) {
      const reason = grades.grades.find(g => g.id === rec.id)?.scores?.voice?.reason ?? '';
      label = LABEL_TARGET_RE.test(reason) && LABEL_ACTION_RE.test(reason);
      if (label) labelCount++;
    }
    if (seenResult) {
      heroes++;
      if (seenResult.restates) seenRestates++;
      for (const s of seenResult.signals) signals[s]++;
      if (typeof seen === 'string' && seen.trim() !== '') {
        overlapSum += seenResult.overlap;
        overlapN++;
      }
    }
    if (gradedResult) {
      gradedHeroes++;
      if (gradedResult.restates) gradedRestates++;
      if (label !== null) {
        const p = gradedResult.restates;
        if (p && label) agreement.tp++;
        else if (p && !label) agreement.fp++;
        else if (!p && label) agreement.fn++;
        else agreement.tn++;
      }
    }
    rows.push({
      run: name,
      id: rec.id,
      query: rec.query,
      seen: seen ?? null,
      graded: graded ?? null,
      seen_result: seenResult,
      graded_result: gradedResult,
      label,
    });
  }

  return {
    summary: {
      run: name,
      git_commit: run.git_commit,
      heroes,
      seen_restates: seenRestates,
      graded_heroes: gradedHeroes,
      graded_restates: gradedRestates,
      signals,
      mean_overlap: overlapN ? Math.round((overlapSum / overlapN) * 100) / 100 : null,
      graded: !!grades,
      label_count: grades ? labelCount : null,
      agreement: grades ? agreement : null,
    },
    rows,
  };
}

function renderMarkdown(summaries: RunSummary[]): string {
  const L: string[] = [];
  L.push('# Phase 07: hero restatement replay (free, offline)');
  L.push('');
  L.push(
    `Generated by \`npx tsx eval/hero-replay.ts\` with detector v${HERO_RESTATEMENT_VERSION} ` +
      `(verbatimRun = ${HERO_RESTATEMENT_CONFIG.verbatimRun}). No network, no database, no model calls.`,
  );
  L.push('');
  L.push('"Seen" is the user-visible hero (`response.layoutPlan.layout[0]`). "Graded" is the first item of `parseLayout(raw_response)`, the hero the grader read.');
  L.push('');
  L.push('## Rates');
  L.push('');
  L.push('| Run | Commit | Heroes | Seen restates | Graded restates | you_opener | asking_frame | verbatim_run | Mean overlap |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const s of summaries) {
    L.push(
      `| ${s.run} | ${s.git_commit ?? '-'} | ${s.heroes} | ${s.seen_restates}/${s.heroes} | ${s.graded_restates}/${s.graded_heroes} | ` +
        `${s.signals.you_opener} | ${s.signals.asking_frame} | ${s.signals.verbatim_run} | ${s.mean_overlap ?? '-'} |`,
    );
  }
  L.push('');
  L.push('## Grader agreement');
  L.push('');
  L.push('Graded hero detector verdict vs grader label (voice reason mentions the hero and restating/echoing).');
  L.push('');
  L.push('| Run | Labels | TP | FP | FN | TN |');
  L.push('|---|---|---|---|---|---|');
  for (const s of summaries.filter(x => x.agreement)) {
    const a = s.agreement!;
    L.push(`| ${s.run} | ${s.label_count} | ${a.tp} | ${a.fp} | ${a.fn} | ${a.tn} |`);
  }
  L.push('');
  L.push('## Reference runs');
  L.push('');
  for (const id of REFERENCE_RUNS) {
    const s = summaries.find(x => x.run === id);
    const role =
      id === '2026-11-20T15-12-31' ? 'frozen baseline' : id === '2026-11-25T14-30-56' ? 'Phase 6 reference' : 'Phase 06.1 confirm run';
    if (!s) {
      L.push(`- ${id} (${role}): not present`);
      continue;
    }
    L.push(
      `- ${id} (${role}, ${s.git_commit ?? '-'}): seen ${s.seen_restates}/${s.heroes}, graded ${s.graded_restates}/${s.graded_heroes}`,
    );
  }
  L.push('');
  L.push('## Notes');
  L.push('');
  L.push(
    '- The grader label is a loose regex over free-text voice reasons. It also catches cross-component repetition (e.g. narrative repeating the hero) and misses reasons that criticise restating without naming the hero, so agreement is informational, not ground truth.',
  );
  L.push(
    '- Mean overlap (share of summary content words found in the query) is reported for context only. Planning measured it does not separate restating from non-restating heroes, so it is not a restatement signal.',
  );
  L.push('- Only records with status "ok" are counted. Heroes with no challengeSummary count as heroes but are never flagged.');
  L.push('- No detector adjustments were needed: rules are exactly as specified in 07-01-PLAN Task 1.');
  L.push('');
  return L.join('\n');
}

function main(): void {
  const dir = argValue('--dir');
  const out = argValue('--out') ?? DEFAULT_OUT;
  const summaries: RunSummary[] = [];
  const rows: HeroRow[] = [];
  for (const d of listRunDirs(dir)) {
    const r = replayRun(d);
    summaries.push(r.summary);
    rows.push(...r.rows);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    `${out}.json`,
    JSON.stringify(
      { detector_version: HERO_RESTATEMENT_VERSION, config: HERO_RESTATEMENT_CONFIG, runs: summaries, rows },
      null,
      2,
    ) + '\n',
  );
  fs.writeFileSync(`${out}.md`, renderMarkdown(summaries));
  for (const s of summaries) {
    console.log(`${s.run}  seen ${s.seen_restates}/${s.heroes}  graded ${s.graded_restates}/${s.graded_heroes}`);
  }
  console.log(`Wrote ${out}.md and ${out}.json`);
}

if (require.main === module) main();
