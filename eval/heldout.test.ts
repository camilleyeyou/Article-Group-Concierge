import * as fs from 'fs';
import { HELD_OUT_SHA256, heldOutDigest } from './labels';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHeldOut, selectQueries, type EvalQuery } from './lib';
import { HELD_OUT_ID_PATTERN } from './subsets';

function q(id: string, persona = 'p1', held = false): EvalQuery {
  return {
    id,
    persona_id: persona,
    type: 'well_formed',
    text: `text ${id}`,
    expected: {} as EvalQuery['expected'],
    ...(held ? { held_out: true } : {}),
  };
}

const normal = Array.from({ length: 50 }, (_, i) => q(`p${(i % 5) + 1}-q${String(i + 1).padStart(2, '0')}`, `p${(i % 5) + 1}`));
const held = [q('p1-h01', 'p1', true), q('p2-h02', 'p2', true)];
const all = [...normal.slice(0, 25), held[0], ...normal.slice(25), held[1]];

test('isHeldOut flags only held_out === true', () => {
  assert.equal(isHeldOut({ held_out: true }), true);
  assert.equal(isHeldOut({}), false);
  assert.equal(isHeldOut({ held_out: false }), false);
});

test('default selection excludes held-out', () => {
  const out = selectQueries(all);
  assert.equal(out.length, 50);
  assert.ok(out.every(x => !isHeldOut(x)));
});

test('includeHeldOut returns all in original order', () => {
  const out = selectQueries(all, { includeHeldOut: true });
  assert.equal(out.length, 52);
  assert.deepEqual(out.map(x => x.id), all.map(x => x.id));
});

test('held-out ids without proof throw D-602 error', () => {
  assert.throws(() => selectQueries(all, { ids: ['p1-h01'] }), (e: Error) => /held-out/i.test(e.message) && e.message.includes('D-602'));
});

test('held-out ids with includeHeldOut are returned', () => {
  const out = selectQueries(all, { ids: ['p1-h01'], includeHeldOut: true });
  assert.deepEqual(out.map(x => x.id), ['p1-h01']);
});

test('unknown ids throw', () => {
  assert.throws(() => selectQueries(all, { ids: ['nope'] }), /Unknown query ids: nope/);
});

test('heldOutOnly returns only held-out', () => {
  const out = selectQueries(all, { heldOutOnly: true });
  assert.deepEqual(out.map(x => x.id), ['p1-h01', 'p2-h02']);
});

test('persona and limit apply after held-out filtering', () => {
  const out = selectQueries(all, { persona: 'p1', limit: 3 });
  assert.equal(out.length, 3);
  assert.ok(out.every(x => x.persona_id === 'p1' && !isHeldOut(x)));
});

test('ids keep file order', () => {
  const out = selectQueries(all, { ids: ['p2-q02', 'p1-q01'] });
  assert.deepEqual(out.map(x => x.id), ['p1-q01', 'p2-q02']);
});

test('HELD_OUT_ID_PATTERN matches p1-h01..p5-h05 style ids only', () => {
  assert.ok(HELD_OUT_ID_PATTERN.test('p1-h01'));
  assert.ok(HELD_OUT_ID_PATTERN.test('p5-h05'));
  assert.ok(!HELD_OUT_ID_PATTERN.test('p1-q01'));
  assert.ok(!HELD_OUT_ID_PATTERN.test('p6-h01'));
});

test('held-out labels are frozen (D-603)', () => {
  const queries = JSON.parse(fs.readFileSync('eval/queries.json', 'utf8')).queries as Array<{ held_out?: boolean }>;
  assert.equal(queries.filter((x) => x.held_out === true).length, 25);
  assert.equal(heldOutDigest(queries), HELD_OUT_SHA256, 'Held-out labels changed after approval (D-603). Do not edit them.');
});
