-- Migration: Update hybrid_search function to include thumbnail_url
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding vector(1536),
    query_text TEXT,
    doc_types document_type[] DEFAULT NULL,
    capability_slugs TEXT[] DEFAULT NULL,
    industry_slugs TEXT[] DEFAULT NULL,
    topic_slugs TEXT[] DEFAULT NULL,
    match_count INTEGER DEFAULT 10,
    semantic_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    chunk_type TEXT,
    metadata JSONB,
    document_title TEXT,
    document_type document_type,
    slug TEXT,
    client_name TEXT,
    author TEXT,
    vimeo_url TEXT,
    thumbnail_url TEXT,
    similarity_score FLOAT,
    keyword_score FLOAT,
    combined_score FLOAT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_chunks AS (
        -- Filter by taxonomy and document type if provided
        SELECT DISTINCT cc.id
        FROM content_chunks cc
        JOIN documents d ON cc.document_id = d.id
        LEFT JOIN document_capabilities dc ON d.id = dc.document_id
        LEFT JOIN capabilities cap ON dc.capability_id = cap.id
        LEFT JOIN document_industries di ON d.id = di.document_id
        LEFT JOIN industries ind ON di.industry_id = ind.id
        LEFT JOIN document_topics dt ON d.id = dt.document_id
        LEFT JOIN topics t ON dt.topic_id = t.id
        WHERE 
            (doc_types IS NULL OR d.doc_type = ANY(doc_types))
            AND (capability_slugs IS NULL OR cap.slug = ANY(capability_slugs))
            AND (industry_slugs IS NULL OR ind.slug = ANY(industry_slugs))
            AND (topic_slugs IS NULL OR t.slug = ANY(topic_slugs))
    ),
    semantic_scores AS (
        SELECT 
            cc.id,
            1 - (cc.embedding <=> query_embedding) AS semantic_sim
        FROM content_chunks cc
        WHERE cc.id IN (SELECT id FROM filtered_chunks)
          AND cc.embedding IS NOT NULL
    ),
    keyword_scores AS (
        SELECT 
            cc.id,
            similarity(cc.content, query_text) AS keyword_sim
        FROM content_chunks cc
        WHERE cc.id IN (SELECT id FROM filtered_chunks)
    )
    SELECT 
        cc.id AS chunk_id,
        cc.document_id,
        cc.content,
        cc.chunk_type,
        cc.metadata,
        d.title AS document_title,
        d.doc_type AS document_type,
        d.slug,
        d.client_name,
        d.author,
        d.vimeo_url,
        d.thumbnail_url,
        COALESCE(ss.semantic_sim, 0)::FLOAT AS similarity_score,
        COALESCE(ks.keyword_sim, 0)::FLOAT AS keyword_score,
        (semantic_weight * COALESCE(ss.semantic_sim, 0) + 
         (1 - semantic_weight) * COALESCE(ks.keyword_sim, 0))::FLOAT AS combined_score
    FROM content_chunks cc
    JOIN documents d ON cc.document_id = d.id
    LEFT JOIN semantic_scores ss ON cc.id = ss.id
    LEFT JOIN keyword_scores ks ON cc.id = ks.id
    WHERE cc.id IN (SELECT id FROM filtered_chunks)
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;
