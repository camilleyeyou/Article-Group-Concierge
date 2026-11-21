-- Migration 004: hybrid_search_exact (Phase 2 recall regression fix)
-- Run in the Supabase SQL Editor. Additive only: creates a NEW function next to
-- hybrid_search, which stays unchanged (production rule: add alongside, never replace).
--
-- Why: content_chunks.embedding has an ivfflat index (lists = 100) and nothing sets
-- ivfflat.probes (default 1). Once content_chunks grew past ~43 rows, plpgsql's cached
-- generic plan switched to the index and scanned 1 of 100 lists, returning 0-14 rows
-- instead of match_count * 3. Recall fell from 39/52 to 11/52
-- (see .planning/debug/phase2-recall-regression.md).
-- Fix: same body as 003's hybrid_search, plus set_config('ivfflat.probes','100',true)
-- at the top so the scan is exact. (A function-level SET clause fails in Supabase with
-- 42501 permission denied, so the setting is applied inside the body.)
--
-- Rollback: DROP FUNCTION hybrid_search_exact(vector, text, document_type[], text[], text[], text[], int, float);
-- (the app falls back to hybrid_search if this function is missing)

CREATE OR REPLACE FUNCTION hybrid_search_exact(
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
  -- Exact scan: probe every ivfflat list (lists = 100). Set at call time, scoped to the
  -- current transaction: a SET clause on the function needs superuser in Supabase
  -- (42501), but set_config works for any role once pgvector is loaded.
  PERFORM set_config('ivfflat.probes', '100', true);
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

GRANT EXECUTE ON FUNCTION hybrid_search_exact(vector, text, document_type[], text[], text[], text[], int, float) TO anon, authenticated, service_role;
