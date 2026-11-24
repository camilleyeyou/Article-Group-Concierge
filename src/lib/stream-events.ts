/**
 * SSE event protocol for the streaming chat route (Phase 5).
 * Client-safe: types only from '../types', no node modules. Shared by the route, page.tsx and the eval.
 */
import type {
  CaseStudyTeaserProps,
  ComponentType,
  HeroBlockProps,
  OrchestratorErrorCode,
  OrchestratorOutput,
} from '../types';

export type SuppressReason = 'no_case_studies' | 'about_ag' | 'claim_pattern' | 'score_floor';

export type InstantTeaser = Omit<CaseStudyTeaserProps, 'summary'> & { summary?: string };

export type PublicOrchestratorOutput = Omit<
  OrchestratorOutput,
  'rawResponse' | 'modelRawResponse' | 'orchestratorError' | 'usage' | 'catalogueVersion' | 'verifier'
>;

export type StreamEvent =
  | { type: 'teasers'; items: InstantTeaser[] }
  | { type: 'suppressed'; reason: SuppressReason }
  // cumulative values so far
  | {
      type: 'hero';
      title?: string;
      subtitle?: string;
      challengeSummary?: string;
      backgroundVariant?: HeroBlockProps['backgroundVariant'];
    }
  | { type: 'hero_done'; props: HeroBlockProps }
  // always complete, never partial
  | { type: 'component'; index: number; component: ComponentType; props: Record<string, unknown> }
  // delta
  | { type: 'narrative'; text: string }
  // authoritative; client reconciles to it, eval grades it
  | { type: 'final'; output: PublicOrchestratorOutput }
  // only when debugEnabled(); sent after final
  | { type: 'debug'; debug: Record<string, unknown> }
  | { type: 'error'; explanation: string; errorCode: OrchestratorErrorCode; retryable: boolean; contactCTA: boolean };

export const STREAM_EVENT_TYPES: ReadonlySet<StreamEvent['type']> = new Set<StreamEvent['type']>([
  'teasers',
  'suppressed',
  'hero',
  'hero_done',
  'component',
  'narrative',
  'final',
  'debug',
  'error',
]);

const encoder = new TextEncoder();

export function encodeSse(e: StreamEvent): Uint8Array {
  return encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
}

export const SSE_KEEPALIVE: Uint8Array = encoder.encode(': ping\n\n');

function parseFrame(frame: string): StreamEvent | null {
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('data:')) {
      const v = line.slice(5);
      dataLines.push(v.startsWith(' ') ? v.slice(1) : v);
    }
  }
  if (dataLines.length === 0) return null;
  try {
    const obj = JSON.parse(dataLines.join('\n')) as unknown;
    if (obj && typeof obj === 'object' && STREAM_EVENT_TYPES.has((obj as { type: StreamEvent['type'] }).type)) {
      return obj as StreamEvent;
    }
  } catch {
    // invalid JSON frame: dropped
  }
  return null;
}

export class SseDecoder {
  private buf = '';

  push(chunk: string): StreamEvent[] {
    this.buf += chunk;
    this.buf = this.buf.replace(/\r\n/g, '\n');
    // A trailing lone \r may be the first half of \r\n; keep it for the next chunk.
    const hold = this.buf.endsWith('\r') ? '\r' : '';
    if (hold) this.buf = this.buf.slice(0, -1);
    const frames = this.buf.split('\n\n');
    this.buf = (frames.pop() ?? '') + hold;
    const out: StreamEvent[] = [];
    for (const f of frames) {
      const ev = parseFrame(f);
      if (ev) out.push(ev);
    }
    return out;
  }

  flush(): StreamEvent[] {
    const rest = this.buf.replace(/\r/g, '');
    this.buf = '';
    if (!rest.trim()) return [];
    const ev = parseFrame(rest);
    return ev ? [ev] : [];
  }
}
