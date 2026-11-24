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
