import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBatches, defaultQuota, PLAN_QUOTA, buildRecord, vantageRefusal, baseUrlRefusal } from './prod-timing';
import { loadQueriesFile, selectQueries, type EvalQuery } from './lib';

function pool(counts: Record<string, number>): EvalQuery[] {
  const out: EvalQuery[] = [];
  for (const [type, n] of Object.entries(counts)) for (let i = 0; i < n; i++) out.push({ id: `${type}-${i}`, type, text: 't' } as unknown as EvalQuery);
  return out;
}
const BIG = pool({ well_formed: 40, vague: 15, off_topic: 8, invention_bait: 8, multi_part: 8 });
const REAL50 = pool({ well_formed: 25, vague: 10, off_topic: 5, invention_bait: 5, multi_part: 5 });

test('plan quota gives 3 disjoint batches of 20 with 10/4/2/2/2 and 2 dry ids in no batch', () => {
  const r = makeBatches(BIG, 6, PLAN_QUOTA);
  const all = r.batches.flatMap(b => b.ids);
  assert.equal(r.batches.length, 3);
  for (const b of r.batches) {
    assert.equal(b.ids.length, 20);
    const n = (t: string) => b.ids.filter(id => id.startsWith(t + '-')).length;
    assert.deepEqual([n('well_formed'), n('vague'), n('off_topic'), n('invention_bait'), n('multi_part')], [10, 4, 2, 2, 2]);
  }
  assert.equal(new Set(all).size, 60);
  assert.equal(r.dry_ids.length, 2);
  for (const d of r.dry_ids) assert.ok(!all.includes(d));
});

test('same seed gives same batches, different seed differs', () => {
  const a = makeBatches(BIG, 6, PLAN_QUOTA);
  const b = makeBatches(BIG, 6, PLAN_QUOTA);
  assert.deepEqual(a.batches, b.batches);
  assert.deepEqual(a.dry_ids, b.dry_ids);
  assert.notDeepEqual(a.batches, makeBatches(BIG, 7, PLAN_QUOTA).batches);
});

test('real pool (includeHeldOut: true, all 75) yields 3 disjoint batches of 20 with the plan quota', () => {
  const real = selectQueries(loadQueriesFile().queries, { includeHeldOut: true });
  assert.equal(real.length, 75);
  const r = makeBatches(real, 6);
  assert.deepEqual(r.batches.map(b => b.ids.length), [20, 20, 20]);
  const all = r.batches.flatMap(b => b.ids);
  assert.equal(new Set(all).size, 60);
  assert.equal(r.dry_ids.length, 2);
  for (const d of r.dry_ids) assert.ok(!all.includes(d));
});

test('defaultQuota helper shrinks to fit a smaller pool (not the CLI default)', () => {
  const q = defaultQuota(REAL50);
  assert.deepEqual(q, { well_formed: 8, vague: 3, off_topic: 1, invention_bait: 1, multi_part: 1 });
  const r = makeBatches(REAL50, 6, q);
  assert.equal(new Set(r.batches.flatMap(b => b.ids)).size, 42);
  assert.equal(r.dry_ids.length, 2);
});

test('makeBatches throws when a type pool is too small', () => {
  assert.throws(() => makeBatches(REAL50, 6, PLAN_QUOTA), /Not enough/);
});

test('buildRecord marks warm-up and aborted-after-hero records', () => {
  const cap = { t_teasers_ms: 900, t_suppressed_ms: null, t_hero_first_ms: 3000, t_hero_done_ms: 3500, t_complete_ms: null, perf: null, error: null };
  const w = buildRecord({ id: 'warmup-1', type: 'warmup', warmup: true, startedAt: 'x', httpStatus: 200, cap, abortedAfterHero: true });
  assert.equal(w.warmup, true);
  assert.equal(w.aborted_after_hero, true);
  const n = buildRecord({ id: 'q', type: 'vague', warmup: false, startedAt: 'x', httpStatus: 200, cap: { ...cap, t_complete_ms: 9000 }, abortedAfterHero: true });
  assert.equal(n.warmup, false);
  assert.equal(n.aborted_after_hero, false);
});

test('vantage and base URL refusals', () => {
  assert.ok(vantageRefusal('CM', false));
  assert.ok(vantageRefusal(null, false));
  assert.equal(vantageRefusal('US', false), null);
  assert.equal(vantageRefusal('CM', true), null);
  assert.ok(baseUrlRefusal('http://localhost:3000', false));
  assert.ok(baseUrlRefusal('http://127.0.0.1:3000', false));
  assert.equal(baseUrlRefusal('http://localhost:3000', true), null);
  assert.equal(baseUrlRefusal('https://article-group-concierge.vercel.app', false), null);
});
