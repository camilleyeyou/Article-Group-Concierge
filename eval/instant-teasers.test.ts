import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  instantSummary, buildInstantTeasers, suppressionReason, decideInstantTeasers, matchesPriorWorkClaim, maxCaseStudySemantic,
} from '../src/lib/instant-teasers';
import type { HybridSearchResult } from '../src/types';

function ch(slug: string, score: number, over: Partial<HybridSearchResult> = {}): HybridSearchResult {
  return {
    chunk_id: slug, document_id: slug, content: '', chunk_type: 'narrative', metadata: {},
    document_title: `Title ${slug}`, document_type: 'case_study', slug, client_name: `Client ${slug}`,
    author: null, vimeo_url: null, thumbnail_url: `https://x/${slug}.webp`,
    similarity_score: score, keyword_score: 0, combined_score: 0, ...over,
  } as HybridSearchResult;
}
const cat = {
  tagsBySlug: new Map([['a', { capabilities: ['Brand'], industries: ['Tech'] }], ['b', { capabilities: [], industries: [] }]]),
  deliverablesBySlug: new Map<string, string | null>([
    ['a', 'Solution included a brand platform and a launch film.'],
    ['b', 'Solution included 3 films.'],
    ['c', null],
  ]),
};

test('instantSummary verbatim, digit or missing -> undefined', () => {
  assert.equal(instantSummary('Solution included a brand platform and a launch film.'), 'Solution included a brand platform and a launch film.');
  assert.equal(instantSummary('Solution included 3 films.'), undefined);
  assert.equal(instantSummary(null), undefined);
  assert.equal(instantSummary(undefined), undefined);
});

test('buildInstantTeasers: first 3 case studies in order, skips articles and duplicates', () => {
  const chunks = [
    ch('art', 0.9, { document_type: 'article' }), ch('a', 0.8), ch('a', 0.7), ch('b', 0.6), ch('c', 0.5), ch('d', 0.4),
  ];
  const t = buildInstantTeasers(chunks, cat, 3);
  assert.deepEqual(t.map(x => x.slug), ['a', 'b', 'c']);
  assert.equal(t[0].title, 'Title a');
  assert.equal(t[0].clientName, 'Client a');
  assert.equal(t[0].thumbnailUrl, 'https://x/a.webp');
  assert.deepEqual(t[0].capabilities, ['Brand']);
  assert.deepEqual(t[0].industries, ['Tech']);
  assert.equal(t[0].summary, 'Solution included a brand platform and a launch film.');
  assert.ok(!('capabilities' in t[1]) && !('industries' in t[1]) && !('summary' in t[1]));
  assert.ok(!('summary' in t[2]) && !('capabilities' in t[2]));
});

test('buildInstantTeasers with null catalogue and null client/thumbnail', () => {
  const t = buildInstantTeasers([ch('a', 0.8, { client_name: null, thumbnail_url: null })], null, 3);
  assert.deepEqual(t, [{ title: 'Title a', slug: 'a' }]);
});

test('suppressionReason order and floor override', () => {
  const good = [ch('a', 0.5)];
  assert.equal(suppressionReason('x', [], {}), 'no_case_studies');
  assert.equal(suppressionReason('x', [ch('art', 0.9, { document_type: 'article' })]), 'no_case_studies');
  assert.equal(suppressionReason('where are your offices located', good), 'about_ag');
  assert.equal(suppressionReason('I heard you ran the Acme launch', good), 'claim_pattern');
  assert.equal(suppressionReason('brand for a bank', [ch('a', 0.39)]), 'score_floor');
  assert.equal(suppressionReason('brand for a bank', good), null);
  assert.equal(suppressionReason('brand for a bank', [ch('a', 0.43)], { floor: 0.45 }), 'score_floor');
  assert.equal(maxCaseStudySemantic([ch('a', 0.2), ch('b', 0.6)]), 0.6);
  assert.equal(maxCaseStudySemantic([]), null);
});

test('decideInstantTeasers', () => {
  const s = decideInstantTeasers('brand for a bank', [ch('a', 0.3)], cat);
  assert.deepEqual(s, { teasers: [], suppressed: 'score_floor', maxSemantic: 0.3 });
  const ok = decideInstantTeasers('brand for a bank', [ch('a', 0.6), ch('b', 0.5), ch('c', 0.5), ch('d', 0.5)], cat);
  assert.equal(ok.suppressed, null);
  assert.equal(ok.teasers.length, 3);
  assert.equal(ok.maxSemantic, 0.6);
});

test('claim pattern: synthetic positives and negatives', () => {
  for (const q of [
    'I heard you ran the Acme launch', 'I was told you designed the Globex identity',
    "my boss said you launched Initech's app", 'I understand you handled the Umbrella rebrand',
    "someone told me you built Hooli's site",
  ]) assert.ok(matchesPriorWorkClaim(q), q);
  for (const q of [
    'Have you worked with fintech clients?', 'What did you build for Salt?', 'I heard about your work, what do you do?',
    'Did you make videos?', 'Tell me what you delivered for Google', 'I said we need a rebrand',
  ]) assert.ok(!matchesPriorWorkClaim(q), q);
});
