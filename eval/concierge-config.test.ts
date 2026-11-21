import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  CONCIERGE_CONFIG,
  componentCountRule,
  followUpInstruction,
  noContextMessage,
  isNoContext,
} from '../src/lib/concierge-config';
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

test('Strategy Lead is offered only on no_context (current app behaviour)', () => {
  assert.deepEqual(CONCIERGE_CONFIG.strategyLead.offerOn, ['no_context']);
});

test('SYSTEM_PROMPT is byte-identical to the pre-refactor prompt', () => {
  assert.equal(
    createHash('sha256').update(SYSTEM_PROMPT).digest('hex'),
    '408483f12f864bd614c77e9b85277aee8bd3a78ff22bf21647bc80b5bfde286b'
  );
});
