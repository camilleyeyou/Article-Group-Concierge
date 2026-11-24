/**
 * Consumes the /api/chat/stream SSE response (the same one production uses) and records
 * when each kind of event arrived (D-510). Pure: the clock is injectable for tests.
 */

import { SseDecoder, type PublicOrchestratorOutput, type StreamEvent, type SuppressReason } from '../src/lib/stream-events';

export interface StreamCapture {
  t_teasers_ms: number | null;
  t_suppressed_ms: number | null;
  t_hero_first_ms: number | null;
  t_hero_done_ms: number | null;
  t_complete_ms: number | null;
  instant_teaser_slugs: string[] | null;
  suppressed_reason: SuppressReason | null;
  final: PublicOrchestratorOutput | null;
  debug: Record<string, unknown> | null;
  error: { errorCode: string; explanation: string; retryable: boolean } | null;
  events: number;
}

export async function consumeChatStream(
  res: Response,
  t0: number,
  now: () => number = () => performance.now(),
): Promise<StreamCapture> {
  const cap: StreamCapture = {
    t_teasers_ms: null,
    t_suppressed_ms: null,
    t_hero_first_ms: null,
    t_hero_done_ms: null,
    t_complete_ms: null,
    instant_teaser_slugs: null,
    suppressed_reason: null,
    final: null,
    debug: null,
    error: null,
    events: 0,
  };
  const decoder = new SseDecoder();
  const td = new TextDecoder();

  const handle = (ev: StreamEvent, t: number) => {
    cap.events += 1;
    switch (ev.type) {
      case 'teasers':
        if (cap.t_teasers_ms === null) {
          cap.t_teasers_ms = t;
          cap.instant_teaser_slugs = ev.items.map(i => i.slug);
        }
        break;
      case 'suppressed':
        if (cap.t_suppressed_ms === null) {
          cap.t_suppressed_ms = t;
          cap.suppressed_reason = ev.reason;
        }
        break;
      case 'hero':
        if (cap.t_hero_first_ms === null) cap.t_hero_first_ms = t;
        break;
      case 'hero_done':
        if (cap.t_hero_first_ms === null) cap.t_hero_first_ms = t;
        if (cap.t_hero_done_ms === null) cap.t_hero_done_ms = t;
        break;
      case 'final':
        cap.t_complete_ms = t;
        cap.final = ev.output;
        break;
      case 'debug':
        cap.debug = ev.debug;
        break;
      case 'error':
        cap.error = { errorCode: ev.errorCode, explanation: ev.explanation, retryable: ev.retryable };
        break;
      default:
        break;
    }
  };

  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const t = now() - t0;
      for (const ev of decoder.push(td.decode(value, { stream: true }))) handle(ev, t);
    }
  }
  const tEnd = now() - t0;
  for (const ev of decoder.flush()) handle(ev, tEnd);

  if (!cap.final && !cap.error) {
    cap.error = { errorCode: 'stream_incomplete', explanation: 'Stream ended without a final or error event', retryable: true };
  }
  return cap;
}
