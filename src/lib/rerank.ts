/**
 * RETR-06: Cohere reranker through OpenRouter (POST /api/v1/rerank).
 * Never throws: any failure returns null and the caller keeps the RRF order.
 */
import type { HybridSearchResult } from '../types';
import { RAGLogger } from './logger';
import { CONCIERGE_CONFIG } from './concierge-config';

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
export const rerankStats: { latencyMs: number; cost: number | null; ok: boolean }[] = [];

export async function rerankDocuments(
  query: string,
  docs: HybridSearchResult[],
): Promise<RerankOutcome | null> {
  const t0 = Date.now();
  const out = await rerankDocumentsInner(query, docs);
  if (!out) rerankStats.push({ latencyMs: Date.now() - t0, cost: null, ok: false });
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
    rerankStats.push({ latencyMs, cost, ok: true });
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
