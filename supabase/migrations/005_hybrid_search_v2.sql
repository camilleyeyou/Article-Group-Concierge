-- Migration 005: hybrid_search_v2 (Phase 3 RETR-01)
-- Run in the Supabase SQL Editor. Additive only: creates a NEW function next to
-- hybrid_search and hybrid_search_exact, which stay unchanged (production rule:
-- add alongside, never replace in place).
--
-- What it does:
--   * Scores EVERY eligible chunk (no ORDER BY embedding <=> q LIMIT, the plan shape
--     that let the ivfflat index return a lossy result set in hybrid_search).
--   * Keyword search uses OR semantics over the whole corpus, with title/client (A),
--     taxonomy names (B) and body text (D) weighted.
--   * Semantic and keyword ranks are computed per doc_type and fused with RRF.
--   * Excludes chunks with metadata.article_class = 'excluded' (D-16); returns
--     'company_info' chunks only when include_company_info is true (D-15).
--
-- Rollback: DROP FUNCTION hybrid_search_v2(vector, text, int, document_type[], text[], text[], boolean, int, float);
-- (the app falls back to hybrid_search_exact if this function is missing)

CREATE OR REPLACE FUNCTION hybrid_search_v2(
  query_embedding vector(1536),
  query_text TEXT,
  match_count INT DEFAULT 60,
  doc_types document_type[] DEFAULT NULL,
  boost_capability_slugs TEXT[] DEFAULT NULL,
  boost_industry_slugs TEXT[] DEFAULT NULL,
  include_company_info BOOLEAN DEFAULT FALSE,
  rrf_k INT DEFAULT 60,
  intent_boost FLOAT DEFAULT 0.0
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
#variable_conflict use_column
DECLARE
  -- OR every term: plainto_tsquery joins with & and uses phrase operators (<->, <2>, ...)
  -- for hyphenated or compound words; map all of them to |.
  or_query tsquery := NULLIF(
    regexp_replace(replace(plainto_tsquery('english', query_text)::text, ' & ', ' | '), ' <[0-9-]+> ', ' | ', 'g'),
    ''
  )::tsquery;
BEGIN
  -- Guard: if a plan ever uses the ivfflat index, probe every list.
  PERFORM set_config('ivfflat.probes', '100', true);
  RETURN QUERY
  WITH base AS (
    SELECT
      cc.id AS c_id,
      cc.document_id AS d_id,
      d.title AS d_title,
      d.doc_type AS d_type,
      d.client_name AS d_client,
      d.author AS d_author,
      d.slug AS d_slug,
      d.vimeo_url AS d_vimeo,
      d.thumbnail_url AS d_thumb,
      d.pdf_url AS d_pdf,
      d.hero_video_url AS d_hero,
      cc.content AS c_content,
      cc.chunk_type AS c_type,
      cc.metadata AS c_meta,
      (1 - (cc.embedding <=> query_embedding))::FLOAT AS sem,
      (setweight(to_tsvector('english', d.title), 'A')
        || setweight(to_tsvector('english', COALESCE(d.client_name, '')), 'A')
        || setweight(to_tsvector('english', COALESCE(tags.names, '')), 'B')
        || setweight(to_tsvector('english', cc.content), 'D')) AS vec,
      (COALESCE(tags.cap_slugs && boost_capability_slugs, FALSE)
        OR COALESCE(tags.ind_slugs && boost_industry_slugs, FALSE)) AS intent_hit
    FROM content_chunks cc
    JOIN documents d ON d.id = cc.document_id
    LEFT JOIN LATERAL (
      SELECT
        string_agg(x.name, ' ') AS names,
        array_agg(x.slug) FILTER (WHERE x.kind = 'cap') AS cap_slugs,
        array_agg(x.slug) FILTER (WHERE x.kind = 'ind') AS ind_slugs
      FROM (
        SELECT c.name, c.slug, 'cap' AS kind
        FROM document_capabilities dc
        JOIN capabilities c ON c.id = dc.capability_id
        WHERE dc.document_id = d.id
        UNION ALL
        SELECT i.name, i.slug, 'ind' AS kind
        FROM document_industries di
        JOIN industries i ON i.id = di.industry_id
        WHERE di.document_id = d.id
      ) x
    ) tags ON TRUE
    WHERE cc.embedding IS NOT NULL
      AND (doc_types IS NULL OR d.doc_type = ANY(doc_types))
      AND COALESCE(cc.metadata->>'article_class', '') <> 'excluded'
      AND (include_company_info OR COALESCE(cc.metadata->>'article_class', '') <> 'company_info')
  ),
  scored AS (
    SELECT
      b.*,
      (CASE WHEN or_query IS NOT NULL AND b.vec @@ or_query THEN ts_rank(b.vec, or_query) ELSE 0 END)::FLOAT AS kw
    FROM base b
  ),
  ranked AS (
    SELECT
      s.*,
      rank() OVER (PARTITION BY s.d_type ORDER BY s.sem DESC)::INT AS srank,
      (CASE WHEN s.kw > 0 THEN rank() OVER (PARTITION BY s.d_type, (s.kw > 0) ORDER BY s.kw DESC) END)::INT AS krank
    FROM scored s
  ),
  fused AS (
    SELECT
      r.*,
      (1.0 / (rrf_k + r.srank)
        + COALESCE(1.0 / (rrf_k + r.krank), 0)
        + CASE WHEN r.intent_hit THEN intent_boost ELSE 0 END)::FLOAT AS rrf
    FROM ranked r
  )
  SELECT
    f.c_id, f.d_id, f.d_title, f.d_type, f.d_client, f.d_author, f.d_slug,
    f.d_vimeo, f.d_thumb, f.d_pdf, f.d_hero,
    f.c_content, f.c_type, f.c_meta,
    f.sem, f.kw, f.srank, f.krank, f.intent_hit, f.rrf
  FROM fused f
  ORDER BY f.rrf DESC, f.c_id
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION hybrid_search_v2(vector, text, int, document_type[], text[], text[], boolean, int, float)
  TO anon, authenticated, service_role;
