import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSse, SseDecoder, SSE_KEEPALIVE, type StreamEvent } from '../src/lib/stream-events';

const dec = new TextDecoder();
const text = (e: StreamEvent) => dec.decode(encodeSse(e));

const ALL: StreamEvent[] = [
  { type: 'teasers', items: [{ title: 'T', slug: 's' }] },
  { type: 'suppressed', reason: 'score_floor' },
  { type: 'hero', title: 'Hi' },
  { type: 'hero_done', props: { title: 'Hi' } },
  { type: 'component', index: 1, component: 'MetricGrid', props: { a: 1 } },
  { type: 'narrative', text: 'We did.\nTwo lines' },
  { type: 'final', output: { layoutPlan: { layout: [] }, explanation: 'x' } as never },
  { type: 'debug', debug: { a: 1 } },
  { type: 'error', explanation: 'e', errorCode: 'internal_error', retryable: true, contactCTA: true },
];

test('round-trips every event type', () => {
  const d = new SseDecoder();
  for (const e of ALL) assert.deepEqual(d.push(text(e)), [e]);
});

test('every split point of a 3-event payload decodes the same', () => {
  const payload = ALL.slice(0, 3).map(text).join('');
  for (let i = 0; i <= payload.length; i++) {
    const d = new SseDecoder();
    const got = [...d.push(payload.slice(0, i)), ...d.push(payload.slice(i)), ...d.flush()];
    assert.deepEqual(got, ALL.slice(0, 3), `split at ${i}`);
  }
});

test('keepalive comments are skipped', () => {
  const d = new SseDecoder();
  assert.deepEqual(d.push(dec.decode(SSE_KEEPALIVE) + text(ALL[1])), [ALL[1]]);
});

test('CRLF line endings decode the same', () => {
  const d = new SseDecoder();
  assert.deepEqual(d.push(text(ALL[1]).replace(/\n/g, '\r\n')), [ALL[1]]);
  // CRLF split between \r and \n
  const d2 = new SseDecoder();
  const crlf = text(ALL[1]).replace(/\n/g, '\r\n');
  for (let i = 0; i <= crlf.length; i++) {
    const dd = new SseDecoder();
    assert.deepEqual([...dd.push(crlf.slice(0, i)), ...dd.push(crlf.slice(i))], [ALL[1]], `crlf split ${i}`);
  }
  void d2;
});

test('unknown type and invalid JSON are dropped', () => {
  const d = new SseDecoder();
  assert.deepEqual(d.push('data: {"type":"bogus"}\n\ndata: {nope\n\n' + text(ALL[1])), [ALL[1]]);
});

test('flush returns a final frame without trailing blank line', () => {
  const d = new SseDecoder();
  assert.deepEqual(d.push(text(ALL[1]).trimEnd()), []);
  assert.deepEqual(d.flush(), [ALL[1]]);
});
