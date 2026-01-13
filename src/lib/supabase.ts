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
}

/**
 * Main retrieval function that gathers all context needed for the orchestrator.
 * This is called before sending the user query to Claude.
 */
export async function retrieveContext({
  query,
  capabilitySlugs,
  industrySlugs,
  maxChunks = 10,
  maxAssets = 5,
}: RetrieveContextParams): Promise<RetrievedContext> {
  // Run searches in parallel for performance
  const [chunks, visualAssets, capabilities, industries, topics] = await Promise.all([
    hybridSearch({
      query,
      capabilitySlugs,
      industrySlugs,
      matchCount: maxChunks,
    }),
    searchVisualAssets({
      query,
      matchCount: maxAssets,
    }),
    getCapabilities(),
    getIndustries(),
    getTopics(),
  ]);
  
  // Get unique document IDs from chunks
  const documentIds = [...new Set(chunks.map((c) => c.document_id))];
  
  // Fetch metrics for retrieved documents
  const relatedMetrics = documentIds.length > 0
    ? await getDocumentMetrics(documentIds)
    : [];
  
  return {
    chunks,
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
