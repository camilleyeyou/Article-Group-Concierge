-- Migration 006: hybrid_search_v2_top (PERF-01, quick task 261124-80m)
-- Run in the Supabase SQL Editor. Additive only: a NEW function that wraps
-- hybrid_search_v2 (unchanged) and returns only the rows the app keeps.
--
-- Why: the app asks v2 for 60 rows (~123 KB of JSON) but keeps only the best chunk
-- per document, top 8 case studies + top 2 articles. Measured from the dev machine,
-- 60 rows take ~1070 ms vs ~590 ms for 10 rows; the difference is response transfer.
-- Doing the same selection in the database returns ~10 rows instead.
--
-- Selection is identical to retrieveContext() in src/lib/supabase.ts:
--   * best chunk per document = highest combined_score, ties keep v2 order
--   * per doc type, documents ordered by that score, ties keep v2 order
--   * case_study capped at max_case_studies, article at max_articles, other types dropped
-- Ranking is v2's: same arguments are passed straight through, including match_count.
--
-- Rollback: DROP FUNCTION hybrid_search_v2_top(vector, text, int, document_type[], text[], text[], boolean, int, float, int, int);
-- (the app falls back to hybrid_search_v2 if this function is missing)

CREATE OR REPLACE FUNCTION hybrid_search_v2_top(
  query_embedding vector(1536),
  query_text TEXT,
  match_count INT DEFAULT 60,
  doc_types document_type[] DEFAULT NULL,
  boost_capability_slugs TEXT[] DEFAULT NULL,
  boost_industry_slugs TEXT[] DEFAULT NULL,
  include_company_info BOOLEAN DEFAULT FALSE,
  rrf_k INT DEFAULT 60,
  intent_boost FLOAT DEFAULT 0.0,
  max_case_studies INT DEFAULT 8,
  max_articles INT DEFAULT 2
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  document_title TEXT,
  document_type document_type,
  client_name TEXT,
  author TEXT,
  slug TEXT,
  vimeo_url TEXT,
  thumbnail_url TEXT,
  pdf_url TEXT,
  hero_video_url TEXT,
  content TEXT,
  chunk_type TEXT,
  metadata JSONB,
  semantic_score FLOAT,
  keyword_score FLOAT,
  semantic_rank INT,
  keyword_rank INT,
  intent_match BOOLEAN,
  combined_score FLOAT
) AS $$
  WITH v AS (
    SELECT h.*
    FROM hybrid_search_v2(
      query_embedding, query_text, match_count, doc_types,
      boost_capability_slugs, boost_industry_slugs, include_company_info, rrf_k, intent_boost
    ) WITH ORDINALITY AS h
  ),
  best AS (
    SELECT v.*,
      row_number() OVER (PARTITION BY v.document_id ORDER BY v.combined_score DESC, v.ordinality) AS doc_rn
    FROM v
  ),
  picked AS (
    SELECT b.*,
      row_number() OVER (PARTITION BY b.document_type ORDER BY b.combined_score DESC, b.ordinality) AS type_rn
    FROM best b
    WHERE b.doc_rn = 1
  )
  SELECT
    p.chunk_id, p.document_id, p.document_title, p.document_type, p.client_name, p.author, p.slug,
    p.vimeo_url, p.thumbnail_url, p.pdf_url, p.hero_video_url,
    p.content, p.chunk_type, p.metadata,
    p.semantic_score, p.keyword_score, p.semantic_rank, p.keyword_rank, p.intent_match, p.combined_score
  FROM picked p
  WHERE (p.document_type = 'case_study' AND p.type_rn <= max_case_studies)
     OR (p.document_type = 'article' AND p.type_rn <= max_articles)
  ORDER BY p.ordinality;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION hybrid_search_v2_top(vector, text, int, document_type[], text[], text[], boolean, int, float, int, int)
  TO anon, authenticated, service_role;
