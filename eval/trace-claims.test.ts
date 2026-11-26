import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { claimFragments, graderViewFields, heroGap, traceRun } from './trace-claims';
import type { RunFile, RunRecord } from './lib';

function layoutText(hero: { title: string; challengeSummary: string }, summary: string): string {
  const layout = [
    { component: 'HeroBlock', props: hero },
    { component: 'StrategyCard', props: { title: 'Plan', content: 'We would map the platform first.' } },
    { component: 'CaseStudyTeaser', props: { title: 'Simons', clientName: 'Simons', summary, slug: 'simons' } },
  ];
  return '```json\n' + JSON.stringify({ layout }) + '\n```';
}

function makeRecord(opts: { seenHeroTitle?: string; summary?: string; explanation?: string } = {}): RunRecord {
  const gradedHero = { title: 'Graded hero', challengeSummary: 'Graded challenge.' };
  const seenHero = { title: opts.seenHeroTitle ?? 'Graded hero', challengeSummary: 'Graded challenge.' };
  const summary = opts.summary ?? 'We began with a research discovery report, then built the brand.';
  return {
    id: 'p1-q01',
    query: 'q',
    raw_response: layoutText(gradedHero, summary),
    response: {
      layoutPlan: { layout: JSON.parse(layoutText(seenHero, summary).replace(/```json\n|\n```/g, '')).layout },
      explanation: opts.explanation ?? 'Salt shows our two security examples.',
    },
  } as unknown as RunRecord;
}

test('claimFragments extracts quoted passages and splits on ellipsis', () => {
  const out = claimFragments("Salt ... are 'our two security examples', which ignores the count");
  assert.deepEqual(out, ['our two security examples']);
  assert.deepEqual(claimFragments('says "alpha beta gamma ... delta epsilon zeta" here'), ['alpha beta gamma', 'delta epsilon zeta']);
  assert.deepEqual(claimFragments("quoted 'short' only"), []);
});

test('graderViewFields marks hero as hero_unseen when the user saw a different hero', () => {
  const same = graderViewFields(makeRecord());
  assert.ok(same.some(f => f.source === 'hero'));
  assert.ok(!same.some(f => f.source === 'hero_unseen'));
  const diff = graderViewFields(makeRecord({ seenHeroTitle: 'Fast hero' }));
  assert.ok(diff.some(f => f.source === 'hero_unseen'));
  assert.ok(diff.some(f => f.source === 'teaser_summary'));
  assert.ok(diff.some(f => f.source === 'strategy_card'));
  assert.ok(diff.some(f => f.source === 'narrative' && /two security examples/.test(f.text)));
});

test('graderViewFields falls back to response.layoutPlan when raw_response is null', () => {
  const r = makeRecord();
  r.raw_response = null;
  assert.ok(graderViewFields(r).some(f => f.source === 'teaser_summary'));
});

function writeRun(records: RunRecord[], claims: Array<{ claim: string; kind: string }>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-test-'));
  const run = { records } as unknown as RunFile;
  fs.writeFileSync(path.join(dir, 'responses.json'), JSON.stringify(run));
  fs.writeFileSync(
    path.join(dir, 'grades.json'),
    JSON.stringify({ harness_version: 4, grades: [{ id: records[0].id, claims }] }),
  );
  return dir;
}

test('traceRun attributes by quote, then overlap, then override', () => {
  const dir = writeRun([makeRecord()], [
    { claim: "'our two security examples' ignores the count (the context ...)", kind: 'other' },
    { claim: 'Simons began with a research discovery report and then built the brand (context)', kind: 'other' },
    { claim: 'Totally unrelated zebra astronomy statement', kind: 'other' },
  ]);
  try {
    const t = traceRun(dir, []);
    assert.equal(t.claims[0].method, 'quote');
    assert.deepEqual(t.claims[0].sources, ['narrative']);
    assert.equal(t.claims[1].method, 'overlap');
    assert.ok(t.claims[1].sources.includes('teaser_summary'));
    assert.deepEqual(t.claims[2].sources, ['unmatched']);
    const o = traceRun(dir, [{ run: path.basename(dir), id: 'p1-q01', claim_index: 2, source: 'narrative', note: 'x' }]);
    assert.equal(o.claims[2].method, 'override');
    assert.deepEqual(o.claims[2].sources, ['narrative']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('heroGap counts records whose user hero differs from the graded hero', () => {
  const run = { records: [makeRecord(), makeRecord({ seenHeroTitle: 'Fast hero' })] } as unknown as RunFile;
  assert.deepEqual(heroGap(run), { records: 2, user_hero_differs_from_graded_hero: 1 });
});
