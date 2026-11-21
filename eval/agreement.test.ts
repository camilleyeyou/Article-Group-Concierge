import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAgreement, quadraticWeightedKappa, selectSample } from './agreement';
import { CRITERIA, QUERY_TYPES, type Criterion, type GradeRecord } from './lib';

function baselineRecords() {
  const counts: Record<string, number> = { well_formed: 25, vague: 10, off_topic: 5, invention_bait: 5, multi_part: 5 };
  const out: Array<{ id: string; type: string }> = [];
  for (const t of QUERY_TYPES) for (let i = 0; i < counts[t]; i++) out.push({ id: `${t}-${i}`, type: t });
  return out;
}

function grade(id: string, scores: Partial<Record<Criterion, number>>, extra: Partial<GradeRecord> = {}): GradeRecord {
  const full = Object.fromEntries(CRITERIA.map(c => [c, { score: scores[c] ?? 3, reason: '' }])) as GradeRecord['scores'];
  return {
    id,
    grader_model: 'm',
    graded_at: '',
    skipped: null,
    grader_error: null,
    scores: full,
    invented_claims: [],
    claims: [],
    context_relevant: true,
    would_strict_pass_fallback: true,
    hallucination: false,
    automated_checks: null,
    ...extra,
  };
}

test('selectSample returns 15 distinct ids, 3 per type', () => {
  const recs = baselineRecords();
  const ids = selectSample(recs, 15, 'eval-06');
  assert.equal(ids.length, 15);
  assert.equal(new Set(ids).size, 15);
  for (const t of QUERY_TYPES) {
    assert.equal(ids.filter(id => recs.find(r => r.id === id)!.type === t).length, 3);
  }
});

test('selectSample is deterministic', () => {
  const recs = baselineRecords();
  assert.deepEqual(selectSample(recs, 15, 'eval-06'), selectSample(recs, 15, 'eval-06'));
});

test('selectSample larger than records returns all', () => {
  const recs = baselineRecords();
  assert.equal(selectSample(recs, 500).length, recs.length);
});

test('qwk perfect agreement is 1', () => {
  assert.equal(quadraticWeightedKappa([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 1);
});

test('qwk total opposition is -1', () => {
  assert.equal(quadraticWeightedKappa([1, 5], [5, 1]), -1);
});

test('qwk is null with no expected disagreement', () => {
  assert.equal(quadraticWeightedKappa([5, 5, 5], [5, 5, 5]), null);
});

test('computeAgreement per-criterion stats', () => {
  const ids = ['a', 'b', 'c'];
  const pv = [1, 3, 5];
  const sv = [2, 3, 4];
  const p = ids.map((id, i) => grade(id, { grounded: pv[i] }));
  const s = ids.map((id, i) => grade(id, { grounded: sv[i] }));
  const r = computeAgreement(p, s, { primary: 'p', second: 's' });
  assert.equal(r.n, 3);
  assert.ok(Math.abs(r.perCriterion.grounded.exact - 1 / 3) < 1e-9);
  assert.equal(r.perCriterion.grounded.within1, 1);
  assert.ok(Math.abs(r.perCriterion.grounded.mad - 2 / 3) < 1e-9);
});

test('agreementScore is the share of pairs within 1; disagreements list diffs >= 2', () => {
  const p = [grade('a', { grounded: 5, voice: 1 })];
  const s = [grade('a', { grounded: 2, voice: 2 })];
  const r = computeAgreement(p, s, { primary: 'p', second: 's' });
  // 5 criteria: grounded differs by 3, the other 4 differ by 0 or 1
  assert.equal(r.agreementScore, 4 / 5);
  assert.deepEqual(r.disagreements, [{ id: 'a', criterion: 'grounded', primary: 5, second: 2 }]);
});

test('flag agreement and unpaired ids', () => {
  const p = [
    grade('a', {}, { hallucination: true, claims: [{ claim: 'x', kind: 'other' }] }),
    grade('b', {}, { hallucination: false }),
    grade('only-primary', {}),
  ];
  const s = [grade('a', {}, { hallucination: true, claims: [] }), grade('b', {}, { hallucination: false })];
  const r = computeAgreement(p, s, { primary: 'p', second: 's' });
  assert.equal(r.n, 2);
  assert.equal(r.hallucinationAgreement, 1);
  assert.equal(r.unsupportedClaimFlagAgreement, 0.5);
});
