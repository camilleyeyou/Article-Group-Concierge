import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE4_SMOKE_IDS, PHASE6_FIX_IDS, PHASE7_HERO_IDS, HELD_OUT_ID_PATTERN, resolveIds } from './subsets';
import { QUERIES_PATH, readJson, type QueriesFile } from './lib';

test('smoke subset has 21 unique ids that exist in queries.json', () => {
  assert.equal(PHASE4_SMOKE_IDS.length, 21);
  assert.equal(new Set(PHASE4_SMOKE_IDS).size, 21);
  const known = new Set(readJson<QueriesFile>(QUERIES_PATH).queries.map(q => q.id));
  for (const id of PHASE4_SMOKE_IDS) assert.ok(known.has(id), `${id} missing from queries.json`);
});

test('resolveIds handles ids, subset, neither and unknown subset', () => {
  assert.deepEqual(resolveIds({ ids: 'p5-q06, p5-q07' }), ['p5-q06', 'p5-q07']);
  assert.deepEqual(resolveIds({ subset: 'phase4-smoke' }), [...PHASE4_SMOKE_IDS]);
  assert.equal(resolveIds({}), undefined);
  assert.throws(() => resolveIds({ subset: 'nope' }), /phase4-smoke/);
});

test('phase6-fix ids are unique, exist in queries.json and none is held-out', () => {
  assert.equal(PHASE6_FIX_IDS.length, 21);
  assert.equal(new Set(PHASE6_FIX_IDS).size, 21);
  const known = new Set(readJson<QueriesFile>(QUERIES_PATH).queries.map(q => q.id));
  for (const id of PHASE6_FIX_IDS) {
    assert.ok(known.has(id), `${id} missing from queries.json`);
    assert.ok(!HELD_OUT_ID_PATTERN.test(id), `${id} is held-out`);
  }
});

test('phase7-hero has 10 unique ids that exist in queries.json and none is held-out', () => {
  assert.equal(PHASE7_HERO_IDS.length, 10);
  assert.equal(new Set(PHASE7_HERO_IDS).size, 10);
  const known = new Set(readJson<QueriesFile>(QUERIES_PATH).queries.map(q => q.id));
  for (const id of PHASE7_HERO_IDS) {
    assert.ok(known.has(id), `${id} missing from queries.json`);
    assert.ok(!HELD_OUT_ID_PATTERN.test(id), `${id} is held-out`);
  }
  assert.deepEqual(resolveIds({ subset: 'phase7-hero' }), [...PHASE7_HERO_IDS]);
});
