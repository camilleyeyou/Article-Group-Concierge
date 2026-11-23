/**
 * RETR-06: rerankers. Cohere through OpenRouter (POST /api/v1/rerank), or a Haiku listwise
 * reranker through OpenRouter chat (D-305 bake-off candidate).
 * Never throws: any failure returns null and the caller keeps the RRF order.
 */
import type { HybridSearchResult } from '../types';
import { RAGLogger } from './logger';
import Anthropic from '@anthropic-ai/sdk';
import { CONCIERGE_CONFIG } from './concierge-config';
import { anthropicClientOptions, claudeModelId } from './llm-config';

const RERANK_URL = 'https://openrouter.ai/api/v1/rerank';

export interface RerankOutcome {
  order: number[];
  scores: Map<number, number>;
  latencyMs: number;
  cost: number | null;
}

function bestPerDoc(rows: HybridSearchResult[], score: (r: HybridSearchResult) => number): HybridSearchResult[] {
  const best = new Map<string, HybridSearchResult>();
  for (const r of rows) {
    const cur = best.get(r.document_id);
    if (!cur || score(r) > score(cur)) best.set(r.document_id, r);
  }
  return [...best.values()];
}

/**
 * Candidate pool: doc-level semantic top-N, then keyword-only additions (keyword top-M, score > 0).
 * Case studies only; best chunk per document by the relevant score.
 */
export function buildRerankPool(
  rows: HybridSearchResult[],
  opts: { semanticPool: number; keywordPool: number },
): HybridSearchResult[] {
  const cs = rows.filter(r => r.document_type === 'case_study');
  const idx = new Map(cs.map((r, i) => [r, i]));
  const stable = (a: HybridSearchResult, b: HybridSearchResult, f: (r: HybridSearchResult) => number) =>
    f(b) - f(a) || idx.get(a)! - idx.get(b)!;

  const semantic = bestPerDoc(cs, r => r.similarity_score)
    .sort((a, b) => stable(a, b, r => r.similarity_score))
    .slice(0, opts.semanticPool);
  const keyword = bestPerDoc(cs, r => r.keyword_score)
    .filter(r => r.keyword_score > 0)
    .sort((a, b) => stable(a, b, r => r.keyword_score))
    .slice(0, opts.keywordPool);

  const seen = new Set(semantic.map(r => r.document_id));
  const pool = [...semantic];
  for (const r of keyword) {
    if (!seen.has(r.document_id)) {
      seen.add(r.document_id);
      pool.push(r);
    }
  }
  return pool;
}

/** Per-process call log, read by eval/recall-offline.ts for latency/cost/fallback reporting. */
export const rerankStats: { latencyMs: number; cost: number | null; ok: boolean; provider: 'cohere' | 'haiku' }[] = [];

export async function rerankDocuments(
  query: string,
  docs: HybridSearchResult[],
): Promise<RerankOutcome | null> {
  const t0 = Date.now();
  const cfg = CONCIERGE_CONFIG.retrieval.rerank;
  const provider = cfg.provider === 'haiku' ? 'haiku' : 'cohere';
  const out = provider === 'haiku' ? await rerankWithHaiku(query, docs) : await rerankDocumentsInner(query, docs);
  if (!out) rerankStats.push({ latencyMs: Date.now() - t0, cost: null, ok: false, provider });
  return out;
}

async function rerankDocumentsInner(
  query: string,
  docs: HybridSearchResult[],
): Promise<RerankOutcome | null> {
  const cfg = CONCIERGE_CONFIG.retrieval.rerank;
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || docs.length === 0) return null;

  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(RERANK_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        query,
        documents: docs.map(d =>
          `${d.document_title}\nClient: ${d.client_name ?? 'n/a'}\n${d.content}`.slice(0, cfg.maxDocChars),
        ),
        top_n: docs.length,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      RAGLogger.error('rerank non-2xx; keeping RRF order', { status: res.status });
      return null;
    }
    const json = (await res.json()) as {
      results?: { index: number; relevance_score: number }[];
      usage?: { cost?: number };
    };
    if (!Array.isArray(json.results)) {
      RAGLogger.error('rerank malformed response; keeping RRF order');
      return null;
    }
    const valid = json.results.filter(
      r => Number.isInteger(r.index) && r.index >= 0 && r.index < docs.length && typeof r.relevance_score === 'number',
    );
    if (valid.length === 0) {
      RAGLogger.error('rerank returned no usable results; keeping RRF order');
      return null;
    }
    valid.sort((a, b) => b.relevance_score - a.relevance_score);
    const scores = new Map(valid.map(r => [r.index, r.relevance_score]));
    const latencyMs = Date.now() - start;
    const cost = typeof json.usage?.cost === 'number' ? json.usage.cost : null;
    rerankStats.push({ latencyMs, cost, ok: true, provider: 'cohere' });
    RAGLogger.debug('rerank ok', { latencyMs, cost, docs: docs.length });
    return { order: valid.map(r => r.index), scores, latencyMs, cost };
  } catch (e) {
    RAGLogger.error('rerank failed; keeping RRF order', e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Reorder a pool by a rerank outcome; unscored docs keep pool order after scored ones. */
export function applyRerank(pool: HybridSearchResult[], out: RerankOutcome): HybridSearchResult[] {
  const scored = out.order.map(i => ({ ...pool[i], rerank_score: out.scores.get(i)! }));
  const used = new Set(out.order);
  const rest = pool.filter((_, i) => !used.has(i));
  return [...scored, ...rest];
}

// ---- Haiku listwise reranker (D-305) ----

// OpenRouter anthropic/claude-haiku-5.5 pricing, verified 2026-11-22 ($ per token).
export const HAIKU_PRICE_IN = 0.0000001;
export const HAIKU_PRICE_OUT = 0.0000005;

const HAIKU_SYSTEM_TEXT =
  "You rank Article Group case studies by how well each one answers a prospective client's question. Judge only from the text given. Output only a JSON array of the candidate numbers, most relevant first, including every candidate.";

/** First JSON integer array in the text, in-range, deduped in order; null if nothing usable. */
export function parseListwiseRanking(text: string, n: number): number[] | null {
  const m = text.match(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/);
  if (!m) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of arr) {
    if (Number.isInteger(v) && v >= 0 && v < n && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.length ? out : null;
}

export function listwiseScores(order: number[], n: number): Map<number, number> {
  return new Map(order.map((idx, rank) => [idx, (n - rank) / n]));
}

let haikuClient: Anthropic | null = null;

export async function rerankWithHaiku(
  query: string,
  docs: HybridSearchResult[],
): Promise<RerankOutcome | null> {
  const cfg = CONCIERGE_CONFIG.retrieval.rerank;
  if (docs.length === 0) return null;
  const start = Date.now();
  try {
    haikuClient ??= new Anthropic({ ...anthropicClientOptions(), maxRetries: 0, timeout: cfg.haikuTimeoutMs });
    const userText =
      `Question: ${query}\n\nCandidates:\n` +
      docs
        .map((d, i) => `[${i}] ${d.document_title} | Client: ${d.client_name ?? 'n/a'}\n${d.content.slice(0, cfg.haikuMaxDocChars)}\n\n`)
        .join('');
    const res = await haikuClient.messages.create({
      model: claudeModelId(cfg.haikuModel),
      max_tokens: 200,
      temperature: 0,
      system: HAIKU_SYSTEM_TEXT,
      messages: [{ role: 'user', content: userText }],
      // Haiku 5.5 thinks by default and thinking tokens consume max_tokens, leaving no text (found in the 03-11 bake-off).
      // The installed SDK types do not know this field yet, so it is passed through untyped.
      ...({ thinking: { type: 'disabled' } } as Record<string, unknown>),
    });
    const block = res.content.find(b => b.type === 'text');
    const text = block && block.type === 'text' ? block.text : '';
    const order = parseListwiseRanking(text, docs.length);
    if (!order) {
      RAGLogger.error('haiku rerank unparseable; keeping RRF order');
      return null;
    }
    const latencyMs = Date.now() - start;
    const cost = res.usage.input_tokens * HAIKU_PRICE_IN + res.usage.output_tokens * HAIKU_PRICE_OUT;
    rerankStats.push({ latencyMs, cost, ok: true, provider: 'haiku' });
    return { order, scores: listwiseScores(order, docs.length), latencyMs, cost };
  } catch (e) {
    RAGLogger.error('haiku rerank failed; keeping RRF order', e);
    return null;
  }
}
