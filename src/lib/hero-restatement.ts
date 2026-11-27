/**
 * Phase 07 HERO-01: deterministic detector for a HeroBlock challengeSummary that
 * restates the user's query. No model calls.
 *
 * Signals: you_opener (starts with "You're / You want ..."), asking_frame
 * ("you're asking / you want / your question" anywhere), verbatim_run (a run of
 * >= HERO_RESTATEMENT_CONFIG.verbatimRun consecutive words copied from the query).
 * Token overlap is reported for information only; it does not separate
 * restating from non-restating heroes, so it is not a signal.
 *
 * Pure module: no I/O. The only env read is in heroRestatementGuardEnabled().
 */

export const HERO_RESTATEMENT_VERSION = 2;
export const HERO_RESTATEMENT_CONFIG = { verbatimRun: 6 } as const;

export type RestatementSignal = 'you_opener' | 'asking_frame' | 'verbatim_run';
export interface RestatementResult {
  restates: boolean;
  signals: RestatementSignal[];
  /** Longest contiguous run of normalized words shared with the query. */
  longestRun: number;
  /** Informational only: share of summary content words found in the query, 0..1, 2 decimals. */
  overlap: number;
  contentTokens: number;
}

export function heroRestatementGuardEnabled(): boolean {
  return process.env.HERO_RESTATEMENT_GUARD_ENABLED !== 'false';
}

// v2 (07-03 replay review): "can" removed ("You can't out-spend a chain" is a reframe).
const YOU_OPENER_RE =
  /^\s*["'“‘]?you(?:['’](?:re|ve|d|ll)\b|\s+(?:are|have|want|need|would|should|might)\b)/i;
// v2 (07-03 replay review): embedded "what you want/need" and "behind your question" are reframes, not frames.
const ASKING_FRAME_RE =
  /\byou(?:['’]re|\s+are)\s+(?:asking|looking|trying|wondering|hoping|after|weighing|deciding)\b|(?<!\bwhat\s)\byou\s+(?:want|need|would like)\b|\byou['’]d\s+like\b|(?<!\b(?:behind|beneath|underneath|under)\s)\byour\s+question\b/i;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'our', 'your', 'you', 'are', 'was', 'were',
  'have', 'has', 'from', 'about', 'into', 'what', 'how', 'can', 'would', 'should', 'they',
  'their', 'them', 'its',
]);

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .split(/[^a-z0-9']+/)
    .filter((t) => t.length > 0);
}

function longestCommonRun(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

function contentTokens(tokens: string[]): string[] {
  return tokens
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => (t.endsWith('s') ? t.slice(0, -1) : t));
}

export function detectHeroRestatement(
  query: string,
  summary: string | null | undefined,
): RestatementResult {
  if (typeof summary !== 'string' || summary.trim() === '') {
    return { restates: false, signals: [], longestRun: 0, overlap: 0, contentTokens: 0 };
  }
  const q = normalize(query ?? '');
  const s = normalize(summary);

  const signals: RestatementSignal[] = [];
  if (YOU_OPENER_RE.test(summary)) signals.push('you_opener');
  if (ASKING_FRAME_RE.test(summary)) signals.push('asking_frame');
  const longestRun = longestCommonRun(q, s);
  if (longestRun >= HERO_RESTATEMENT_CONFIG.verbatimRun) signals.push('verbatim_run');

  const sContent = contentTokens(s);
  const qContent = new Set(contentTokens(q));
  const hits = sContent.filter((t) => qContent.has(t)).length;
  const overlap = sContent.length === 0 ? 0 : Math.round((hits / sContent.length) * 100) / 100;

  return { restates: signals.length > 0, signals, longestRun, overlap, contentTokens: sContent.length };
}
