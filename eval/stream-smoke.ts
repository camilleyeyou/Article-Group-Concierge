import './lib';
/**
 * Stream smoke (paid, cents): POST one query to /api/chat/stream on a local or production URL and print
 * when each SSE event arrives. Fails (exit 1) when there is no final event, the content type is not
 * text/event-stream, or a debug event leaks while --expect-no-debug (default on) is set.
 *
 *   npx tsx eval/stream-smoke.ts [--query "..."] [--no-expect-no-debug]
 * Env: EVAL_BASE_URL (default http://localhost:3000)
 */

import { argValue, hasFlag } from './lib';
import { SseDecoder, type StreamEvent } from '../src/lib/stream-events';

const BASE_URL = (process.env.EVAL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function main() {
  if (hasFlag('--help')) {
    console.log(`Usage: npx tsx eval/stream-smoke.ts [--query "<text>"] [--expect-no-debug | --no-expect-no-debug]
Posts { query } (no debug flag) to $EVAL_BASE_URL/api/chat/stream (default http://localhost:3000) and prints event arrival times.
Exit 1 when: no final event, not text/event-stream, or a debug event appears while --expect-no-debug (default).`);
    return;
  }
  const query = argValue('--query') ?? 'What cybersecurity clients have you worked with?';
  const expectNoDebug = !hasFlag('--no-expect-no-debug');

  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const contentType = res.headers.get('content-type') ?? '';
  console.log(`HTTP ${res.status} ${contentType}`);

  let failed = false;
  if (!contentType.includes('text/event-stream')) {
    console.error('FAIL: response is not text/event-stream');
    console.error((await res.text()).slice(0, 300));
    process.exit(1);
  }

  const decoder = new SseDecoder();
  const td = new TextDecoder();
  const seen: Array<{ type: StreamEvent['type']; t: number }> = [];
  const log = (ev: StreamEvent, t: number) => {
    seen.push({ type: ev.type, t });
    console.log(`${String(Math.round(t)).padStart(6)} ms  ${ev.type}`);
  };
  const reader = res.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const t = performance.now() - t0;
    for (const ev of decoder.push(td.decode(value, { stream: true }))) log(ev, t);
  }
  for (const ev of decoder.flush()) log(ev, performance.now() - t0);

  const first = seen[0];
  const final = seen.find(e => e.type === 'final');
  if (!final) {
    console.error('FAIL: no final event');
    failed = true;
  }
  if (expectNoDebug && seen.some(e => e.type === 'debug')) {
    console.error('FAIL: debug event present (EVAL_DEBUG must be off on this server)');
    failed = true;
  }
  if (first && final && final.t - first.t < 300) {
    console.warn('BUFFERED? first-to-final gap is under 300 ms; the proxy or route may be buffering (ignore for cached answers)');
  }
  console.log(failed ? 'SMOKE FAILED' : 'SMOKE OK');
  process.exit(failed ? 1 : 0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
