import test from 'node:test';
import assert from 'node:assert/strict';
import { debugEnabled, teasersOnlyEnabled, validateChatBody, toPublicOutput } from '../src/lib/chat-request';
import { classifyError } from '../src/lib/chat-errors';

function withEnv(v: string | undefined, fn: () => void) {
  const saved = process.env.EVAL_DEBUG;
  try {
    if (v === undefined) delete process.env.EVAL_DEBUG; else process.env.EVAL_DEBUG = v;
    fn();
  } finally {
    if (saved === undefined) delete process.env.EVAL_DEBUG; else process.env.EVAL_DEBUG = saved;
  }
}

test('debugEnabled gate', () => {
  withEnv(undefined, () => assert.equal(debugEnabled({ debug: true }), false));
  withEnv('false', () => assert.equal(debugEnabled({ debug: true }), false));
  withEnv('true', () => assert.equal(debugEnabled({ debug: true }), true));
  withEnv('true', () => assert.equal(debugEnabled({}), false));
});

test('validateChatBody', () => {
  assert.deepEqual(validateChatBody(null), { ok: false, status: 400, error: 'Missing or invalid query' });
  assert.deepEqual(validateChatBody({ query: 'hi' }), { ok: false, status: 400, error: 'Query too short' });
  assert.deepEqual(validateChatBody({ query: 'x'.repeat(2001) }), {
    ok: false, status: 400, error: 'Query too long (max 2000 characters)',
  });
  const r = validateChatBody({ query: '  hello  ' });
  assert.ok(r.ok && r.query === 'hello');
});

test('toPublicOutput strips exactly the internal keys', () => {
  const o = {
    layoutPlan: { layout: [] }, explanation: 'e', contactCTA: true,
    rawResponse: 'a', modelRawResponse: 'b', orchestratorError: 'c', usage: null, catalogueVersion: 'v', verifier: null,
  };
  assert.deepEqual(Object.keys(toPublicOutput(o as never)).sort(), ['contactCTA', 'explanation', 'layoutPlan']);
});

test('classifyError', () => {
  const a = classifyError({ code: 'embeddings_quota_exceeded' });
  assert.equal(a.httpStatus, 503);
  assert.equal(a.errorCode, 'embeddings_unavailable');
  assert.equal(a.retryable, false);
  const b = classifyError(new Error('boom'));
  assert.equal(b.httpStatus, 500);
  assert.equal(b.errorCode, 'internal_error');
  assert.equal(b.retryable, true);
});

test('teasersOnlyEnabled gate', () => {
  withEnv(undefined, () => assert.equal(teasersOnlyEnabled({ teasersOnly: true }), false));
  withEnv('false', () => assert.equal(teasersOnlyEnabled({ teasersOnly: true }), false));
  withEnv('true', () => assert.equal(teasersOnlyEnabled({}), false));
  withEnv('true', () => assert.equal(teasersOnlyEnabled({ teasersOnly: true }), true));
});
