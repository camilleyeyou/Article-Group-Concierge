/**
 * Number normalisation for the deterministic metric check (EVAL-01).
 * Pure module: no imports. "8M+" and "over 8 million" extract to the same quantity.
 */

export type QuantityUnit = 'percent' | 'multiple' | 'plain';
export interface Quantity {
  value: number;
  unit: QuantityUnit;
}

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALES: Record<string, number> = {
  thousand: 1e3, k: 1e3,
  million: 1e6, mn: 1e6, mm: 1e6, m: 1e6,
  billion: 1e9, bn: 1e9, b: 1e9,
  trillion: 1e12, tn: 1e12, t: 1e12,
};

const WORDS = Object.keys(WORD_NUMBERS).join('|');

// 1: number token. 2: optional scale (long words first; short forms must not run into a letter or digit).
// 3: optional unit (percent, multiple) after an optional '+'.
const QUANTITY_RE = new RegExp(
  `(?<![a-z0-9])(\\d+(?:\\.\\d+)?|\\b(?:${WORDS})\\b)` +
    `(?:\\s*(thousand|million|billion|trillion|k|mn|mm|m|bn|b|tn|t)(?![a-z0-9]))?` +
    `(?:\\s*\\+?\\s*(%|percent|per cent|pct|x(?![a-z0-9])|times|-?fold))?`,
  'g',
);

function stripThousandsSeparators(text: string): string {
  let prev: string;
  let out = text;
  do {
    prev = out;
    out = out.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  } while (out !== prev);
  return out;
}

function unitOf(token: string | undefined): QuantityUnit {
  if (!token) return 'plain';
  if (token === '%' || token === 'percent' || token === 'per cent' || token === 'pct') return 'percent';
  return 'multiple';
}

export function extractQuantities(text: string): Quantity[] {
  const cleaned = stripThousandsSeparators(text.toLowerCase());
  const out: Quantity[] = [];
  for (const m of cleaned.matchAll(QUANTITY_RE)) {
    const base = m[1] in WORD_NUMBERS ? WORD_NUMBERS[m[1]] : parseFloat(m[1]);
    const scale = m[2] ? SCALES[m[2]] : 1;
    out.push({ value: base * scale, unit: unitOf(m[3]) });
  }
  return out;
}

export function sameQuantity(a: Quantity, b: Quantity): boolean {
  if (a.unit !== b.unit) return false;
  if (a.value === 0 && b.value === 0) return true;
  return Math.abs(a.value - b.value) <= 0.005 * Math.max(Math.abs(a.value), Math.abs(b.value));
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function metricValueInContext(value: string, contextText: string): boolean {
  const wanted = extractQuantities(value);
  if (wanted.length === 0) return normalize(contextText).includes(normalize(value));
  const available = extractQuantities(contextText);
  return wanted.every((q) => available.some((c) => sameQuantity(q, c)));
}
