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
 * Generate embeddings using OpenAI's text-embedding-3-small
 * You can swap this for any embedding model that outputs 1536 dimensions
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
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
  
  // Call the hybrid_search function
  const { data, error } = await supabase.rpc('hybrid_search', {
    query_embedding: queryEmbedding,
    query_text: query,
    doc_types: docTypes || null,
    capability_slugs: capabilitySlugs || null,
    industry_slugs: industrySlugs || null,
    topic_slugs: topicSlugs || null,
    match_count: matchCount,
    semantic_weight: semanticWeight,
  });
  
  if (error) {
    console.error('Hybrid search error:', error);
    throw error;
  }
  
  return data || [];
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
    console.error('Visual asset search error:', error);
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
    console.error('Metrics fetch error:', error);
    throw error;
  }
  
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
    console.error('Capabilities fetch error:', error);
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
    console.error('Industries fetch error:', error);
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
    console.error('Topics fetch error:', error);
    throw error;
  }
  
  return data || [];
}

// ============================================
// FULL CONTEXT RETRIEVAL
// ============================================

interface RetrieveContextParams {
  query: string;
  capabilitySlugs?: string[];
  industrySlugs?: string[];
  maxChunks?: number;
  maxAssets?: number;
  minRelevanceScore?: number;
}

/**
 * Capability keyword mapping for query enhancement.
 * Maps common terms users might use to capability slugs.
 */
const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  'brand-strategy': ['brand', 'branding', 'rebrand', 'brand identity', 'brand positioning', 'brand architecture'],
  'creative-direction': ['creative', 'visual', 'design', 'art direction', 'look and feel'],
  'content-strategy': ['content', 'storytelling', 'narrative', 'messaging', 'copywriting', 'editorial'],
  'social-media': ['social', 'social media', 'instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'community'],
  'video-production': ['video', 'film', 'commercial', 'documentary', 'motion', 'animation'],
  'digital-marketing': ['digital', 'marketing', 'paid media', 'advertising', 'campaign', 'ads'],
  'experiential': ['experiential', 'event', 'activation', 'pop-up', 'launch event', 'experience'],
  'web-development': ['web', 'website', 'digital product', 'app', 'platform', 'ux', 'ui'],
};

/**
 * Industry keyword mapping for query enhancement.
 * Maps common terms to industry slugs.
 */
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'technology': ['tech', 'technology', 'software', 'saas', 'startup', 'ai', 'fintech', 'b2b tech'],
  'finance': ['finance', 'financial', 'banking', 'fintech', 'investment', 'insurance', 'wealth'],
  'healthcare': ['health', 'healthcare', 'medical', 'pharma', 'wellness', 'fitness', 'biotech'],
  'consumer': ['consumer', 'cpg', 'retail', 'ecommerce', 'dtc', 'food', 'beverage', 'fashion'],
  'entertainment': ['entertainment', 'media', 'streaming', 'gaming', 'sports', 'music'],
  'real-estate': ['real estate', 'property', 'commercial real estate', 'residential'],
  'education': ['education', 'edtech', 'learning', 'university', 'school'],
  'nonprofit': ['nonprofit', 'ngo', 'charity', 'foundation', 'social impact'],
};

/**
 * Detects capabilities and industries from user query.
 * Returns slugs that match keywords in the query.
 */
function detectQueryIntent(query: string): { capabilities: string[]; industries: string[] } {
  const lowerQuery = query.toLowerCase();
  const detectedCapabilities: string[] = [];
  const detectedIndustries: string[] = [];

  // Check for capability keywords
  for (const [slug, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        if (!detectedCapabilities.includes(slug)) {
          detectedCapabilities.push(slug);
        }
        break;
      }
    }
  }

  // Check for industry keywords
  for (const [slug, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        if (!detectedIndustries.includes(slug)) {
          detectedIndustries.push(slug);
        }
        break;
      }
    }
  }

  return { capabilities: detectedCapabilities, industries: detectedIndustries };
}

/**
 * Main retrieval function that gathers all context needed for the orchestrator.
 * This is called before sending the user query to Claude.
 * 
 * Includes relevance filtering and deduplication to improve result quality.
 * IMPORTANT: Ensures a balanced mix of case studies and articles.
 */
export async function retrieveContext({
  query,
  capabilitySlugs,
  industrySlugs,
  maxChunks = 10,
  maxAssets = 5,
  minRelevanceScore = 0.15, // Lowered threshold - semantic scores are often 0.2-0.4
}: RetrieveContextParams): Promise<RetrievedContext> {
  // IMPROVEMENT: Auto-detect capabilities and industries from query
  const detectedIntent = detectQueryIntent(query);

  // Merge detected intents with explicitly provided filters
  const enhancedCapabilities = [
    ...(capabilitySlugs || []),
    ...detectedIntent.capabilities.filter(c => !capabilitySlugs?.includes(c))
  ];
  const enhancedIndustries = [
    ...(industrySlugs || []),
    ...detectedIntent.industries.filter(i => !industrySlugs?.includes(i))
  ];

  console.log(`[Retrieval] Detected capabilities: ${detectedIntent.capabilities.join(', ') || 'none'}`);
  console.log(`[Retrieval] Detected industries: ${detectedIntent.industries.join(', ') || 'none'}`);

  // Run searches in parallel for performance
  // First search: with detected filters for better case study matching
  // Second search: without filters as fallback for broader results
  const searchPromises: Promise<HybridSearchResult[]>[] = [
    hybridSearch({
      query,
      capabilitySlugs: enhancedCapabilities.length > 0 ? enhancedCapabilities : undefined,
      industrySlugs: enhancedIndustries.length > 0 ? enhancedIndustries : undefined,
      matchCount: maxChunks * 2,
    }),
  ];

  // Add a fallback search without filters if we detected intent
  // This ensures we still get results even if the filters are too restrictive
  if (enhancedCapabilities.length > 0 || enhancedIndustries.length > 0) {
    searchPromises.push(
      hybridSearch({
        query,
        matchCount: maxChunks * 2,
      })
    );
  }

  const [primaryResults, fallbackResults, visualAssets, capabilities, industries, topics] = await Promise.all([
    searchPromises[0],
    searchPromises[1] || Promise.resolve([]),
    searchVisualAssets({
      query,
      matchCount: maxAssets,
    }),
    getCapabilities(),
    getIndustries(),
    getTopics(),
  ]);

  // Merge results, preferring primary (filtered) results
  const seenIds = new Set<string>();
  const rawChunks: HybridSearchResult[] = [];

  // Add primary results first (these matched our detected filters)
  for (const chunk of primaryResults) {
    if (!seenIds.has(chunk.chunk_id)) {
      seenIds.add(chunk.chunk_id);
      // Boost score slightly for chunks that matched our detected filters
      rawChunks.push({
        ...chunk,
        combined_score: chunk.combined_score * 1.1, // 10% boost for filter matches
      });
    }
  }

  // Add fallback results that weren't in primary
  for (const chunk of fallbackResults) {
    if (!seenIds.has(chunk.chunk_id)) {
      seenIds.add(chunk.chunk_id);
      rawChunks.push(chunk);
    }
  }

  // Sort by combined score
  rawChunks.sort((a, b) => b.combined_score - a.combined_score);
  
  // Log raw results for debugging
  console.log(`[Retrieval] Query: "${query.slice(0, 50)}..."`);
  console.log(`[Retrieval] Raw chunks returned: ${rawChunks.length}`);
  if (rawChunks.length > 0) {
    console.log(`[Retrieval] Score range: ${rawChunks[rawChunks.length - 1]?.combined_score?.toFixed(3)} - ${rawChunks[0]?.combined_score?.toFixed(3)}`);
  }
  
  // IMPROVEMENT 1: Filter by minimum relevance score
  let relevantChunks = rawChunks.filter(chunk => chunk.combined_score >= minRelevanceScore);
  
  // FALLBACK: If filtering removed everything, use top results anyway
  if (relevantChunks.length === 0 && rawChunks.length > 0) {
    console.log(`[Retrieval] All chunks below threshold, using top results as fallback`);
    relevantChunks = rawChunks.slice(0, 10);
  }
  
  // IMPROVEMENT 2: Separate by document type for balanced results
  const caseStudyChunks = relevantChunks.filter(c => c.document_type === 'case_study');
  const articleChunks = relevantChunks.filter(c => c.document_type === 'article');

  console.log(`[Retrieval] Case studies: ${caseStudyChunks.length}, Articles: ${articleChunks.length}`);

  // IMPROVEMENT 3: Deduplicate - keep best chunk per document
  const getBestPerDocument = (chunks: typeof rawChunks) => {
    const bestChunkPerDocument = new Map<string, typeof rawChunks[0]>();
    for (const chunk of chunks) {
      const existing = bestChunkPerDocument.get(chunk.document_id);
      if (!existing || chunk.combined_score > existing.combined_score) {
        bestChunkPerDocument.set(chunk.document_id, chunk);
      }
    }
    return [...bestChunkPerDocument.values()]
      .sort((a, b) => b.combined_score - a.combined_score);
  };

  const bestCaseStudies = getBestPerDocument(caseStudyChunks);
  const bestArticles = getBestPerDocument(articleChunks);

  // FIX: If no case studies passed relevance filter but raw results had them,
  // include top 2 case studies anyway (addresses "missing 50% of time" issue)
  let fallbackCaseStudies: typeof rawChunks = [];
  if (bestCaseStudies.length === 0) {
    const allRawCaseStudies = rawChunks.filter(c => c.document_type === 'case_study');
    if (allRawCaseStudies.length > 0) {
      console.log(`[Retrieval] No case studies passed filter, including top 2 as fallback`);
      fallbackCaseStudies = getBestPerDocument(allRawCaseStudies).slice(0, 2);
    }
  }

  // IMPROVEMENT 4: Prioritize case studies, but include relevant articles
  // Take up to 4 case studies (or fallback if none passed filter) and up to 2 articles
  const maxCaseStudies = 4;
  const maxArticles = 2;

  const selectedCaseStudies = bestCaseStudies.length > 0
    ? bestCaseStudies.slice(0, maxCaseStudies)
    : fallbackCaseStudies;
  const selectedArticles = bestArticles.slice(0, maxArticles);
  
  // Combine and sort by score
  const finalChunks = [...selectedCaseStudies, ...selectedArticles]
    .sort((a, b) => b.combined_score - a.combined_score);
  
  // Log for debugging
  console.log(`[Retrieval] Query: "${query.slice(0, 50)}..."`);
  console.log(`[Retrieval] Raw chunks: ${rawChunks.length}, After filtering: ${relevantChunks.length}, Final: ${finalChunks.length}`);
  console.log(`[Retrieval] Top scores: ${finalChunks.slice(0, 3).map(c => c.combined_score.toFixed(3)).join(', ')}`);
  
  // Get unique document IDs from final chunks
  const documentIds = [...new Set(finalChunks.map((c) => c.document_id))];
  
  // Fetch metrics for retrieved documents
  const relatedMetrics = documentIds.length > 0
    ? await getDocumentMetrics(documentIds)
    : [];
  
  return {
    chunks: finalChunks,
    visualAssets,
    relatedMetrics,
    capabilities,
    industries,
    topics,
  };
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
    console.error('Signed URL error:', error);
    return null;
  }
  
  return data.signedUrl;
}
