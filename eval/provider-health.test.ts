import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkProviderHealth } from '../src/lib/provider-health';
import { runPreflight, PreflightError } from './preflight';

const saved = { k: process.env.OPENROUTER_API_KEY, m: process.env.ANTHROPIC_MODEL };
beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  delete process.env.ANTHROPIC_MODEL;
});
afterEach(() => {
  if (saved.k === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = saved.k;
  if (saved.m === undefined) delete process.env.ANTHROPIC_MODEL; else process.env.ANTHROPIC_MODEL = saved.m;
});

const reply = (status: number, data?: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify({ data }), { status })) as unknown as typeof fetch;

test('direct route fails without calling fetch', async () => {
  delete process.env.OPENROUTER_API_KEY;
  let called = false;
  const h = await checkProviderHealth({ fetchImpl: (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch });
  assert.equal(h.status, 'fail');
  assert.match(h.reason, /not OpenRouter/);
  assert.equal(h.key.present, false);
  assert.equal(called, false);
});

test('401 fails with invalid key', async () => {
  const h = await checkProviderHealth({ fetchImpl: reply(401) });
  assert.equal(h.status, 'fail');
  assert.equal(h.key.valid, false);
  assert.equal(h.httpStatus, 401);
  assert.match(h.reason, /invalid/);
});

test('timeout warns', async () => {
  const f = (async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }) as unknown as typeof fetch;
  const h = await checkProviderHealth({ fetchImpl: f });
  assert.equal(h.status, 'warn');
  assert.match(h.reason, /timed out/);
  assert.equal(h.httpStatus, null);
});

test('network error warns', async () => {
  const f = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
  const h = await checkProviderHealth({ fetchImpl: f });
  assert.equal(h.status, 'warn');
  assert.match(h.reason, /Could not reach/);
});

test('503 warns, never fails', async () => {
  const h = await checkProviderHealth({ fetchImpl: reply(503) });
  assert.equal(h.status, 'warn');
  assert.equal(h.httpStatus, 503);
});

test('healthy credit uses the minimum of limit_remaining and effective budget', async () => {
  const h = await checkProviderHealth({ fetchImpl: reply(200, { limit: 50, limit_remaining: 12.5, usage: 37.5, effective_budget: { remaining_usd: 7.1 } }) });
  assert.equal(h.status, 'ok');
  assert.equal(h.credit.remaining, 7.1);
  assert.equal(h.credit.limit, 50);
  assert.equal(h.key.valid, true);
});

test('low credit warns', async () => {
  const h = await checkProviderHealth({ fetchImpl: reply(200, { limit_remaining: 3.2 }) });
  assert.equal(h.status, 'warn');
  assert.match(h.reason, /\$3\.20/);
  assert.match(h.reason, /below \$5\.00/);
});

test('zero and negative credit fail', async () => {
  assert.equal((await checkProviderHealth({ fetchImpl: reply(200, { limit_remaining: 0 }) })).status, 'fail');
  assert.equal((await checkProviderHealth({ fetchImpl: reply(200, { limit_remaining: -0.4 }) })).status, 'fail');
});

test('unknown credit warns', async () => {
  const h = await checkProviderHealth({ fetchImpl: reply(200, { limit_remaining: null }) });
  assert.equal(h.status, 'warn');
  assert.match(h.reason, /credit unknown/);
});

test('model ids on the OpenRouter route', async () => {
  const h = await checkProviderHealth({ fetchImpl: reply(200, { limit_remaining: 20 }) });
  assert.equal(h.models.generation, 'anthropic/claude-sonnet-5.5');
  assert.equal(h.models.embedding, 'openai/text-embedding-3-small');
  assert.equal(h.route, 'openrouter');
});

test('key fetch opts out of the Next.js data cache', async () => {
  let seen: { url: string; init?: RequestInit } | undefined;
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    seen = { url: String(url), init };
    return new Response(JSON.stringify({ data: { limit_remaining: 20 } }), { status: 200 });
  }) as unknown as typeof fetch;
  await checkProviderHealth({ fetchImpl: f });
  assert.ok(seen);
  assert.equal(seen.url, 'https://openrouter.ai/api/v1/key');
  assert.equal(seen.init?.cache, 'no-store');
  assert.equal((seen.init?.headers as Record<string, string>).Authorization, 'Bearer test-key');
  assert.ok(seen.init?.signal);
});

test('preflight throws PreflightError below the per-run minimum', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = reply(200, { limit: 50, limit_remaining: 3, usage: 47 });
  try {
    await assert.rejects(
      runPreflight({ supabase: false, openrouter: true, minCreditUsd: 4 }),
      (e: unknown) =>
        e instanceof PreflightError &&
        e.message === 'OpenRouter key has $3.00 left; this step needs about $4.00. Top up or lower the scope.',
    );
  } finally {
    globalThis.fetch = orig;
  }
});
