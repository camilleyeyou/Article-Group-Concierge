import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_PROMPT, formatContext } from '../src/lib/orchestrator';
import {
  FICTIONAL_EXAMPLE,
  narrativeRule,
  strategyLeadPromptRule,
  pricingTimelineRule,
} from '../src/lib/concierge-config';
import type { HybridSearchResult, RetrievedContext } from '../src/types';

test('prompt renders the shared config rules', () => {
  for (const s of [
    narrativeRule(),
    strategyLeadPromptRule(),
    pricingTimelineRule(),
    FICTIONAL_EXAMPLE.client,
    FICTIONAL_EXAMPLE.slug,
    'HONESTY RULES',
    'Do not output capabilities or industries',
  ]) {
    assert.ok(SYSTEM_PROMPT.includes(s), `missing: ${s.slice(0, 60)}`);
  }
});

test('prompt no longer carries the NeoBank example or tag props', () => {
  for (const s of ['NeoBank', '340%', '"capabilities": [', 'we can help you because']) {
    assert.ok(!SYSTEM_PROMPT.includes(s), `still has: ${s}`);
  }
});

test('example narrative is exactly 3 sentences', () => {
  const start = SYSTEM_PROMPT.indexOf('## EXAMPLE INTERACTION');
  const fenceEnd = SYSTEM_PROMPT.indexOf('```', SYSTEM_PROMPT.indexOf('```json', start) + 7) + 3;
  const end = SYSTEM_PROMPT.indexOf('**Want to explore further?**', fenceEnd);
  assert.ok(fenceEnd > 3 && end > fenceEnd);
  const narrative = SYSTEM_PROMPT.slice(fenceEnd, end).trim();
  const sentences = narrative.split(/(?<=[.!?])\s+(?=[A-Z])/);
  assert.equal(sentences.length, 3, narrative);
});

test('formatContext tells the model an aim is not a result', () => {
  const chunk = {
    document_type: 'case_study',
    document_title: 'T',
    client_name: 'C',
    slug: 's',
    vimeo_url: null,
    thumbnail_url: null,
    content: 'C wanted to be bold.',
  } as unknown as HybridSearchResult;
  const ctx = { chunks: [chunk], visualAssets: [], relatedMetrics: [] } as unknown as RetrievedContext;
  assert.ok(formatContext(ctx).includes("A client's aim or brief is not a result."));
});

test('prompt keeps narrative distinct from StrategyCard and bars inferred scope', () => {
  assert.ok(SYSTEM_PROMPT.includes('must not say the same thing'));
  assert.ok(SYSTEM_PROMPT.includes('Do not infer a principle, scope or deliverable'));
});
