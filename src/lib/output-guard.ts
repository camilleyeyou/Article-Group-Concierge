/**
 * Phase 06.1 GUARD-01: deterministic post-generation guard. No model calls.
 * Rules: retrieval_leak (drop sentence), count_claim (rewrite), first_person (rewrite).
 *
 * Pure module: no I/O. The only env read is in outputGuardEnabled().
 */
import type { LayoutPlan } from '../types';
import { ABBREVIATIONS } from './sentences';

export const OUTPUT_GUARD_VERSION = 1;

export type GuardRule = 'retrieval_leak' | 'count_claim' | 'first_person' | 'order_of_work';
export type GuardAction = 'drop_sentence' | 'rewrite' | 'kept_unresolved';
export interface GuardChange {
  field: string;
  rule: GuardRule;
  action: GuardAction;
  before: string;
  after: string;
}
export interface GuardReport {
  version: number;
  changes: GuardChange[];
}
export interface GuardTextOptions {
  firstPerson?: boolean; // default true
  orderOfWork?: boolean; // default false; set for teaser summaries only
}

export function outputGuardEnabled(): boolean {
  return process.env.OUTPUT_GUARD_ENABLED !== 'false';
}

/** Retrieval-wording leaks: the sentence is dropped. Exported for the replay report. */
export const LEAK_PATTERNS: RegExp[] = [
  /\b(?:we|I|we've|I've|we have|I have|haven't|have not)\s+(?:pulled up|retrieved)\b/i,
  /\bwhat we pulled up\b/i,
  /\b(?:wasn't|was not|weren't|were not|isn't|is not|aren't|are not|not)\s+retrieved\b/i,
  /\bretrieved\s+(?:here|for this question|for this|so far)\b/i,
  /\b(?:the|no|any|closest)\s+retrieved\s+(?:work|material|materials|case stud(?:y|ies)|studies|examples?|content|context|projects?|selection)\b/i,
  /\bin front of (?:me|us)\b/i,
  /\bnothing we hold\b/i,
  /\bthe materials? (?:we|I) have\b/i,
  /\b(?:work|portfolio) (?:we|I) have on record\b/i,
  /\bsearch results\b/i,
];

type TextChange = Omit<GuardChange, 'field'>;

// --- lossless sentence spans -------------------------------------------------

const DOT = '\u0000';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ABBR_RE = new RegExp('(?<![A-Za-z])(' + ABBREVIATIONS.map(escapeRe).join('|') + ')', 'g');
const BOUNDARY_RE = /(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘(\[]?\*{0,2}[A-Z0-9])/g;

interface Span {
  sentence: string;
  sep: string;
}

/** Split the original text into sentence + separator spans so that joining them rebuilds it exactly. */
function splitSpans(text: string): Span[] {
  // Masking keeps the string length, so indices from the masked copy apply to the original.
  const masked = text.replace(ABBR_RE, m => m.replace(/\./g, DOT));
  const spans: Span[] = [];
  let last = 0;
  for (const m of masked.matchAll(BOUNDARY_RE)) {
    const idx = m.index as number;
    spans.push({ sentence: text.slice(last, idx), sep: text.slice(idx, idx + m[0].length) });
    last = idx + m[0].length;
  }
  spans.push({ sentence: text.slice(last), sep: '' });
  return spans;
}

// --- rule: retrieval_leak ----------------------------------------------------

function isLeak(sentence: string): boolean {
  return LEAK_PATTERNS.some(re => re.test(sentence));
}

function dropLeaks(text: string, changes: TextChange[]): string {
  const spans = splitSpans(text);
  const leaks = spans.filter(s => isLeak(s.sentence));
  if (leaks.length === 0) return text;
  const kept = spans.filter(s => !isLeak(s.sentence));
  if (!kept.some(s => /[A-Za-z]/.test(s.sentence))) {
    for (const l of leaks) {
      changes.push({ rule: 'retrieval_leak', action: 'kept_unresolved', before: l.sentence, after: l.sentence });
    }
    return text;
  }
  for (const l of leaks) {
    changes.push({ rule: 'retrieval_leak', action: 'drop_sentence', before: l.sentence, after: '' });
  }
  // A dropped final sentence leaves a dangling separator on the last kept span.
  if (isLeak(spans[spans.length - 1].sentence)) kept[kept.length - 1] = { ...kept[kept.length - 1], sep: '' };
  return kept.map(s => s.sentence + s.sep).join('');
}

// --- rule: count_claim -------------------------------------------------------

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function rewriteCounts(text: string, changes: TextChange[]): string {
  const rec = (before: string, after: string) => {
    changes.push({ rule: 'count_claim', action: 'rewrite', before, after });
    return after;
  };
  let t = text;
  // a: "our two security examples" -> "two of our security examples"
  t = t.replace(
    /\b([Oo])ur (two|three|four|five) ((?:[\w-]+ ){0,2}?)(examples|studies|case studies|projects|engagements|clients)\b/g,
    (m, o: string, n: string, adjs: string, noun: string) =>
      rec(m, `${o === 'O' ? cap(n) : n} of our ${adjs}${noun}`),
  );
  // b: "the two cybersecurity studies in our portfolio" -> "two of the cybersecurity studies ..."
  t = t.replace(
    /\b([Tt])he (two|three|four|five) ((?:[\w-]+ ){0,2}?)(examples|studies|case studies|projects|engagements)(?= (?:in our portfolio|in our published work|we[’']ve published|we have published|we have\b))/g,
    (m, o: string, n: string, adjs: string, noun: string) =>
      rec(m, `${o === 'T' ? cap(n) : n} of the ${adjs}${noun}`),
  );
  // c: "the only co-branded video study in our portfolio" -> "a co-branded video study ..."
  t = t.replace(
    /\b([Tt])he only ((?:[\w-]+ ){0,3}?)(example|study|case study|project|engagement|video|film)(?= (?:in our portfolio|in our published work|we[’']ve published|we have published))/g,
    (m, o: string, words: string, noun: string) => {
      const art = /^[aeiou]/i.test(words + noun) ? 'an' : 'a';
      return rec(m, `${o === 'T' ? cap(art) : art} ${words}${noun}`);
    },
  );
  // d: "Our cybersecurity work covers two projects" -> "Our cybersecurity work includes these two projects"
  t = t.replace(
    /\b([Oo])ur ([\w-]+) work (?:covers|includes|is) (two|three|four|five)\b/g,
    (m, o: string, x: string, n: string) => rec(m, `${o}ur ${x} work includes these ${n}`),
  );
  return t;
}

// --- rule: first_person ------------------------------------------------------

const FP_WORDS =
  "can['’]t|cannot|won['’]t|haven['’]t|don['’]t|didn['’]t|have|can|would|will|am|held|left|need|think|want|see|could|should|did";
const FP_RE = new RegExp(
  `(?<![A-Za-z0-9./'’"“‘-])I(?:(['’])(m|d|ve|ll)(?![A-Za-z])|\\s+(${FP_WORDS})(?![\\w'’]))`,
  'g',
);
const SENTENCE_START_RE = /(?:^|[.!?]["'”’)]?\s+|\n)$/;

function rewriteFirstPerson(text: string, changes: TextChange[]): string {
  return text.replace(FP_RE, (m: string, apos: string | undefined, contraction: string | undefined, word: string | undefined, offset: number) => {
    let after: string;
    if (apos && contraction) {
      after = contraction === 'm' ? `we${apos}re` : `we${apos}${contraction}`;
    } else {
      after = `we ${word}`;
      if (word === 'am') after = 'we are';
    }
    if (SENTENCE_START_RE.test(text.slice(0, offset))) after = cap(after);
    changes.push({ rule: 'first_person', action: 'rewrite', before: m, after });
    return after;
  });
}

// --- rule: order_of_work (teaser summaries only) -----------------------------

/** ", starting with a research discovery report" -> ", including a research discovery report": claims no sequence. */
function rewriteOrderOfWork(text: string, changes: TextChange[]): string {
  return text.replace(/,\s*(?:starting|beginning) with (an?|the) /g, (m: string, art: string) => {
    const after = `, including ${art} `;
    changes.push({ rule: 'order_of_work', action: 'rewrite', before: m, after });
    return after;
  });
}

// --- public API --------------------------------------------------------------

export function guardText(text: string, opts: GuardTextOptions = {}): { text: string; changes: TextChange[] } {
  const changes: TextChange[] = [];
  if (!text) return { text, changes };
  let t = dropLeaks(text, changes);
  t = rewriteCounts(t, changes);
  if (opts.firstPerson !== false) t = rewriteFirstPerson(t, changes);
  if (opts.orderOfWork) t = rewriteOrderOfWork(t, changes);
  return { text: t, changes };
}

const GUARDED_PROPS: Record<string, string[]> = {
  HeroBlock: ['title', 'subtitle', 'challengeSummary'],
  StrategyCard: ['title', 'content'],
  CaseStudyTeaser: ['summary'],
  VideoPlayer: ['caption'],
  VisualAsset: ['caption'],
};

export function guardOutputText(
  layout: LayoutPlan,
  explanation: string,
): { layout: LayoutPlan; explanation: string; report: GuardReport } {
  const out: LayoutPlan = structuredClone(layout);
  const all: GuardChange[] = [];
  const run = (value: unknown, field: string, opts: GuardTextOptions = {}): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const r = guardText(value, opts);
    for (const c of r.changes) all.push({ field, ...c });
    return r.text;
  };

  (out.layout ?? []).forEach((item, i) => {
    const props = item.props as unknown as Record<string, unknown>;
    for (const prop of GUARDED_PROPS[item.component] ?? []) {
      const next = run(props[prop], `layout[${i}].${item.component}.${prop}`, {
        orderOfWork: item.component === 'CaseStudyTeaser' && prop === 'summary',
      });
      if (next !== undefined) props[prop] = next;
    }
    if (item.component === 'MetricGrid' && Array.isArray(props.stats)) {
      (props.stats as Array<Record<string, unknown>>).forEach((stat, j) => {
        const next = run(stat.context, `layout[${i}].MetricGrid.stats[${j}].context`);
        if (next !== undefined) stat.context = next;
      });
    }
  });

  const guardedExplanation = run(explanation, 'explanation') ?? explanation;
  return { layout: out, explanation: guardedExplanation, report: { version: OUTPUT_GUARD_VERSION, changes: all } };
}
