import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumeChatStream } from './stream-client';
import { encodeSse, type StreamEvent } from '../src/lib/stream-events';

function resFrom(events: StreamEvent[], chunkSize = 7): Response {
  const bytes = Buffer.concat(events.map(e => Buffer.from(encodeSse(e))));
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) parts.push(bytes.subarray(i, i + chunkSize));
  return new Response(
    new ReadableStream({
      start(c) {
        for (const p of parts) c.enqueue(p);
        c.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

// Clock advances 1 ms per read
function clock() {
  let t = 0;
  return () => ++t;
}

const hero = { title: 'T', subtitle: 'S', challengeSummary: 'C', backgroundVariant: 'default' } as never;
const output = { layoutPlan: { layout: [] }, explanation: 'x', contactCTA: false } as never;

test('records teasers, hero, complete times and slugs', async () => {
  const cap = await consumeChatStream(
    resFrom([
      { type: 'teasers', items: [{ slug: 'a' }, { slug: 'b' }] as never },
      { type: 'hero', title: 'T' },
      { type: 'hero_done', props: hero },
      { type: 'final', output },
      { type: 'debug', debug: { rawResponse: 'r' } },
    ], 1000),
    0,
    clock(),
  );
  assert.ok(cap.t_teasers_ms !== null && cap.t_hero_first_ms !== null && cap.t_complete_ms !== null);
  assert.equal(cap.t_hero_first_ms, cap.t_hero_done_ms);
  assert.deepEqual(cap.instant_teaser_slugs, ['a', 'b']);
  assert.deepEqual(cap.debug, { rawResponse: 'r' });
  assert.ok(cap.final);
  assert.equal(cap.error, null);
});

test('arbitrary chunking preserves order of timings', async () => {
  const cap = await consumeChatStream(
    resFrom([
      { type: 'teasers', items: [{ slug: 'a' }] as never },
      { type: 'hero', title: 'T' },
      { type: 'hero_done', props: hero },
      { type: 'final', output },
    ], 3),
    0,
    clock(),
  );
  assert.ok(cap.t_teasers_ms! < cap.t_hero_first_ms!);
  assert.ok(cap.t_hero_first_ms! <= cap.t_hero_done_ms!);
  assert.ok(cap.t_hero_done_ms! < cap.t_complete_ms!);
});

test('suppressed replaces teasers', async () => {
  const cap = await consumeChatStream(
    resFrom([
      { type: 'suppressed', reason: 'score_floor' },
      { type: 'hero_done', props: hero },
      { type: 'final', output },
    ]),
    0,
    clock(),
  );
  assert.equal(cap.t_teasers_ms, null);
  assert.ok(cap.t_suppressed_ms !== null);
  assert.equal(cap.suppressed_reason, 'score_floor');
  assert.equal(cap.instant_teaser_slugs, null);
  assert.ok(cap.t_hero_first_ms !== null);
});

test('error event is captured', async () => {
  const cap = await consumeChatStream(
    resFrom([{ type: 'error', explanation: 'bad', errorCode: 'upstream_error' as never, retryable: true, contactCTA: false }]),
    0,
    clock(),
  );
  assert.deepEqual(cap.error, { errorCode: 'upstream_error', explanation: 'bad', retryable: true });
  assert.equal(cap.final, null);
});

test('stream with neither final nor error is stream_incomplete', async () => {
  const cap = await consumeChatStream(resFrom([{ type: 'teasers', items: [] }]), 0, clock());
  assert.equal(cap.error?.errorCode, 'stream_incomplete');
});

import { encodeSseComment, SseDecoder } from '../src/lib/stream-events';

test('encodeSseComment produces a perf comment line', () => {
  assert.equal(new TextDecoder().decode(encodeSseComment('perf', { rag_cache_hit: 0 })), ': perf {"rag_cache_hit":0}\n\n');
});

test('SseDecoder ignores perf comments between events', () => {
  const d = new SseDecoder();
  const td = new TextDecoder();
  const text =
    td.decode(encodeSseComment('perf', { rag_cache_hit: 0 })) +
    td.decode(encodeSse({ type: 'suppressed', reason: 'about_ag' })) +
    td.decode(encodeSseComment('perf-final', { orch_cached: false }));
  const evs = d.push(text);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].type, 'suppressed');
});

function resFromParts(parts: Uint8Array[]): Response {
  return new Response(new ReadableStream({ start(c) { for (const p of parts) c.enqueue(p); c.close(); } }));
}

test('consumeChatStream parses perf and perf-final comments into cap.perf', async () => {
  const bytes = Buffer.concat([
    Buffer.from(encodeSseComment('perf', { rag_cache_hit: 0, embed_cache_hit: 1, instance_req: 3, instance_age_s: 40 })),
    Buffer.from(encodeSse({ type: 'final', output })),
    Buffer.from(encodeSseComment('perf-final', { orch_cached: false })),
  ]);
  const cap = await consumeChatStream(resFromParts([bytes]), 0, clock());
  assert.deepEqual(cap.perf, { rag_cache_hit: 0, embed_cache_hit: 1, orch_cached: false, instance_req: 3, instance_age_s: 40 });
});

test('a perf comment split across chunks is still parsed', async () => {
  const bytes = Buffer.concat([
    Buffer.from(encodeSseComment('perf', { rag_cache_hit: 1, embed_cache_hit: 0, instance_req: 1, instance_age_s: 2 })),
    Buffer.from(encodeSse({ type: 'final', output })),
  ]);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += 5) parts.push(bytes.subarray(i, i + 5));
  const cap = await consumeChatStream(resFromParts(parts), 0, clock());
  assert.equal(cap.perf?.rag_cache_hit, 1);
  assert.equal(cap.perf?.instance_req, 1);
});

test('no perf comment gives cap.perf === null; malformed comment ignored', async () => {
  const a = await consumeChatStream(resFrom([{ type: 'final', output }]), 0, clock());
  assert.equal(a.perf, null);
  const bytes = Buffer.concat([Buffer.from(': perf {bad json\n\n'), Buffer.from(encodeSse({ type: 'final', output }))]);
  const b = await consumeChatStream(resFromParts([bytes]), 0, clock());
  assert.equal(b.perf, null);
});

import fs from 'node:fs';
import path from 'node:path';

test('route emits perf comments only under the perfTiming guard (production shape unchanged)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/app/api/chat/stream/route.ts'), 'utf-8');
  const calls = [...src.matchAll(/sendComment\('(perf|perf-final)'/g)];
  assert.equal(calls.length, 2);
  for (const m of calls) {
    const before = src.slice(Math.max(0, m.index! - 200), m.index!);
    assert.ok(/if \(perfTiming\)/.test(before), `sendComment('${m[1]}') must sit inside if (perfTiming)`);
  }
  assert.equal((src.match(/encodeSseComment\(/g) ?? []).length, 1);
});
