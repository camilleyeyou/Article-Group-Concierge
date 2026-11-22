import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAPABILITY_KEYWORDS,
  INDUSTRY_KEYWORDS,
  INDUSTRY_GROUPS,
  detectQueryIntent,
  allIntentSlugs,
  keywordHit,
  isAboutAG,
} from '../src/lib/intent-keywords';

const proposal = JSON.parse(readFileSync(join(process.cwd(), 'data', 'taxonomy-proposal.json'), 'utf8'));
const slugsOf = (arr: any[] = []) => arr.map((x) => (typeof x === 'string' ? x : x.slug));
const approvedCaps = new Set(slugsOf(proposal.new_capabilities));
const approvedInds = new Set(slugsOf(proposal.new_industries));

// Frozen copy of the pre-02-04 keyword lists.
const OLD_KEYWORDS = new Set<string>([
  'brand', 'branding', 'rebrand', 'brand identity', 'brand positioning', 'brand architecture',
  'creative', 'visual', 'design', 'art direction', 'look and feel',
  'content', 'storytelling', 'narrative', 'messaging', 'copywriting', 'editorial',
  'social', 'social media', 'instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'community',
  'video', 'film', 'commercial', 'documentary', 'motion', 'animation',
  'digital', 'marketing', 'paid media', 'advertising', 'campaign', 'ads',
  'experiential', 'event', 'activation', 'pop-up', 'launch event', 'experience',
  'web', 'website', 'digital product', 'app', 'platform', 'ux', 'ui',
  'tech', 'technology', 'software', 'saas', 'startup', 'ai', 'fintech', 'b2b tech',
  'finance', 'financial', 'banking', 'investment', 'insurance', 'wealth',
  'health', 'healthcare', 'medical', 'pharma', 'wellness', 'fitness', 'biotech',
  'consumer', 'cpg', 'retail', 'ecommerce', 'dtc', 'food', 'beverage', 'fashion',
  'entertainment', 'media', 'streaming', 'gaming', 'sports', 'music',
  'real estate', 'property', 'commercial real estate', 'residential',
  'education', 'edtech', 'learning', 'university', 'school',
  'nonprofit', 'ngo', 'charity', 'foundation', 'social impact',
]);

function requireApproved(set: Set<string>, slug: string, kind: string): boolean {
  if (!set.has(slug)) {
    console.log(`skip: ${kind} slug ${slug} not in taxonomy-proposal.json new_*`);
    return false;
  }
  return true;
}

test('cybersecurity query maps to cybersecurity industry', () => {
  if (!requireApproved(approvedInds, 'cybersecurity', 'industry')) return;
  assert.ok(detectQueryIntent('Have you done cybersecurity work?').industries.includes('cybersecurity'));
});

test('keynotes query maps to events-keynotes', () => {
  if (!requireApproved(approvedCaps, 'events-keynotes', 'capability')) return;
  assert.ok(detectQueryIntent('do you do keynotes').capabilities.includes('events-keynotes'));
});

test('messaging and positioning query maps to messaging-positioning', () => {
  if (!requireApproved(approvedCaps, 'messaging-positioning', 'capability')) return;
  assert.ok(detectQueryIntent('help with our messaging and positioning').capabilities.includes('messaging-positioning'));
});

test('legacy slugs remapped to real DB slugs', () => {
  assert.ok(detectQueryIntent('any nonprofit clients?').industries.includes('non-profit'));
  assert.ok(detectQueryIntent('media and streaming').industries.includes('media-entertainment'));
  assert.ok(detectQueryIntent('retail and ecommerce').industries.includes('retail'));
  assert.ok(detectQueryIntent('social media campaigns').capabilities.includes('social-strategy'));
  assert.ok(detectQueryIntent('paid media').capabilities.includes('growth-marketing'));
  assert.ok(detectQueryIntent('a new website').capabilities.includes('experience-design'));
});

test('tech query expands to every technology group slug', () => {
  const { industries } = detectQueryIntent('tech companies you have worked with');
  for (const slug of INDUSTRY_GROUPS.technology) assert.ok(industries.includes(slug), slug);
});

test('stale slugs are gone', () => {
  const all = allIntentSlugs();
  const stale = ['social-media', 'digital-marketing', 'experiential', 'web-development', 'consumer', 'entertainment', 'nonprofit'];
  for (const s of stale) {
    assert.ok(!all.capabilities.includes(s), s);
    assert.ok(!all.industries.includes(s), s);
  }
});

test('every new keyword is >= 4 chars or contains a space', () => {
  const offenders: string[] = [];
  for (const map of [CAPABILITY_KEYWORDS, INDUSTRY_KEYWORDS]) {
    for (const kws of Object.values(map)) {
      for (const k of kws) {
        if (!OLD_KEYWORDS.has(k) && k.length < 4 && !k.includes(' ')) offenders.push(k);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

// RETR-02: whole-word
test('keywordHit matches whole words only', () => {
  assert.equal(keywordHit('how do you maintain', 'ai'), false);
  assert.equal(keywordHit('against a bigger incumbent', 'ai'), false);
  assert.equal(keywordHit('ai strategy', 'ai'), true);
  assert.equal(keywordHit('our brands', 'brand'), true);
  assert.equal(keywordHit('keynotes for our ceo', 'keynote'), true);
  assert.equal(keywordHit('approach', 'app'), false);
  assert.equal(keywordHit('a mobile app', 'app'), true);
  assert.equal(keywordHit('go to market plan', 'go-to-market'), true);
  assert.equal(keywordHit('go-to-market plan', 'go-to-market'), true);
  assert.equal(keywordHit('product launch event', 'launch event'), true);
});

test('no false technology intent from "maintain"', () => {
  const { industries } = detectQueryIntent('How do you maintain brand consistency?');
  assert.ok(!industries.includes('technology'));
  for (const m of INDUSTRY_GROUPS.technology) assert.ok(!industries.includes(m), m);
});

test('isAboutAG', () => {
  assert.equal(isAboutAG('Are you hiring?'), true);
  assert.equal(isAboutAG('Where is your office located?'), true);
  assert.equal(isAboutAG('cybersecurity clients?'), false);
  assert.equal(isAboutAG('Have you done keynote work?'), false);
});
