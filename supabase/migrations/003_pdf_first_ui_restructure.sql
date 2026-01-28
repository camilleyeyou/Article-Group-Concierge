-- Migration: PDF-First UI/UX Restructure
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD COLUMNS TO DOCUMENTS TABLE
-- ============================================

-- Thumbnail URL (auto-generated PDF preview image)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Hero video URL (for detail page hero section)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS hero_video_url TEXT;

-- ============================================
-- 2. SUPPORT VIDEOS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS support_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  storage_path TEXT, -- Path in Supabase Storage
  title TEXT,
  description TEXT,
  duration_seconds INT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_support_videos_document 
ON support_videos(document_id);

-- ============================================
-- 3. FUNCTION: GET RELATED ARTICLES
-- ============================================

-- Auto-detect related articles based on shared capabilities/industries
CREATE OR REPLACE FUNCTION get_related_articles(
  case_study_id UUID,
  max_results INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  summary TEXT,
  thumbnail_url TEXT,
  pdf_url TEXT,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH case_study_caps AS (
    -- Get capabilities of the case study
    SELECT capability_id FROM document_capabilities WHERE document_id = case_study_id
  ),
  case_study_industries AS (
    -- Get industries of the case study
    SELECT industry_id FROM document_industries WHERE document_id = case_study_id
  ),
  article_scores AS (
    SELECT 
      d.id,
      d.title,
      d.slug,
      d.summary,
      d.thumbnail_url,
      d.pdf_url,
      -- Score based on shared capabilities and industries
      (
        COALESCE((
          SELECT COUNT(*)::FLOAT FROM document_capabilities dc
          WHERE dc.document_id = d.id 
          AND dc.capability_id IN (SELECT capability_id FROM case_study_caps)
        ), 0) * 2 -- Weight capabilities higher
        +
        COALESCE((
          SELECT COUNT(*)::FLOAT FROM document_industries di
          WHERE di.document_id = d.id 
          AND di.industry_id IN (SELECT industry_id FROM case_study_industries)
        ), 0)
      ) AS relevance_score
    FROM documents d
    WHERE d.doc_type = 'article'
    AND d.id != case_study_id
  )
  SELECT 
    a.id,
    a.title,
    a.slug,
    a.summary,
    a.thumbnail_url,
    a.pdf_url,
    a.relevance_score
  FROM article_scores a
  WHERE a.relevance_score > 0
  ORDER BY a.relevance_score DESC, a.title ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. FUNCTION: GET RELATED ARTICLES BY EMBEDDING SIMILARITY
-- ============================================

-- Fallback: If no shared capabilities, use embedding similarity
CREATE OR REPLACE FUNCTION get_related_articles_by_similarity(
  case_study_id UUID,
  max_results INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  summary TEXT,
  thumbnail_url TEXT,
  pdf_url TEXT,
  similarity_score FLOAT
) AS $$
DECLARE
  case_study_embedding vector(1536);
BEGIN
  -- Get the embedding of the case study's first chunk
  SELECT cc.embedding INTO case_study_embedding
  FROM content_chunks cc
  WHERE cc.document_id = case_study_id
  ORDER BY cc.chunk_index
  LIMIT 1;
  
  IF case_study_embedding IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT DISTINCT ON (d.id)
    d.id,
    d.title,
    d.slug,
    d.summary,
    d.thumbnail_url,
    d.pdf_url,
    (1 - (cc.embedding <=> case_study_embedding))::FLOAT AS similarity_score
  FROM documents d
  JOIN content_chunks cc ON cc.document_id = d.id
  WHERE d.doc_type = 'article'
  AND d.id != case_study_id
  ORDER BY d.id, (cc.embedding <=> case_study_embedding) ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. UPDATE HYBRID SEARCH TO INCLUDE THUMBNAIL
-- ============================================

-- Drop and recreate hybrid_search to include thumbnail_url
DROP FUNCTION IF EXISTS hybrid_search(vector(1536), TEXT, document_type[], TEXT[], TEXT[], TEXT[], INT, FLOAT);

CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text TEXT,
  doc_types document_type[] DEFAULT NULL,
  capability_slugs TEXT[] DEFAULT NULL,
  industry_slugs TEXT[] DEFAULT NULL,
  topic_slugs TEXT[] DEFAULT NULL,
  match_count INT DEFAULT 10,
  semantic_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  document_title TEXT,
  document_type document_type,
  client_name TEXT,
  slug TEXT,
  vimeo_url TEXT,
  thumbnail_url TEXT,
  pdf_url TEXT,
  hero_video_url TEXT,
  content TEXT,
  chunk_type TEXT,
  semantic_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT 
      cc.id AS chunk_id,
      cc.document_id,
      d.title AS document_title,
      d.doc_type AS document_type,
      d.client_name,
      d.slug,
      d.vimeo_url,
      d.thumbnail_url,
      d.pdf_url,
      d.hero_video_url,
      cc.content,
      cc.chunk_type,
      (1 - (cc.embedding <=> query_embedding))::FLOAT AS semantic_score
    FROM content_chunks cc
    JOIN documents d ON cc.document_id = d.id
    WHERE 
      (doc_types IS NULL OR d.doc_type = ANY(doc_types))
      AND (capability_slugs IS NULL OR EXISTS (
        SELECT 1 FROM document_capabilities dc 
        WHERE dc.document_id = d.id AND dc.capability_id IN (
          SELECT c.id FROM capabilities c WHERE c.slug = ANY(capability_slugs)
        )
      ))
      AND (industry_slugs IS NULL OR EXISTS (
        SELECT 1 FROM document_industries di 
        WHERE di.document_id = d.id AND di.industry_id IN (
          SELECT i.id FROM industries i WHERE i.slug = ANY(industry_slugs)
        )
      ))
      AND (topic_slugs IS NULL OR EXISTS (
        SELECT 1 FROM document_topics dt 
        WHERE dt.document_id = d.id AND dt.topic_id IN (
          SELECT t.id FROM topics t WHERE t.slug = ANY(topic_slugs)
        )
      ))
    ORDER BY cc.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  keyword_results AS (
    SELECT 
      sr.*,
      COALESCE(
        ts_rank(
          to_tsvector('english', sr.content || ' ' || sr.document_title || ' ' || COALESCE(sr.client_name, '')),
          plainto_tsquery('english', query_text)
        ),
        0
      )::FLOAT AS keyword_score
    FROM semantic_results sr
  )
  SELECT 
    kr.chunk_id,
    kr.document_id,
    kr.document_title,
    kr.document_type,
    kr.client_name,
    kr.slug,
    kr.vimeo_url,
    kr.thumbnail_url,
    kr.pdf_url,
    kr.hero_video_url,
    kr.content,
    kr.chunk_type,
    kr.semantic_score,
    kr.keyword_score,
    (semantic_weight * kr.semantic_score + (1 - semantic_weight) * kr.keyword_score)::FLOAT AS combined_score
  FROM keyword_results kr
  ORDER BY (semantic_weight * kr.semantic_score + (1 - semantic_weight) * kr.keyword_score) DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CREATE STORAGE BUCKETS (Run manually in Supabase Dashboard)
-- ============================================

-- Note: You need to create these buckets in Supabase Dashboard -> Storage:
-- 1. "thumbnails" - for PDF preview images (public)
-- 2. "case-study-videos" - for hero and support videos (public)

-- Or use this SQL (may require admin privileges):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('case-study-videos', 'case-study-videos', true);

COMMENT ON TABLE support_videos IS 'Stores support/supplementary videos for case studies';
COMMENT ON COLUMN documents.thumbnail_url IS 'Auto-generated PDF preview image URL';
COMMENT ON COLUMN documents.hero_video_url IS 'Video URL for detail page hero section';
