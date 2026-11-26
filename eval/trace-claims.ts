/**
 * Trace each unsupported claim the grader flagged to the text that produced it.
 *
 * Offline and free: reads saved runs only (no network, no database).
 *
 * Usage:
 *   npx tsx eval/trace-claims.ts [--dir eval/results/<run>] [--overrides <path>] [--out <prefix>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { argValue, parseLayout, readJson, RESULTS_DIR, type GradesFile, type RunFile, type RunRecord } from './lib';

export type TraceSource =
  | 'hero'
  | 'hero_unseen'
  | 'strategy_card'
  | 'teaser_summary'
  | 'video_caption'
  | 'metric'
  | 'other_field'
  | 'narrative'
  | 'unmatched';

export interface TraceField {
  source: TraceSource;
  field: string;
  text: string;
}

export interface Override {
  run: string;
  id: string;
  claim_index: number;
  source: TraceSource;
  note?: string;
}

export interface ClaimTrace {
  run: string;
  id: string;
  claim_index: number;
  kind: string;
  claim: string;
  sources: TraceSource[];
  fields: string[];
  method: 'quote' | 'overlap' | 'override' | 'none';
}

export interface RunTrace {
  run: string;
  harness_version: number;
  graded: number;
  claims: ClaimTrace[];
  hero_gap: { records: number; user_hero_differs_from_graded_hero: number };
}

const DEFAULT_OVERRIDES = '.planning/phases/06.1-output-guard-and-claim-tracing/06.1-TRACE-OVERRIDES.json';
const DEFAULT_OUT = '.planning/phases/06.1-output-guard-and-claim-tracing/06.1-TRACE';

const STOPWORDS = new Set(
  'the and for with that this from are was were has have had our their they its not but you your can will would into than then them these those which what when where who how all any some more most other such only also over under about between each both out per via too very just'.split(
    ' ',
  ),
);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quoted passages in a grader claim, with '...' / ellipsis splitting a quote into parts. */
export function claimFragments(claim: string): string[] {
  const text = claim.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"');
  const quoted: string[] = [];
  // Double-quoted passages
  for (const m of text.matchAll(/"([^"]+)"/g)) quoted.push(m[1]);
  // Single-quoted passages: opening quote not preceded by a letter (avoids apostrophes), closing not followed by a letter
  for (const m of text.matchAll(/(?<![A-Za-z0-9])'([^']+?)'(?![A-Za-z0-9])/g)) quoted.push(m[1]);
  const out: string[] = [];
  for (const q of quoted) {
    for (const part of q.split(/\.{3}|…/)) {
      const t = part.trim();
      if (t.length >= 8) out.push(t);
    }
  }
  return out;
}

function pushStrings(out: Array<{ key: string; text: string }>, prefix: string, value: unknown): void {
  if (typeof value === 'string') {
    if (value.trim()) out.push({ key: prefix, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => pushStrings(out, `${prefix}[${i}]`, v));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) pushStrings(out, `${prefix}.${k}`, v);
  }
}

function heroOf(layout: Array<{ component: string; props: Record<string, unknown> }> | null | undefined) {
  return layout?.find(i => i.component === 'HeroBlock')?.props ?? null;
}

function userLayout(record: RunRecord) {
  const l = record.response?.layoutPlan?.layout as unknown;
  return Array.isArray(l) ? (l as Array<{ component: string; props: Record<string, unknown> }>) : null;
}

function userHeroDiffers(record: RunRecord): boolean {
  const graded = heroOf(parseLayout(record.raw_response));
  const seen = heroOf(userLayout(record));
  if (!graded || !seen) return false;
  return graded.title !== seen.title || graded.challengeSummary !== seen.challengeSummary;
}

/** Text fields in the form the grader saw them (raw_response), plus the narrative. */
export function graderViewFields(record: RunRecord): TraceField[] {
  const layout = parseLayout(record.raw_response) ?? userLayout(record) ?? [];
  const differs = userHeroDiffers(record);
  const fields: TraceField[] = [];
  layout.forEach((item, idx) => {
    const strings: Array<{ key: string; text: string }> = [];
    pushStrings(strings, '', item.props ?? {});
    for (const { key, text } of strings) {
      const prop = key.replace(/^\./, '');
      const field = `${item.component}[${idx}].${prop}`;
      let source: TraceSource = 'other_field';
      if (item.component === 'HeroBlock') source = differs ? 'hero_unseen' : 'hero';
      else if (item.component === 'StrategyCard') source = 'strategy_card';
      else if (item.component === 'CaseStudyTeaser' && prop === 'summary') source = 'teaser_summary';
      else if (item.component === 'VideoPlayer') source = 'video_caption';
      else if (item.component === 'MetricGrid') source = 'metric';
      fields.push({ source, field, text });
    }
  });
  const explanation = record.response?.explanation;
  if (typeof explanation === 'string' && explanation.trim()) {
    fields.push({ source: 'narrative', field: 'explanation', text: explanation });
  }
  return fields;
}

function tokens(s: string): Set<string> {
  return new Set(
    normalizeText(s)
      .split(' ')
      .filter(w => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
}

function attribute(claim: string, fields: TraceField[]): Pick<ClaimTrace, 'sources' | 'fields' | 'method'> {
  const frags = claimFragments(claim).map(normalizeText).filter(Boolean);
  if (frags.length) {
    const hits = fields.filter(f => {
      const n = normalizeText(f.text);
      return frags.some(fr => n.includes(fr));
    });
    if (hits.length) {
      return {
        sources: [...new Set(hits.map(h => h.source))],
        fields: hits.map(h => h.field),
        method: 'quote',
      };
    }
  }
  const claimTokens = tokens(claim.split(' (')[0]);
  if (claimTokens.size) {
    let best = 0;
    let bestFields: TraceField[] = [];
    for (const f of fields) {
      let fieldBest = 0;
      for (const s of sentences(f.text)) {
        const st = tokens(s);
        let common = 0;
        claimTokens.forEach(t => {
          if (st.has(t)) common++;
        });
        fieldBest = Math.max(fieldBest, common / claimTokens.size);
      }
      if (fieldBest > best + 1e-9) {
        best = fieldBest;
        bestFields = [f];
      } else if (Math.abs(fieldBest - best) < 1e-9 && fieldBest > 0) {
        bestFields.push(f);
      }
    }
    if (best >= 0.5) {
      return {
        sources: [...new Set(bestFields.map(h => h.source))],
        fields: bestFields.map(h => h.field),
        method: 'overlap',
      };
    }
  }
  return { sources: ['unmatched'], fields: [], method: 'none' };
}

export function heroGap(run: RunFile): RunTrace['hero_gap'] {
  return {
    records: run.records.length,
    user_hero_differs_from_graded_hero: run.records.filter(userHeroDiffers).length,
  };
}

export function traceRun(dir: string, overrides: Override[] = []): RunTrace {
  const run = readJson<RunFile>(path.join(dir, 'responses.json'));
  const gradesFile = readJson<GradesFile>(path.join(dir, 'grades.json'));
  const name = path.basename(dir);
  const byId = new Map(run.records.map(r => [r.id, r]));
  const claims: ClaimTrace[] = [];
  for (const g of gradesFile.grades) {
    const record = byId.get(g.id);
    (g.claims ?? []).forEach((c, claim_index) => {
      const base = { run: name, id: g.id, claim_index, kind: c.kind, claim: c.claim };
      const ov = overrides.find(o => o.run === name && o.id === g.id && o.claim_index === claim_index);
      if (ov) {
        claims.push({ ...base, sources: [ov.source], fields: ov.note ? [ov.note] : [], method: 'override' });
        return;
      }
      const a = record ? attribute(c.claim, graderViewFields(record)) : { sources: ['unmatched' as TraceSource], fields: [], method: 'none' as const };
      claims.push({ ...base, ...a });
    });
  }
  return {
    run: name,
    harness_version: gradesFile.harness_version ?? 0,
    graded: gradesFile.grades.length,
    claims,
    hero_gap: heroGap(run),
  };
}

// ---------- report ----------

const LATEST = '2026-11-25T14-30-56';

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderReport(traces: RunTrace[]): string {
  const all = traces.flatMap(t => t.claims);
  const methods: Record<string, number> = {};
  for (const c of all) methods[c.method] = (methods[c.method] ?? 0) + 1;
  const lines: string[] = [];
  lines.push('# Phase 06.1 claim trace', '');
  lines.push('## Scope', '');
  lines.push(`- Runs: ${traces.length} (harness v4): ${traces.map(t => `${t.run} (${t.graded})`).join(', ')}`);
  lines.push(`- Claims traced: ${all.length}`);
  lines.push(`- Method counts: ${Object.entries(methods).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  lines.push('- Spend: $0 (saved runs only, no network)', '');

  lines.push(`## Latest run ${LATEST}`, '');
  lines.push('| id | kind | source(s) | field | method | claim |', '|---|---|---|---|---|---|');
  const latest = traces.find(t => t.run === LATEST);
  for (const c of latest?.claims ?? []) {
    lines.push(
      `| ${c.id} | ${c.kind} | ${c.sources.join(', ')} | ${cell(c.fields.join('; ') || '-')} | ${c.method} | ${cell(c.claim.slice(0, 160))} |`,
    );
  }
  lines.push('');

  const full = traces.filter(t => t.graded === 50);
  const pooled = full.flatMap(t => t.claims);
  lines.push('## Pooled full-50 runs', '');
  lines.push(`Runs: ${full.map(t => t.run).join(', ')}. Claims: ${pooled.length}.`, '');
  const kinds = [...new Set(pooled.map(c => c.kind))].sort();
  const srcs = [...new Set(pooled.flatMap(c => c.sources))].sort();
  lines.push(`| source | ${kinds.join(' | ')} | total | share |`, `|---|${kinds.map(() => '---|').join('')}---|---|`);
  for (const s of srcs) {
    const rows = pooled.filter(c => c.sources.includes(s as TraceSource));
    const counts = kinds.map(k => rows.filter(c => c.kind === k).length);
    const share = pooled.length ? ((rows.length / pooled.length) * 100).toFixed(0) : '0';
    lines.push(`| ${s} | ${counts.join(' | ')} | ${rows.length} | ${share}% |`);
  }
  lines.push('', 'A claim found in several fields counts once per source, so shares can exceed 100% in total.', '');

  lines.push('## Hero gap', '');
  lines.push('| run | records | user hero differs from graded hero |', '|---|---|---|');
  for (const t of traces) lines.push(`| ${t.run} | ${t.hero_gap.records} | ${t.hero_gap.user_hero_differs_from_graded_hero} |`);
  lines.push('');

  lines.push('## Unmatched', '');
  const un = all.filter(c => c.sources.includes('unmatched'));
  if (!un.length) lines.push('None.');
  else {
    lines.push('| run | id | claim |', '|---|---|---|');
    for (const c of un) lines.push(`| ${c.run} | ${c.id} | ${cell(c.claim.slice(0, 200))} |`);
  }
  lines.push('', '## Recurring patterns', '');
  return lines.join('\n');
}

function main() {
  const dirArg = argValue('--dir');
  const ovPath = argValue('--overrides') ?? DEFAULT_OVERRIDES;
  const outPrefix = argValue('--out') ?? DEFAULT_OUT;
  const overrides: Override[] = fs.existsSync(ovPath) ? readJson<Override[]>(ovPath) : [];
  const dirs = dirArg
    ? [path.resolve(dirArg)]
    : fs
        .readdirSync(RESULTS_DIR)
        .map(d => path.join(RESULTS_DIR, d))
        .filter(d => {
          const g = path.join(d, 'grades.json');
          return fs.existsSync(g) && fs.existsSync(path.join(d, 'responses.json')) && readJson<GradesFile>(g).harness_version === 4;
        })
        .sort();
  const traces = dirs.map(d => traceRun(d, overrides));
  fs.writeFileSync(`${outPrefix}.json`, JSON.stringify(traces, null, 2) + '\n');
  const mdPath = `${outPrefix}.md`;
  // Keep hand-written sections (Recurring patterns onward) across re-runs
  let tail = '';
  if (fs.existsSync(mdPath)) {
    const old = fs.readFileSync(mdPath, 'utf-8');
    const i = old.indexOf('## Recurring patterns');
    if (i >= 0) tail = old.slice(i + '## Recurring patterns'.length).replace(/^\n+/, '\n');
  }
  fs.writeFileSync(mdPath, renderReport(traces).replace(/\n$/, '') + (tail || '\n'));
  const total = traces.flatMap(t => t.claims);
  console.log(`Traced ${total.length} claims over ${traces.length} runs; unmatched ${total.filter(c => c.sources.includes('unmatched')).length}`);
}

if (require.main === module) main();
