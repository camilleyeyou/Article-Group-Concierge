/**
 * Second-grader sampling and agreement statistics (EVAL-06).
 *
 * agreementScore = share of (response x criterion) score pairs where the second
 * grader is within 1 point of the primary (Opus) grader.
 */

import { createHash } from 'crypto';
import { CRITERIA, QUERY_TYPES, type Criterion, type GradeRecord } from './lib';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Deterministic stratified sample: round-robin over query types, and within a
 * type order by sha256(seed + id). Returns up to `size` ids.
 */
export function selectSample(
  records: Array<{ id: string; type: string }>,
  size = 15,
  seed = 'eval-06',
): string[] {
  const buckets = QUERY_TYPES.map(t =>
    records
      .filter(r => r.type === t)
      .map(r => ({ id: r.id, key: sha(seed + r.id) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map(r => r.id),
  );
  const out: string[] = [];
  for (let round = 0; out.length < size; round++) {
    let added = false;
    for (const bucket of buckets) {
      if (out.length >= size) break;
      if (round < bucket.length) {
        out.push(bucket[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

/** Quadratic weighted kappa; null when there is no expected disagreement. */
export function quadraticWeightedKappa(a: number[], b: number[], categories = [1, 2, 3, 4, 5]): number | null {
  const n = Math.min(a.length, b.length);
  if (n === 0) return null;
  const k = categories.length;
  const idx = new Map(categories.map((c, i) => [c, i]));
  const observed = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const histA = new Array<number>(k).fill(0);
  const histB = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    const x = idx.get(a[i]);
    const y = idx.get(b[i]);
    if (x === undefined || y === undefined) continue;
    observed[x][y] += 1 / n;
    histA[x] += 1 / n;
    histB[y] += 1 / n;
  }
  let wo = 0;
  let we = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = (i - j) ** 2 / (k - 1) ** 2;
      wo += w * observed[i][j];
      we += w * histA[i] * histB[j];
    }
  }
  if (we < 1e-12) return null;
  return 1 - wo / we;
}

export interface CriterionAgreement {
  exact: number;
  within1: number;
  mad: number;
  qwk: number | null;
}

export interface AgreementResult {
  n: number;
  primary_model: string;
  second_model: string;
  perCriterion: Record<Criterion, CriterionAgreement>;
  overall: { exact: number; within1: number; mad: number };
  agreementScore: number;
  hallucinationAgreement: number;
  unsupportedClaimFlagAgreement: number;
  disagreements: Array<{ id: string; criterion: Criterion; primary: number; second: number }>;
}

const share = (hits: number, total: number) => (total === 0 ? 0 : hits / total);

export function computeAgreement(
  primary: GradeRecord[],
  second: GradeRecord[],
  models: { primary: string; second: string },
): AgreementResult {
  const secondById = new Map(second.filter(g => g.scores).map(g => [g.id, g]));
  const pairs = primary
    .filter(g => g.scores && secondById.has(g.id))
    .map(p => ({ p, s: secondById.get(p.id)! }));

  const perCriterion = {} as Record<Criterion, CriterionAgreement>;
  const disagreements: AgreementResult['disagreements'] = [];
  let exactAll = 0;
  let within1All = 0;
  let diffAll = 0;

  for (const c of CRITERIA) {
    const a = pairs.map(x => x.p.scores![c].score);
    const b = pairs.map(x => x.s.scores![c].score);
    let exact = 0;
    let within1 = 0;
    let diff = 0;
    a.forEach((v, i) => {
      const d = Math.abs(v - b[i]);
      if (d === 0) exact++;
      if (d <= 1) within1++;
      diff += d;
      if (d >= 2) disagreements.push({ id: pairs[i].p.id, criterion: c, primary: v, second: b[i] });
    });
    exactAll += exact;
    within1All += within1;
    diffAll += diff;
    perCriterion[c] = {
      exact: share(exact, a.length),
      within1: share(within1, a.length),
      mad: share(diff, a.length),
      qwk: quadraticWeightedKappa(a, b),
    };
  }

  const total = pairs.length * CRITERIA.length;
  const overall = { exact: share(exactAll, total), within1: share(within1All, total), mad: share(diffAll, total) };

  return {
    n: pairs.length,
    primary_model: models.primary,
    second_model: models.second,
    perCriterion,
    overall,
    agreementScore: overall.within1,
    hallucinationAgreement: share(pairs.filter(x => x.p.hallucination === x.s.hallucination).length, pairs.length),
    unsupportedClaimFlagAgreement: share(
      pairs.filter(x => ((x.p.claims?.length ?? x.p.invented_claims.length) > 0) === ((x.s.claims?.length ?? x.s.invented_claims.length) > 0)).length,
      pairs.length,
    ),
    disagreements,
  };
}
