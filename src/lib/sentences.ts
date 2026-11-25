/**
 * D-407 narrative sentence count. Shared by the eval check and the 04-07 verifier;
 * the count runs on OrchestratorOutput.explanation (text before the follow-ups).
 */

const ABBREVIATIONS = [
  'e.g.', 'i.e.', 'vs.', 'etc.', 'Inc.', 'Co.', 'Corp.', 'Ltd.', 'U.S.', 'U.K.', 'J.P.', 'Dr.', 'Mr.', 'Ms.', 'Mrs.', 'St.', 'No.',
];
const DOT = '\u0000';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ABBR_RE = new RegExp('(?<![A-Za-z])(' + ABBREVIATIONS.map(escapeRe).join('|') + ')', 'g');

export function splitSentences(text: string): string[] {
  if (!text) return [];
  let t = text
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/`/g, '')
    .replace(/(\*\*|__)/g, '')
    .replace(/(^|[\s(])[*_]+(?=\S)/g, '$1')
    .replace(/(\S)[*_]+(?=[\s.,;:!?)]|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return [];
  t = t.replace(ABBR_RE, m => m.replace(/\./g, DOT));
  const parts = t.split(/(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘(\[]?[A-Z0-9])/);
  return parts
    .map(p => p.replace(new RegExp(DOT, 'g'), '.').trim())
    .filter(p => /[A-Za-z]/.test(p));
}

export function countSentences(text: string | null | undefined): number {
  return text ? splitSentences(text).length : 0;
}
