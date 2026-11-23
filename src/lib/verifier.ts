/**
 * GEN-07 claim-check verifier (D-417..D-420). Checks teaser summaries, StrategyCards and narrative
 * sentences against the retrieved text with Haiku 5.5 (thinking disabled), and rewrites unsupported
 * spans into a supported version. Never deletes a span. Any failure keeps the unverified response.
 * Ships behind CONCIERGE_CONFIG.verifier.enabled (default false).
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  OrchestratorOutput,
  RetrievedContext,
  VerifierReport,
  VerifierRewrite,
  CaseStudyTeaserProps,
  StrategyCardProps,
} from '../types';
import { CONCIERGE_CONFIG } from './concierge-config';
import { anthropicClientOptions, claudeModelId } from './llm-config';
import { OrchLogger } from './logger';
import { HAIKU_PRICE_IN, HAIKU_PRICE_OUT } from './rerank';
import { renderRawResponse } from './layout-postprocess';
import { splitSentences } from './sentences';

export interface VerifierSpan {
  id: string;
  kind: 'teaser_summary' | 'strategy_card' | 'narrative_sentence';
  slug?: string;
  text: string;
}

type VerifierContext = Pick<RetrievedContext, 'chunks' | 'relatedMetrics'>;

const MAX_REWRITE_CHARS = 600;

export const VERIFIER_SYSTEM_TEXT = `You check a draft answer from Article Group's concierge against the SOURCE text it was given. For each numbered span, decide whether every factual claim it makes about Article Group's work is stated in the SOURCE. Unsupported means: a client's aim, goal or brief stated as an achieved result; an event or launch said to have happened when the SOURCE does not say so; inferred reach, impact, order of work, scale or duration; a detail carried over from a different case study; a capability or kind of work that no SOURCE case study shows; confirming an engagement or result the user asserted that the SOURCE does not show. Advice, opinion and descriptions of how we would approach the user's problem are not factual claims. For each unsupported span, rewrite it into a supported version: same role and similar length, only facts from the SOURCE, "we"/"our" voice, never empty. Output only JSON: {"rewrites":[{"id":"<span id>","text":"<rewritten span>","reason":"<under 12 words>"}]}. Output {"rewrites":[]} if every span is supported.`;

export function collectSpans(output: OrchestratorOutput): VerifierSpan[] {
  const spans: VerifierSpan[] = [];
  let t = 0;
  let c = 0;
  for (const item of output.layoutPlan?.layout ?? []) {
    if (item.component === 'CaseStudyTeaser') {
      const p = item.props as CaseStudyTeaserProps;
      if (p.summary) spans.push({ id: `t${t}`, kind: 'teaser_summary', slug: p.slug, text: p.summary });
      t++;
    } else if (item.component === 'StrategyCard') {
      const p = item.props as StrategyCardProps;
      if (p.content) spans.push({ id: `c${c}`, kind: 'strategy_card', text: p.content });
      c++;
    }
  }
  splitSentences(output.explanation ?? '').forEach((s, i) => {
    spans.push({ id: `n${i}`, kind: 'narrative_sentence', text: s });
  });
  return spans;
}

export function buildVerifierPrompt(query: string, context: VerifierContext, spans: VerifierSpan[]): string {
  const max = CONCIERGE_CONFIG.verifier.maxDocChars;
  const source = context.chunks.map(ch =>
    ch.document_type === 'case_study'
      ? `[CASE STUDY] ${ch.document_title} | client: ${ch.client_name ?? 'n/a'} | slug: ${ch.slug}\n${ch.content.slice(0, max)}`
      : `[ARTICLE - our thinking, not client work] ${ch.document_title}\n${ch.content.slice(0, max)}`
  );
  const metrics = context.relatedMetrics.map(m => `- ${m.label}: ${m.value}${m.context ? ` (${m.context})` : ''}`);
  const spanLines = spans.map(s => `${s.id} (${s.kind}${s.slug ? `, slug: ${s.slug}` : ''}): ${s.text}`);
  return [
    `QUESTION: ${query}`,
    '',
    'SOURCE:',
    ...source,
    ...(metrics.length ? ['', 'METRICS:', ...metrics] : []),
    '',
    'SPANS:',
    ...spanLines,
  ].join('\n');
}

export function parseVerifierResponse(text: string, spans: VerifierSpan[]): VerifierRewrite[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = (parsed as { rewrites?: unknown })?.rewrites;
  if (!Array.isArray(list)) return null;
  const ids = new Set(spans.map(s => s.id));
  const seen = new Set<string>();
  const out: VerifierRewrite[] = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const { id, text: t, reason } = r as Record<string, unknown>;
    if (typeof id !== 'string' || !ids.has(id) || seen.has(id)) continue;
    if (typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (!trimmed || trimmed.length > MAX_REWRITE_CHARS) continue;
    seen.add(id);
    out.push({ id, text: trimmed, reason: typeof reason === 'string' ? reason : '' });
  }
  return out;
}

export function applyRewrites(
  output: OrchestratorOutput,
  spans: VerifierSpan[],
  rewrites: VerifierRewrite[]
): OrchestratorOutput {
  const byId = new Map(rewrites.map(r => [r.id, r.text]));
  if (byId.size === 0) return output;
  const layout = structuredClone(output.layoutPlan);
  let t = 0;
  let c = 0;
  for (const item of layout.layout) {
    if (item.component === 'CaseStudyTeaser') {
      const next = byId.get(`t${t++}`);
      if (next) (item.props as CaseStudyTeaserProps).summary = next;
    } else if (item.component === 'StrategyCard') {
      const next = byId.get(`c${c++}`);
      if (next) (item.props as StrategyCardProps).content = next;
    }
  }
  const oldExplanation = output.explanation ?? '';
  let explanation = oldExplanation;
  for (const s of spans) {
    if (s.kind !== 'narrative_sentence') continue;
    const next = byId.get(s.id);
    if (!next) continue;
    // splitSentences strips markdown; if the sentence is not found verbatim, leave it alone
    if (explanation.includes(s.text)) explanation = explanation.replace(s.text, () => next);
  }
  const result: OrchestratorOutput = { ...output, layoutPlan: layout, explanation };
  if (output.rawResponse) {
    result.rawResponse = renderRawResponse(
      output.rawResponse,
      layout,
      explanation !== oldExplanation ? { from: oldExplanation, to: explanation } : undefined
    );
  }
  return result;
}

let verifierClient: Anthropic | null = null;

export async function verifyOutput(input: {
  query: string;
  context: VerifierContext;
  output: OrchestratorOutput;
  client?: Pick<Anthropic, 'messages'>;
}): Promise<{ output: OrchestratorOutput; report: VerifierReport }> {
  const { query, context, output } = input;
  const cfg = CONCIERGE_CONFIG.verifier;
  const spans = collectSpans(output);
  if (spans.length === 0) {
    return { output, report: { ok: true, latencyMs: 0, cost: 0, spans: 0, rewrites: [] } };
  }
  const start = Date.now();
  const fail = (error: string): { output: OrchestratorOutput; report: VerifierReport } => ({
    output,
    report: { ok: false, latencyMs: Date.now() - start, cost: null, spans: spans.length, rewrites: [], error },
  });
  try {
    const client =
      input.client ??
      (verifierClient ??= new Anthropic({ ...anthropicClientOptions(), maxRetries: 0, timeout: cfg.timeoutMs }));
    const res = await client.messages.create({
      model: claudeModelId(cfg.model),
      max_tokens: cfg.maxTokens,
      temperature: 0,
      system: VERIFIER_SYSTEM_TEXT,
      messages: [{ role: 'user', content: buildVerifierPrompt(query, context, spans) }],
      // Haiku 5.5 thinking eats max_tokens (03-11 finding); the SDK types do not know the field yet.
      ...({ thinking: { type: 'disabled' } } as Record<string, unknown>),
    });
    const block = res.content.find(b => b.type === 'text');
    const text = block && block.type === 'text' ? block.text : '';
    const rewrites = parseVerifierResponse(text, spans);
    if (!rewrites) {
      OrchLogger.error('verifier unparseable; keeping unverified response');
      return fail('unparseable');
    }
    const cost = res.usage.input_tokens * HAIKU_PRICE_IN + res.usage.output_tokens * HAIKU_PRICE_OUT;
    return {
      output: applyRewrites(output, spans, rewrites),
      report: { ok: true, latencyMs: Date.now() - start, cost, spans: spans.length, rewrites },
    };
  } catch (e) {
    OrchLogger.error('verifier failed; keeping unverified response', e);
    return fail(e instanceof Error ? e.message : String(e));
  }
}
