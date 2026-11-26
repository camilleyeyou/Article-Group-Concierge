/**
 * Replay the output guard over every saved answer. Offline and free: no network, no database.
 *
 * Usage:
 *   npx tsx eval/guard-saved.ts [--dir eval/results/<run>] [--out <prefix>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { argValue, readJson, RESULTS_DIR, type GradesFile, type RunFile } from './lib';
import { claimFragments, normalizeText } from './trace-claims';
import { guardOutputText, OUTPUT_GUARD_VERSION, type GuardChange } from '../src/lib/output-guard';
import { countSentences } from '../src/lib/sentences';
import { CONCIERGE_CONFIG } from '../src/lib/concierge-config';

const PHASE_DIR = '.planning/phases/06.1-output-guard-and-claim-tracing';
const DEFAULT_OUT = `${PHASE_DIR}/06.1-GUARD-REPLAY`;
const DEMO_DIR = '.planning/phases/06-proof/06-DEMO';
const LATEST = '2026-11-25T14-30-56';
const FP_CUTOFF = '2026-11-23';

export interface SavedClaim {
  claim_index: number;
  kind: string;
  claim: string;
}
export interface SavedAnswer {
  answer_id: string;
  run: string;
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: { layoutPlan: any; explanation: string; [k: string]: unknown };
  grades?: SavedClaim[];
}
export interface AnswerReplay {
  answer_id: string;
  run: string;
  changes: GuardChange[];
  narrative_before: number;
  narrative_after: number;
  below_min: boolean;
  graded_claims_removed: { claim_index: number; kind: string; claim: string }[];
  explanation_before: string;
  explanation_after: string;
  unchanged: boolean;
}

export function loadSavedAnswers(opts: { dir?: string } = {}): SavedAnswer[] {
  const out: SavedAnswer[] = [];
  const runDirs = opts.dir
    ? [opts.dir]
    : fs
        .readdirSync(RESULTS_DIR)
        .sort()
        .map(d => path.join(RESULTS_DIR, d));
  for (const dir of runDirs) {
    const file = path.join(dir, 'responses.json');
    if (!fs.existsSync(file)) continue;
    const run = readJson<RunFile>(file);
    const gradesFile = path.join(dir, 'grades.json');
    const grades = fs.existsSync(gradesFile) ? readJson<GradesFile>(gradesFile) : null;
    const name = path.basename(dir);
    for (const rec of run.records) {
      if (!rec.response) continue;
      const g = grades?.grades.find(x => x.id === rec.id);
      out.push({
        answer_id: `${name}:${rec.id}`,
        run: name,
        id: rec.id,
        response: rec.response as unknown as SavedAnswer['response'],
        grades: (g?.claims ?? []).map((c, claim_index) => ({ claim_index, kind: c.kind, claim: c.claim })),
      });
    }
  }
  if (!opts.dir && fs.existsSync(DEMO_DIR)) {
    for (const id of fs.readdirSync(DEMO_DIR).sort()) {
      const d = path.join(DEMO_DIR, id);
      if (!fs.statSync(d).isDirectory()) continue;
      for (const f of fs.readdirSync(d).sort()) {
        const m = /^round(\d+)\.json$/.exec(f);
        if (!m) continue;
        const j = readJson<{ final?: SavedAnswer['response'] }>(path.join(d, f));
        if (!j.final || !j.final.layoutPlan) continue;
        out.push({ answer_id: `06-DEMO/${id}/round${m[1]}`, run: '06-DEMO', id, response: j.final });
      }
    }
  }
  return out;
}

export function replayAnswers(answers: SavedAnswer[]): AnswerReplay[] {
  const min = CONCIERGE_CONFIG.narrative.minSentences;
  return answers.map(a => {
    const explanation = typeof a.response.explanation === 'string' ? a.response.explanation : '';
    const g = guardOutputText(a.response.layoutPlan, explanation);
    const before = countSentences(explanation);
    const after = countSentences(g.explanation);
    const removed: AnswerReplay['graded_claims_removed'] = [];
    for (const c of a.grades ?? []) {
      const frags = claimFragments(c.claim).map(normalizeText).filter(Boolean);
      if (!frags.length) continue;
      const hit = g.report.changes.some(ch => {
        const b = normalizeText(ch.before);
        const af = normalizeText(ch.after);
        return frags.some(fr => b.includes(fr) && !af.includes(fr));
      });
      if (hit) removed.push(c);
    }
    const unchanged =
      JSON.stringify(g.layout) === JSON.stringify(a.response.layoutPlan) && g.explanation === explanation;
    return {
      answer_id: a.answer_id,
      run: a.run,
      changes: g.report.changes,
      narrative_before: before,
      narrative_after: after,
      below_min: after < min && before >= min,
      graded_claims_removed: removed,
      explanation_before: explanation,
      explanation_after: g.explanation,
      unchanged,
    };
  });
}

// ---------- must-catch ----------

export interface MustCase {
  n: number;
  desc: string;
  answer_id: string;
  check: (r: AnswerReplay) => boolean;
}

const LATEST_ID = `${LATEST}:`;
export const MUST_CASES: MustCase[] = [
  {
    n: 1,
    desc: 'p3-q10/round3: "in what we pulled up" sentence dropped',
    answer_id: '06-DEMO/p3-q10/round3',
    check: r =>
      r.explanation_before.includes('in what we pulled up') &&
      !r.explanation_after.includes('in what we pulled up') &&
      r.changes.some(c => c.field === 'explanation' && c.rule === 'retrieval_leak' && c.action === 'drop_sentence'),
  },
  {
    n: 2,
    desc: 'p5-q06/round3: "Nothing we retrieved speaks to pricing..." dropped',
    answer_id: '06-DEMO/p5-q06/round3',
    check: r =>
      r.explanation_before.includes("Nothing we retrieved speaks to pricing, so we haven't shown client work.") &&
      !r.explanation_after.includes('Nothing we retrieved speaks to pricing'),
  },
  {
    n: 3,
    desc: `${LATEST} p1-q07: "our two security examples" -> "two of our security examples"`,
    answer_id: `${LATEST_ID}p1-q07`,
    check: r =>
      r.explanation_before.includes('our two security examples') &&
      r.explanation_after.includes('two of our security examples') &&
      !r.explanation_after.includes('our two security examples'),
  },
  {
    n: 4,
    desc: '2026-11-24T10-42-25 p1-q07: "These are the two cybersecurity studies in our portfolio."',
    answer_id: '2026-11-24T10-42-25:p1-q07',
    check: r =>
      r.explanation_before.includes('These are the two cybersecurity studies in our portfolio.') &&
      r.explanation_after.includes('These are two of the cybersecurity studies in our portfolio.'),
  },
  {
    n: 5,
    desc: `${LATEST} p5-q10: "I can't responsibly" -> "we can't responsibly"`,
    answer_id: `${LATEST_ID}p5-q10`,
    check: r =>
      /I can['’]t responsibly/.test(r.explanation_before) &&
      /we can['’]t responsibly/.test(r.explanation_after) &&
      !/I can['’]t responsibly/.test(r.explanation_after),
  },
  {
    n: 6,
    desc: '2026-11-24T10-42-25 p5-q06: "None of the work retrieved here speaks to pricing" dropped',
    answer_id: '2026-11-24T10-42-25:p5-q06',
    check: r =>
      r.explanation_before.includes('None of the work retrieved here speaks to pricing') &&
      !r.explanation_after.includes('None of the work retrieved here speaks to pricing'),
  },
  {
    n: 7,
    desc: `${LATEST} p2-q09: "nothing we've published" unchanged`,
    answer_id: `${LATEST_ID}p2-q09`,
    check: r => /nothing we[’']ve published/.test(r.explanation_before) && /nothing we[’']ve published/.test(r.explanation_after),
  },
  {
    n: 8,
    desc: `${LATEST} p5-q10: "the two studies above" unchanged`,
    answer_id: `${LATEST_ID}p5-q10`,
    check: r => r.explanation_before.includes('the two studies above') && r.explanation_after.includes('the two studies above'),
  },
];

// ---------- report ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededSample<T>(items: T[], n: number, seed: number): T[] {
  const arr = [...items];
  const rnd = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export interface ChangeRow {
  answer_id: string;
  field: string;
  rule: string;
  action: string;
  before: string;
  after: string;
  verdict: string | null;
}

export const verdictKey = (c: { answer_id: string; field: string; rule: string; before: string }) =>
  `${c.answer_id}|${c.field}|${c.rule}|${c.before}`;

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function runDate(run: string): string {
  return run === '06-DEMO' ? '2026-11-25' : run.slice(0, 10);
}

export function selectReview(rows: ChangeRow[]) {
  const leakCount = rows.filter(r => r.rule !== 'first_person');
  const isNew = (r: ChangeRow) => runDate(r.answer_id.startsWith('06-DEMO') ? '06-DEMO' : r.answer_id.split(':')[0]) >= FP_CUTOFF;
  const fp = rows.filter(r => r.rule === 'first_person');
  const fpNew = fp.filter(isNew);
  const fpOld = fp.filter(r => !isNew(r));
  return { leakCount, fpNew, fpOldSample: seededSample(fpOld, 30, 61) };
}

export function buildReport(
  replays: AnswerReplay[],
  verdicts: Record<string, string> = {},
  reviewText = '',
): { json: Record<string, unknown>; md: string } {
  const rows: ChangeRow[] = replays.flatMap(r =>
    r.changes.map(c => ({
      answer_id: r.answer_id,
      field: c.field,
      rule: c.rule,
      action: c.action,
      before: c.before,
      after: c.after,
      verdict: null as string | null,
    })),
  );
  for (const row of rows) row.verdict = verdicts[verdictKey(row)] ?? null;

  const byRule: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  for (const r of rows) {
    byRule[r.rule] = (byRule[r.rule] ?? 0) + 1;
    byAction[r.action] = (byAction[r.action] ?? 0) + 1;
  }
  const runs = [...new Set(replays.map(r => r.run))];
  const perRun = runs.map(run => {
    const rs = replays.filter(r => r.run === run);
    const cs = rs.flatMap(r => r.changes);
    const n = (rule: string) => cs.filter(c => c.rule === rule).length;
    return {
      run,
      answers: rs.length,
      answers_changed: rs.filter(r => !r.unchanged).length,
      retrieval_leak: n('retrieval_leak'),
      count_claim: n('count_claim'),
      first_person: n('first_person'),
      order_of_work: n('order_of_work'),
      kept_unresolved: cs.filter(c => c.action === 'kept_unresolved').length,
      below_min: rs.filter(r => r.below_min).length,
    };
  });
  const removed = replays.flatMap(r => r.graded_claims_removed.map(c => ({ answer_id: r.answer_id, ...c })));
  const belowMin = replays.filter(r => r.below_min).map(r => ({
    answer_id: r.answer_id,
    before: r.narrative_before,
    after: r.narrative_after,
    explanation_after: r.explanation_after,
  }));

  const must = MUST_CASES.map(mc => {
    const r = replays.find(x => x.answer_id === mc.answer_id);
    return { ...mc, pass: r ? mc.check(r) : false, found: !!r };
  });

  const { leakCount, fpNew, fpOldSample } = selectReview(rows);

  const json = {
    generated_at: new Date().toISOString(),
    guard_version: OUTPUT_GUARD_VERSION,
    answers_total: replays.length,
    answers_changed: replays.filter(r => !r.unchanged).length,
    changes_by_rule: byRule,
    changes_by_action: byAction,
    per_run: perRun,
    changes: rows,
    graded_claims_removed: removed,
    below_min: belowMin,
    must_catch: must.map(m => ({ n: m.n, answer_id: m.answer_id, pass: m.pass })),
  };

  const table = (rs: ChangeRow[]) => {
    const l = ['| # | answer | field | rule | action | before | after | verdict |', '|---|---|---|---|---|---|---|---|'];
    rs.forEach((r, i) =>
      l.push(
        `| ${i + 1} | ${r.answer_id} | ${r.field} | ${r.rule} | ${r.action} | ${cell(r.before)} | ${cell(r.after)} | ${r.verdict ?? '-'} |`,
      ),
    );
    return l;
  };

  const md: string[] = [];
  md.push('# Phase 06.1 guard replay', '');
  md.push('## Totals', '');
  md.push(`- Guard version: ${OUTPUT_GUARD_VERSION}`);
  md.push(`- Answers replayed: ${replays.length}`);
  md.push(`- Answers changed: ${json.answers_changed}`);
  md.push(`- Changes by rule: ${Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  md.push(`- Changes by action: ${Object.entries(byAction).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  md.push('- Spend: $0 (saved answers only, no network)', '');
  md.push('## Per run', '');
  md.push('| run | answers | changed | retrieval_leak | count_claim | first_person | order_of_work | kept_unresolved | below_min |');
  md.push('|---|---|---|---|---|---|---|---|---|');
  for (const p of perRun)
    md.push(
      `| ${p.run} | ${p.answers} | ${p.answers_changed} | ${p.retrieval_leak} | ${p.count_claim} | ${p.first_person} | ${p.order_of_work} | ${p.kept_unresolved} | ${p.below_min} |`,
    );
  md.push('', '## Must-catch', '');
  md.push('| # | case | result |', '|---|---|---|');
  for (const m of must) md.push(`| ${m.n} | ${cell(m.desc)} | ${m.pass ? 'PASS' : m.found ? 'FAIL' : 'FAIL (answer not found)'} |`);
  md.push('', '## Leak and count changes (all)', '', ...table(leakCount));
  md.push('', `## First-person changes (runs from ${FP_CUTOFF}, all)`, '', ...table(fpNew));
  md.push('', '## First-person sample (older runs, 30, seed 61)', '', ...table(fpOldSample));
  md.push('', '## Graded claims the guard removes', '');
  if (!removed.length) md.push('None.');
  else {
    md.push('| answer | claim # | kind | claim |', '|---|---|---|---|');
    for (const c of removed) md.push(`| ${c.answer_id} | ${c.claim_index} | ${c.kind} | ${cell(c.claim.slice(0, 200))} |`);
  }
  md.push('', '## Narrative below minimum after guard', '');
  if (!belowMin.length) md.push('None.');
  else {
    md.push('| answer | sentences before | after | narrative after |', '|---|---|---|---|');
    for (const b of belowMin) md.push(`| ${b.answer_id} | ${b.before} | ${b.after} | ${cell(b.explanation_after)} |`);
  }
  md.push('', '## Review', '');
  md.push(reviewText || 'Pending.');
  md.push('');
  return { json, md: md.join('\n') };
}

function extractReview(file: string): string {
  if (!fs.existsSync(file)) return '';
  const t = fs.readFileSync(file, 'utf-8');
  const i = t.indexOf('## Review');
  if (i < 0) return '';
  const body = t.slice(i + '## Review'.length).trim();
  return body === 'Pending.' ? '' : body;
}

function main() {
  const dir = argValue('--dir');
  const outArg = argValue('--out');
  const prefix = outArg ?? (dir ? path.join(dir, 'guard-replay') : DEFAULT_OUT);
  const answers = loadSavedAnswers(dir ? { dir } : {});
  const replays = replayAnswers(answers);
  const verdictsFile = `${DEFAULT_OUT}.verdicts.json`;
  const verdicts = fs.existsSync(verdictsFile) ? readJson<Record<string, string>>(verdictsFile) : {};
  const { json, md } = buildReport(replays, verdicts, extractReview(`${prefix}.md`));
  fs.writeFileSync(`${prefix}.json`, JSON.stringify(json, null, 2) + '\n');
  fs.writeFileSync(`${prefix}.md`, md);
  console.log(`replayed ${replays.length} answers, changed ${(json as { answers_changed: number }).answers_changed}; wrote ${prefix}.{json,md}`);
}

if (require.main === module) main();
