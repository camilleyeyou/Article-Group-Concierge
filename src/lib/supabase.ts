/**
 * Article Group AI Concierge - Supabase Client & RAG Utilities
 * 
 * Handles all database interactions:
 * - Hybrid search (semantic + keyword)
 * - Visual asset retrieval with signed URLs
 * - Taxonomy filtering
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  HybridSearchResult,
  VisualAssetSearchResult,
  DocumentMetric,
  Capability,
  Industry,
  Topic,
  RetrievedContext,
} from '../types';
import { RAGLogger } from './logger';
import type { PerfMarks } from './perf-marks';
import { cache, CACHE_PREFIXES, CACHE_TTL } from './cache';
import { embeddingConfig } from './llm-config';
import { detectQueryIntent, isAboutAG } from './intent-keywords';
import { CONCIERGE_CONFIG, retrievalConfigKey, rerankEnabled } from './concierge-config';
import { buildRerankPool, rerankDocuments, applyRerank } from './rerank';

// Lazy-initialized Supabase client
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is required. Check your .env.local file.');
    }
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.');
    }
    
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// Export for backward compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  }
});

// ============================================
// EMBEDDING GENERATION
// ============================================

/**
 * Generate embeddings using OpenAI's text-embedding-3-small (directly or via OpenRouter)
 * You can swap this for any embedding model that outputs 1536 dimensions
 *
 * CACHED: Embeddings are cached for 24 hours to reduce API costs
 */
const embeddingInflight = new Map<string, Promise<number[]>>();

export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cached = cache.get<number[]>(CACHE_PREFIXES.EMBEDDING, text);
  if (cached) {
    return cached;
  }

  // The cache is only filled after the fetch resolves, so concurrent callers for the same text
  // (hybrid search + visual asset search) share one in-flight request instead of paying twice.
  const pending = embeddingInflight.get(text);
  if (pending) return pending;
  const p = fetchEmbedding(text).finally(() => embeddingInflight.delete(text));
  embeddingInflight.set(text, p);
  return p;
}

async function fetchEmbedding(text: string): Promise<number[]> {
  const { baseURL, apiKey, model } = embeddingConfig();
  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const err = new Error(
      `Embedding API error (${response.status} ${response.statusText}): ${bodyText.slice(0, 200)}`
    ) as Error & { code: string; status: number };
    err.status = response.status;
    // OpenAI: 429 insufficient_quota; OpenRouter: 402 Payment Required
    if (response.status === 402 || (response.status === 429 && bodyText.includes('insufficient_quota'))) {
      err.code = 'embeddings_quota_exceeded';
    } else if (response.status === 429) {
      err.code = 'embeddings_rate_limited';
    } else {
      err.code = 'embeddings_failed';
    }
    throw err;
  }

  const data = await response.json();
  const embedding = data.data[0].embedding;

  // Cache the embedding
  cache.set(CACHE_PREFIXES.EMBEDDING, text, embedding, CACHE_TTL.EMBEDDING);

  return embedding;
}

// ============================================
// HYBRID SEARCH
// ============================================

interface HybridSearchParams {
  query: string;
  docTypes?: ('case_study' | 'article')[];
  capabilitySlugs?: string[];
  industrySlugs?: string[];
  topicSlugs?: string[];
  matchCount?: number;
  semanticWeight?: number;
}

/**
 * Perform hybrid search combining semantic similarity and keyword matching.
 * Uses the hybrid_search PostgreSQL function defined in schema.sql
 */
export async function hybridSearch({
  query,
  docTypes,
  capabilitySlugs,
  industrySlugs,
  topicSlugs,
  matchCount = 10,
  semanticWeight = 0.7,
}: HybridSearchParams): Promise<HybridSearchResult[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  
  const params = {
    query_embedding: queryEmbedding,
    query_text: query,
    doc_types: docTypes || null,
    capability_slugs: capabilitySlugs || null,
    industry_slugs: industrySlugs || null,
    topic_slugs: topicSlugs || null,
    match_count: matchCount,
    semantic_weight: semanticWeight,
  };

  // hybrid_search_exact (migration 004) is hybrid_search with ivfflat.probes = 100, so the
  // vector scan is exact. Plain hybrid_search probes 1 of 100 ivfflat lists once its cached
  // generic plan uses the index, silently dropping most rows. Fall back to the old function
  // only if 004 has not been applied yet (PostgREST "function not found").
  let { data, error } = await supabase.rpc('hybrid_search_exact', params);
  if (error && (error.code === 'PGRST202' || error.code === '42883')) {
    RAGLogger.error('hybrid_search_exact missing; falling back to lossy hybrid_search', error);
    ({ data, error } = await supabase.rpc('hybrid_search', params));
  }

  if (error) {
    RAGLogger.error('Hybrid search error', error);
    throw error;
  }
  
  return data || [];
}

// ============================================
// HYBRID SEARCH V2 (RRF, whole corpus)
// ============================================

export interface HybridSearchV2Params {
  query: string;
  matchCount?: number;
  docTypes?: ('case_study' | 'article')[];
  boostCapabilitySlugs?: string[];
  boostIndustrySlugs?: string[];
  includeCompanyInfo?: boolean;
  rrfK?: number;
  intentBoost?: number;
  /**
   * Return only the rows retrieveContext keeps (best chunk per document, top N per type),
   * selected in the database by hybrid_search_v2_top (migration 006). Same v2 ranking,
   * ~10 rows instead of matchCount, which cuts response transfer on the teaser path.
   */
  top?: { maxCaseStudies: number; maxArticles: number };
}

const nonEmpty = <T,>(a?: T[]): T[] | null => (a && a.length > 0 ? a : null);
let v2TopMissing = false;

/**
 * Call hybrid_search_v2 (migration 005). If the function is not deployed yet,
 * fall back to the old hybrid_search_exact path so code can ship before the migration.
 */
export async function hybridSearchV2(p: HybridSearchV2Params, marks?: PerfMarks): Promise<{
  rows: HybridSearchResult[];
  fn: 'hybrid_search_v2' | 'hybrid_search_exact' | 'hybrid_search';
}> {
  const R = CONCIERGE_CONFIG.retrieval;
  marks?.mark('embed_start');
  marks?.mark('embed_cache_hit', cache.get<number[]>(CACHE_PREFIXES.EMBEDDING, p.query) ? 1 : 0);
  const queryEmbedding = await generateEmbedding(p.query);
  marks?.mark('embed_end');

  marks?.mark('rpc_start');
  const args = {
    query_embedding: queryEmbedding,
    query_text: p.query,
    match_count: p.matchCount ?? R.matchCount,
    doc_types: p.docTypes ?? null,
    boost_capability_slugs: nonEmpty(p.boostCapabilitySlugs),
    boost_industry_slugs: nonEmpty(p.boostIndustrySlugs),
    include_company_info: p.includeCompanyInfo ?? false,
    rrf_k: p.rrfK ?? R.rrfK,
    intent_boost: p.intentBoost ?? R.intentBoost,
  };
  let data: unknown = null;
  let error: { code?: string } | null = null;
  if (p.top && !v2TopMissing) {
    ({ data, error } = await supabase.rpc('hybrid_search_v2_top', {
      ...args,
      max_case_studies: p.top.maxCaseStudies,
      max_articles: p.top.maxArticles,
    }));
    if (error && (error.code === 'PGRST202' || error.code === '42883')) {
      // Migration 006 not applied yet: use plain v2 (same ranking, more rows) from now on
      RAGLogger.error('hybrid_search_v2_top missing; using hybrid_search_v2', error);
      v2TopMissing = true;
      data = null;
      error = null;
    }
  }
  if (data === null && error === null) {
    ({ data, error } = await supabase.rpc('hybrid_search_v2', args));
  }
  marks?.mark('rpc_end');
  marks?.mark('rows', (data as any[] | null)?.length ?? 0);

  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      RAGLogger.error('hybrid_search_v2 missing; falling back to hybrid_search_exact', error);
      return { rows: await hybridSearch({ query: p.query, matchCount: 20 }), fn: 'hybrid_search_exact' };
    }
    RAGLogger.error('hybrid_search_v2 error', error);
    throw error;
  }

  const rows: HybridSearchResult[] = ((data as any[]) || []).map((row) => ({
    ...row,
    similarity_score: row.semantic_score,
    keyword_score: row.keyword_score ?? 0,
    combined_score: row.combined_score,
    semantic_rank: row.semantic_rank,
    keyword_rank: row.keyword_rank,
    intent_match: row.intent_match,
    metadata: row.metadata ?? {},
    author: row.author ?? null,
  }));
  return { rows, fn: 'hybrid_search_v2' };
}

// ============================================
// VISUAL ASSET SEARCH
// ============================================

interface VisualAssetSearchParams {
  query: string;
  documentIds?: string[];
  assetTypes?: string[];
  matchCount?: number;
}

const VISUAL_COUNT_TTL_EMPTY_MS = 5 * 60 * 1000;
const VISUAL_COUNT_TTL_MS = 60 * 60 * 1000;
let visualCountMemo: { n: number; at: number } | null = null;
let visualCountInflight: Promise<boolean> | null = null;

/**
 * True when at least one visual asset has an embedded description (the rows search_visual_assets
 * can return). The count is memoised; an empty table is rechecked every 5 minutes so assets added
 * later are picked up, a non-empty one every hour. On any error we return true (do the real search).
 */
export async function visualAssetsIndexed(): Promise<boolean> {
  if (visualCountMemo) {
    const ttl = visualCountMemo.n === 0 ? VISUAL_COUNT_TTL_EMPTY_MS : VISUAL_COUNT_TTL_MS;
    if (Date.now() - visualCountMemo.at < ttl) return visualCountMemo.n > 0;
  }
  if (visualCountInflight) return visualCountInflight;
  visualCountInflight = (async () => {
    const { count, error } = await supabase
      .from('visual_assets')
      .select('id', { count: 'exact', head: true })
      .not('description_embedding', 'is', null);
    if (error || count == null) {
      RAGLogger.error('visual asset count unavailable; searching anyway', error);
      return true;
    }
    visualCountMemo = { n: count, at: Date.now() };
    return count > 0;
  })().finally(() => {
    visualCountInflight = null;
  });
  return visualCountInflight;
}

/**
 * Search for relevant visual assets based on their descriptions.
 * Returns results with signed URLs for secure access.
 */
export async function searchVisualAssets({
  query,
  documentIds,
  assetTypes,
  matchCount = 5,
}: VisualAssetSearchParams): Promise<VisualAssetSearchResult[]> {
  // Nothing indexed: skip the embedding and the RPC (self-heals, see visualAssetsIndexed)
  if (!(await visualAssetsIndexed())) return [];

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  
  // Call the search_visual_assets function
  const { data, error } = await supabase.rpc('search_visual_assets', {
    query_embedding: queryEmbedding,
    document_ids: documentIds || null,
    asset_types: assetTypes || null,
    match_count: matchCount,
  });
  
  if (error) {
    RAGLogger.error('Visual asset search error', error);
    throw error;
  }
  
  // Generate signed URLs for each asset
  const resultsWithUrls = await Promise.all(
    (data || []).map(async (asset: VisualAssetSearchResult) => {
      const { data: signedUrlData } = await supabase.storage
        .from(asset.bucket_name)
        .createSignedUrl(asset.storage_path, 3600); // 1 hour expiry
      
      return {
        ...asset,
        signed_url: signedUrlData?.signedUrl,
      };
    })
  );
  
  return resultsWithUrls;
}

// ============================================
// METRICS RETRIEVAL
// ============================================

/**
 * Get metrics for specific documents
 */
export async function getDocumentMetrics(
  documentIds: string[]
): Promise<DocumentMetric[]> {
  const { data, error } = await supabase
    .from('document_metrics')
    .select('*')
    .in('document_id', documentIds)
    .order('display_order', { ascending: true });
  
  if (error) {
    RAGLogger.error('Metrics fetch error', error);
    throw error;
  }
  
  return data || [];
}

const METRICS_API_ROW_LIMIT = 1000;

/**
 * Metrics for every document, in the same display_order ordering as getDocumentMetrics. Lets
 * retrieveContext start the fetch before the search result (and so the document ids) is known.
 * Returns null if the API row cap may have truncated the result; the caller then falls back to
 * the per-document query.
 */
async function getAllDocumentMetrics(): Promise<DocumentMetric[] | null> {
  const { data, error } = await supabase
    .from('document_metrics')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    RAGLogger.error('Metrics fetch error', error);
    throw error;
  }
  if ((data?.length ?? 0) >= METRICS_API_ROW_LIMIT) return null;
  return data || [];
}

// Alias for backward compatibility
export const getCaseStudyMetrics = getDocumentMetrics;

// ============================================
// TAXONOMY HELPERS
// ============================================

/**
 * Get all capabilities (for filtering UI)
 */
export async function getCapabilities(): Promise<Capability[]> {
  const { data, error } = await supabase
    .from('capabilities')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    RAGLogger.error('Capabilities fetch error', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Get all industries (for filtering UI)
 */
export async function getIndustries(): Promise<Industry[]> {
  const { data, error } = await supabase
    .from('industries')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    RAGLogger.error('Industries fetch error', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Get all topics (for filtering UI, primarily for articles)
 */
export async function getTopics(): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    RAGLogger.error('Topics fetch error', error);
    throw error;
  }
  
  return data || [];
}

// ============================================
// FULL CONTEXT RETRIEVAL
// ============================================

const TAXONOMY_TTL_MS = 60 * 60 * 1000;
interface Taxonomy {
  capabilities: Capability[];
  industries: Industry[];
  topics: Topic[];
}
let taxonomyMemo: { value: Taxonomy; at: number } | null = null;
let taxonomyInflight: Promise<Taxonomy> | null = null;

/** Static taxonomy tables, memoised 1 h (same pattern as the catalogue). Failures are not memoised. */
async function getTaxonomy(): Promise<Taxonomy> {
  if (taxonomyMemo && Date.now() - taxonomyMemo.at < TAXONOMY_TTL_MS) return taxonomyMemo.value;
  if (taxonomyInflight) return taxonomyInflight;
  taxonomyInflight = (async () => {
    const [capabilities, industries, topics] = await Promise.all([getCapabilities(), getIndustries(), getTopics()]);
    const value: Taxonomy = { capabilities, industries, topics };
    taxonomyMemo = { value, at: Date.now() };
    return value;
  })().finally(() => {
    taxonomyInflight = null;
  });
  return taxonomyInflight;
}

/** Test hook: clear the retrieval memos. */
export function __resetRetrievalMemos(): void {
  taxonomyMemo = null;
  taxonomyInflight = null;
  visualCountMemo = null;
  visualCountInflight = null;
  caseStudyChunkCache = null;
  v2TopMissing = false;
}

interface RetrieveContextParams {
  query: string;
  capabilitySlugs?: string[];
  industrySlugs?: string[];
  /** Ignored: caps come from CONCIERGE_CONFIG.retrieval. Kept so callers compile unchanged. */
  maxChunks?: number;
  maxAssets?: number;
  skipCache?: boolean; // Eval runs need fresh results after reingestion
  /**
   * Called with the final chunks as soon as the search (and rerank, if on) is done, before the
   * visual-asset, taxonomy and metrics fetches finish. Also called on a cache hit.
   */
  onChunks?: (chunks: HybridSearchResult[]) => void;
  marks?: PerfMarks; // PERF-01 timing marks (optional)
}

let caseStudyChunkCache: { n: number; at: number } | null = null;

/** Number of retrievable case-study chunks (memoised 1 h); used to size the rerank pool call. */
export async function getCaseStudyChunkCount(): Promise<number> {
  const fallback = CONCIERGE_CONFIG.retrieval.rerank.matchCountFallback;
  if (caseStudyChunkCache && Date.now() - caseStudyChunkCache.at < 3600_000) return caseStudyChunkCache.n;
  const { count, error } = await supabase
    .from('content_chunks')
    .select('id, documents!inner(doc_type)', { count: 'exact', head: true })
    .eq('documents.doc_type', 'case_study')
    .not('embedding', 'is', null);
  if (error || count == null) {
    RAGLogger.error('case-study chunk count unavailable; using fallback', error);
    return fallback;
  }
  caseStudyChunkCache = { n: count, at: Date.now() };
  return count;
}

/**
 * Main retrieval function that gathers all context needed for the orchestrator.
 * One hybrid_search_v2 call (RRF, whole corpus), whole-word intent as a soft boost,
 * best chunk per document, no relevance cutoff. Case studies first, then articles,
 * each group in RRF order.
 *
 * CACHED: Results are cached for 1 hour to reduce database load and API costs
 */
export async function retrieveContext({
  query,
  capabilitySlugs,
  industrySlugs,
  maxAssets = 5,
  skipCache = false,
  onChunks,
  marks,
}: RetrieveContextParams): Promise<RetrievedContext> {
  const R = CONCIERGE_CONFIG.retrieval;
  const cacheKey = {
    query,
    capabilitySlugs: capabilitySlugs ? [...capabilitySlugs].sort() : undefined,
    industrySlugs: industrySlugs ? [...industrySlugs].sort() : undefined,
    maxAssets,
    retrieval: retrievalConfigKey(),
  };

  const cached = skipCache
    ? null
    : cache.get<RetrievedContext>(CACHE_PREFIXES.RAG_SEARCH, cacheKey);
  if (cached) {
    RAGLogger.debug('Using cached RAG results', { query: query.slice(0, 50) });
    onChunks?.(cached.chunks);
    return cached;
  }

  // Whole-word intent, used only as a soft boost (never a filter)
  const detectedIntent = detectQueryIntent(query);
  const boostCapabilities = [
    ...(capabilitySlugs || []),
    ...detectedIntent.capabilities.filter(c => !capabilitySlugs?.includes(c)),
  ];
  const boostIndustries = [
    ...(industrySlugs || []),
    ...detectedIntent.industries.filter(i => !industrySlugs?.includes(i)),
  ];

  RAGLogger.debug('Detected intent from query', {
    capabilities: detectedIntent.capabilities.join(', ') || 'none',
    industries: detectedIntent.industries.join(', ') || 'none',
  });

  const useRerank = rerankEnabled();
  // Everything starts now. Only the search (and rerank pool) gate the chunk selection; the visual
  // assets, taxonomy and metrics fetches run alongside it and are awaited afterwards.
  const searchP = hybridSearchV2({
    query,
    boostCapabilitySlugs: boostCapabilities,
    boostIndustrySlugs: boostIndustries,
    includeCompanyInfo: isAboutAG(query),
    top: { maxCaseStudies: R.maxCaseStudies, maxArticles: R.maxArticles },
  }, marks);
  const poolP = useRerank
    ? getCaseStudyChunkCount().then(n =>
        hybridSearchV2({
          query,
          docTypes: ['case_study'],
          matchCount: n,
          boostCapabilitySlugs: boostCapabilities,
          boostIndustrySlugs: boostIndustries,
          includeCompanyInfo: false,
        }).then(r => ({ ...r, asked: n })),
      )
    : Promise.resolve(null);
  const sideP = Promise.all([searchVisualAssets({ query, matchCount: maxAssets }), getTaxonomy()]);
  const metricsP = getAllDocumentMetrics();
  // If the search throws we never await these; keep their rejections from going unhandled.
  sideP.catch(() => {});
  metricsP.catch(() => {});
  const [search, poolSearch] = await Promise.all([searchP, poolP]);
  const { rows: rawChunks, fn } = search;
  marks?.mark('search_done');

  // Best chunk per document (highest combined_score; ties keep input order), RRF order
  const getBestPerDocument = (chunks: HybridSearchResult[]) => {
    const best = new Map<string, HybridSearchResult>();
    for (const chunk of chunks) {
      const existing = best.get(chunk.document_id);
      if (!existing || chunk.combined_score > existing.combined_score) {
        best.set(chunk.document_id, chunk);
      }
    }
    return [...best.values()]
      .map((chunk, i) => ({ chunk, i }))
      .sort((a, b) => b.chunk.combined_score - a.chunk.combined_score || a.i - b.i)
      .map(x => x.chunk);
  };

  const bestCaseStudies = getBestPerDocument(rawChunks.filter(c => c.document_type === 'case_study'));
  const bestArticles = getBestPerDocument(rawChunks.filter(c => c.document_type === 'article'));

  // RETR-06 rerank hook: CONCIERGE_CONFIG.retrieval.rerank (Cohere or Haiku listwise, provider switch) replaces the case-study selection here.
  let selectedCaseStudies = bestCaseStudies.slice(0, R.maxCaseStudies);
  if (poolSearch && poolSearch.fn === 'hybrid_search_v2') {
    if (poolSearch.rows.length >= poolSearch.asked && caseStudyChunkCache === null) {
      RAGLogger.error('rerank pool may be truncated', { asked: poolSearch.asked, got: poolSearch.rows.length });
    }
    const pool = buildRerankPool(poolSearch.rows, {
      semanticPool: R.rerank.semanticPool,
      keywordPool: R.rerank.keywordPool,
    });
    const out = await rerankDocuments(query, pool);
    if (out) selectedCaseStudies = applyRerank(pool, out).slice(0, R.maxCaseStudies);
  }
  const selectedArticles = bestArticles.slice(0, R.maxArticles);

  // Case studies first; RRF scores are per-type ranks, so cross-type order means nothing
  const finalChunks = [...selectedCaseStudies, ...selectedArticles];

  RAGLogger.debug('Final retrieval results', {
    query: query.slice(0, 50) + '...',
    search_function: fn,
    raw_chunks: rawChunks.length,
    case_studies: selectedCaseStudies.length,
    articles: selectedArticles.length,
    top_ranks: rawChunks.slice(0, 3).map(c => `${c.semantic_rank ?? '-'}/${c.keyword_rank ?? '-'}`).join(', '),
  });

  marks?.mark('chunks_ready');
  onChunks?.(finalChunks);

  const documentIds = [...new Set(finalChunks.map((c) => c.document_id))];
  let relatedMetrics: DocumentMetric[] = [];
  if (documentIds.length > 0) {
    const all = await metricsP;
    if (all) {
      const wanted = new Set(documentIds);
      relatedMetrics = all.filter(m => wanted.has(m.document_id));
    } else {
      relatedMetrics = await getDocumentMetrics(documentIds);
    }
  }
  const [visualAssets, { capabilities, industries, topics }] = await sideP;

  const result: RetrievedContext = {
    chunks: finalChunks,
    visualAssets,
    relatedMetrics,
    capabilities,
    industries,
    topics,
    searchFunction: fn,
  };

  cache.set(CACHE_PREFIXES.RAG_SEARCH, cacheKey, result, CACHE_TTL.RAG_SEARCH);

  return result;
}

// ============================================
// SIGNED URL HELPER
// ============================================

/**
 * Generate a signed URL for a storage asset.
 * Used when the orchestrator references an image_url from context.
 */
export async function getSignedUrl(
  bucketName: string,
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(storagePath, expiresIn);
  
  if (error) {
    RAGLogger.error('Signed URL error', error);
    return null;
  }
  
  return data.signedUrl;
}
