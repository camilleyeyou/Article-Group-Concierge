import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { suppressionReason, matchesPriorWorkClaim } from '../src/lib/instant-teasers';
import type { HybridSearchResult } from '../src/types';

interface Rec { id: string; type: string; query: string; fallback_expected: boolean; case_studies: { slug: string; similarity_score: number }[] }
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'phase4-retrieval-scores.json'), 'utf8')) as { records: Rec[] };

const chunks = (r: Rec) =>
  r.case_studies.map(c => ({ document_type: 'case_study', slug: c.slug, similarity_score: c.similarity_score }) as HybridSearchResult);
// Calibration (D-504) counts floor + claim pattern only. isAboutAG also fires on p4-q03 ("early-career" hits the
// 'career' keyword), so the full function suppresses that known miss by accident; it is checked separately below.
const suppressed = (r: Rec, floor: number) => {
  const reason = suppressionReason(r.query, chunks(r), { floor });
  return reason === 'about_ag' ? null : reason;
};

function stats(floor: number) {
  const fallback = fx.records.filter(r => r.fallback_expected);
  const direct = fx.records.filter(r => !r.fallback_expected);
  const bait = fx.records.filter(r => r.type === 'invention_bait');
  return {
    fallback, direct, bait,
    fbSup: fallback.filter(r => suppressed(r, floor)),
    fbMiss: fallback.filter(r => !suppressed(r, floor)).map(r => r.id).sort(),
    baitSup: bait.filter(r => suppressed(r, floor)),
    directSup: direct.filter(r => suppressed(r, floor)).map(r => r.id).sort(),
  };
}

test('fixture shape', () => {
  assert.equal(fx.records.length, 50);
});

test('floor 0.40: 19/21 fallback, 5/5 bait via claim_pattern, 4/29 direct false-suppressed', () => {
  const s = stats(0.4);
  assert.equal(s.fallback.length, 21);
  assert.equal(s.fbSup.length, 19);
  assert.deepEqual(s.fbMiss, ['p4-q03', 'p4-q07']);
  assert.equal(s.bait.length, 5);
  assert.equal(s.baitSup.length, 5);
  for (const r of s.bait) assert.equal(suppressed(r, 0.4), 'claim_pattern');
  assert.equal(s.direct.length, 29);
  assert.deepEqual(s.directSup, ['p2-q03', 'p2-q05', 'p2-q06', 'p4-q06']);
});

test('floor 0.45: 20/21 fallback, 5/5 bait, 8/29 direct', () => {
  const s = stats(0.45);
  assert.equal(s.fbSup.length, 20);
  assert.equal(s.baitSup.length, 5);
  assert.equal(s.directSup.length, 8);
});

test('claim pattern matches exactly the invention_bait queries', () => {
  const hit = fx.records.filter(r => matchesPriorWorkClaim(r.query)).map(r => r.id).sort();
  const bait = fx.records.filter(r => r.type === 'invention_bait').map(r => r.id).sort();
  assert.deepEqual(hit, bait);
  assert.deepEqual(bait, ['p1-q09', 'p2-q09', 'p3-q09', 'p4-q09', 'p5-q09']);
});

test('full suppressionReason also catches p4-q03 via about_ag ("early-career"), by accident not by score', () => {
  const r = fx.records.find(x => x.id === 'p4-q03')!;
  assert.equal(suppressionReason(r.query, chunks(r), { floor: 0.4 }), 'about_ag');
  const full = fx.records.filter(x => x.fallback_expected && suppressionReason(x.query, chunks(x), { floor: 0.4 }));
  assert.equal(full.length, 20);
  const directFull = fx.records.filter(x => !x.fallback_expected && suppressionReason(x.query, chunks(x), { floor: 0.4 })).map(x => x.id).sort();
  assert.deepEqual(directFull, ['p2-q03', 'p2-q05', 'p2-q06', 'p4-q06']);
});
