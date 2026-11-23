import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONCIERGE_CONFIG,
  componentCountRule,
  followUpInstruction,
  noContextMessage,
  isNoContext,
  teaserPromptRule,
  teaserRubricText,
  noDirectMatchPrompt,
  fallbackRubricText,
  retrievalConfigKey,
  narrativeRule,
  strategyLeadPromptRule,
  keywordTriggers,
  isVideoQuery,
  verifierEnabled,
  STRATEGY_LEAD_TRIGGER_DESCRIPTIONS,
} from '../src/lib/concierge-config';
import fs from 'node:fs';
import { DISPUTED_LABELS, isDisputed } from './labels';
import { SYSTEM_PROMPT } from '../src/lib/orchestrator';

test('componentCountRule renders the legacy prompt text', () => {
  assert.equal(componentCountRule(), 'Typical deck: 4-8 components, never exceed 10');
});

test('followUpInstruction renders the legacy prompt text', () => {
  assert.equal(
    followUpInstruction(),
    'Suggest 2-3 follow-up questions the user might want to explore.'
  );
});

test('noContextMessage renders the legacy text', () => {
  assert.equal(
    noContextMessage(),
    'No case studies or assets matched this query. Please direct the user to contact our Strategy Lead for a personalized consultation.'
  );
});

test('isNoContext is true only when every list is empty', () => {
  assert.equal(isNoContext({ chunks: [], visualAssets: [], relatedMetrics: [] }), true);
  assert.equal(isNoContext({ chunks: [1], visualAssets: [], relatedMetrics: [] }), false);
  assert.equal(isNoContext({ chunks: [], visualAssets: [1], relatedMetrics: [] }), false);
  assert.equal(isNoContext({ chunks: [], visualAssets: [], relatedMetrics: [1] }), false);
});

test('Strategy Lead triggers (D-411)', () => {
  assert.deepEqual(CONCIERGE_CONFIG.strategyLead.offerOn, ['no_context', 'fallback', 'pricing', 'timeline', 'invention_bait']);
});

test('keywordTriggers', () => {
  assert.deepEqual(keywordTriggers('how much do u charge'), ['pricing']);
  assert.deepEqual(keywordTriggers('how fast can you ramp?'), ['timeline']);
  assert.deepEqual(
    keywordTriggers('ok so 3 things. how much would social media plus a new website cost, how fast could you get it done'),
    ['pricing', 'timeline']
  );
  assert.deepEqual(keywordTriggers('Our CEO is delivering an investor-day keynote in five months.'), []);
  assert.deepEqual(keywordTriggers('accurate separate'), []);
  assert.deepEqual(keywordTriggers('what was the conversion rate lift?'), []);
});

test('keywordTriggers over eval/queries.json', () => {
  const raw = JSON.parse(fs.readFileSync('eval/queries.json', 'utf8'));
  const qs: any[] = Array.isArray(raw) ? raw : raw.queries;
  const ids = (k: string) => qs.filter(q => keywordTriggers(q.query ?? q.text).includes(k as any)).map(q => q.id);
  assert.deepEqual(ids('pricing'), ['p5-q06', 'p5-q07', 'p5-q10']);
  assert.deepEqual(ids('timeline'), ['p1-q10', 'p2-q10', 'p3-q07', 'p3-q10', 'p4-q10', 'p5-q10']);
});

test('narrative and Strategy Lead rules', () => {
  assert.equal(
    narrativeRule(),
    'Write the narrative in 2-4 sentences, never more than 4. Count every sentence before the follow-up questions, including any honest gap line and the Strategy Lead offer.'
  );
  const r = strategyLeadPromptRule();
  for (const t of CONCIERGE_CONFIG.strategyLead.offerOn) assert.ok(r.includes(STRATEGY_LEAD_TRIGGER_DESCRIPTIONS[t]));
  assert.ok(r.includes('Our Strategy Lead can scope this with you.'));
});

test('isVideoQuery', () => {
  assert.equal(isVideoQuery('we need someone to make instagram and tiktok videos'), true);
  assert.equal(isVideoQuery('how much do u charge'), false);
});

test('verifierEnabled env override', () => {
  const prev = process.env.VERIFIER_ENABLED;
  try {
    delete process.env.VERIFIER_ENABLED;
    assert.equal(verifierEnabled(), false);
    process.env.VERIFIER_ENABLED = 'true';
    assert.equal(verifierEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.VERIFIER_ENABLED;
    else process.env.VERIFIER_ENABLED = prev;
  }
});

test('admitNoDirectWork flag changes the rule', () => {
  assert.match(noDirectMatchPrompt('relevant_only', true).rule, /say so plainly/);
  assert.doesNotMatch(noDirectMatchPrompt('relevant_only', false).rule, /say so plainly/);
});

test('retrieval and teaser config', () => {
  assert.deepEqual(CONCIERGE_CONFIG.retrieval, {
    maxCaseStudies: 8,
    maxArticles: 2,
    matchCount: 60,
    rrfK: 60,
    intentBoost: 0.003,
    rerank: {
      enabled: false,
      provider: 'cohere',
      model: 'cohere/rerank-5-fast',
      haikuModel: 'claude-haiku-5-5',
      semanticPool: 15,
      keywordPool: 10,
      matchCountFallback: 250,
      timeoutMs: 4000,
      haikuTimeoutMs: 4000,
      haikuMaxDocChars: 1200,
      maxDocChars: 2000,
    },
  });
  assert.equal(CONCIERGE_CONFIG.teasers.policy, 'relevant_only');
});

test('retrievalConfigKey differs by rerank provider when rerank is enabled', () => {
  const prev = process.env.RERANK_ENABLED;
  process.env.RERANK_ENABLED = 'true';
  try {
    const r = CONCIERGE_CONFIG.retrieval;
    const a = retrievalConfigKey({ ...r, rerank: { ...r.rerank, provider: 'cohere' } });
    const b = retrievalConfigKey({ ...r, rerank: { ...r.rerank, provider: 'haiku' } });
    assert.notEqual(a, b);
  } finally {
    if (prev === undefined) delete process.env.RERANK_ENABLED;
    else process.env.RERANK_ENABLED = prev;
  }
});

test('teaser prompt and rubric text follow the policy', () => {
  assert.match(teaserPromptRule('relevant_only'), /genuinely match/);
  assert.match(teaserPromptRule('relevant_only'), /Never pad/);
  assert.match(teaserPromptRule('all_retrieved'), /for each one/);
  assert.match(teaserRubricText('relevant_only'), /omitting/);
  assert.doesNotMatch(teaserRubricText('relevant_only'), /for retrieved case studies/);
  assert.match(teaserRubricText('all_retrieved'), /for retrieved case studies/);
  assert.equal(teaserPromptRule(), teaserPromptRule(CONCIERGE_CONFIG.teasers.policy));
  assert.equal(teaserRubricText(), teaserRubricText(CONCIERGE_CONFIG.teasers.policy));
});

test('retrievalConfigKey is stable and sensitive to changes', () => {
  assert.equal(retrievalConfigKey(), retrievalConfigKey());
  assert.notEqual(retrievalConfigKey(), retrievalConfigKey({ ...CONCIERGE_CONFIG.retrieval, maxCaseStudies: 5 }));
});

test('disputed labels', () => {
  const chorus = 'chorus-alphabet-x-creating-an-eye-opening-asset-visibility-brand';
  assert.equal(DISPUTED_LABELS.length, 3);
  assert.equal(isDisputed('p1-q05', chorus), true);
  assert.equal(isDisputed('p1-q03', chorus), false);
});

test('no-match prompt and fallback rubric text follow the policy', () => {
  assert.match(noDirectMatchPrompt('relevant_only').rule, /say so plainly/);
  assert.doesNotMatch(noDirectMatchPrompt('relevant_only').rule, /NEVER say/);
  assert.match(noDirectMatchPrompt('all_retrieved').rule, /NEVER say: "We don't currently have X case studies"/);
  assert.match(noDirectMatchPrompt('all_retrieved').intro, /Instead of saying/);
  assert.match(fallbackRubricText('relevant_only'), /allowed, not required/);
  assert.doesNotMatch(fallbackRubricText('relevant_only'), /still show case studies/);
  assert.match(fallbackRubricText('all_retrieved'), /still show case studies, so showing adjacent work is allowed\./);
  assert.match(teaserPromptRule('relevant_only'), /none with an honest note/);
});
