-- Article Group AI Concierge - Supabase Schema
-- Enables pgvector for semantic search + separate taxonomy tables for flexibility
-- Supports multiple document types: case studies, articles, etc.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For hybrid text search

-- ============================================
-- DOCUMENT TYPE ENUM
-- ============================================

CREATE TYPE document_type AS ENUM ('case_study', 'article');

-- ============================================
-- TAXONOMY TABLES
-- ============================================

-- Capabilities (e.g., "Brand Strategy", "Content Marketing", "Creative Direction")
CREATE TABLE capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES capabilities(id), -- For hierarchical taxonomies
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Industries (e.g., "Tech", "Healthcare", "Finance", "Retail")
CREATE TABLE industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topics (for articles: "AI Trends", "Brand Building", "Marketing Strategy")
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UNIFIED DOCUMENTS TABLE
-- ============================================

-- All content types: case studies, articles, etc.
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core fields (all document types)
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    doc_type document_type NOT NULL DEFAULT 'case_study',
    summary TEXT,
    source_file_path TEXT, -- Original PDF/doc path
    
    -- Case study specific fields
    client_name TEXT, -- Only for case studies
    vimeo_url TEXT,   -- Primary video for VideoPlayer
    
    -- Article specific fields
    author TEXT,           -- Article author
    published_date DATE,   -- When the article was published
    external_url TEXT,     -- Link to original if published elsewhere
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: Documents <-> Capabilities
CREATE TABLE document_capabilities (
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    capability_id UUID REFERENCES capabilities(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, capability_id)
);

-- Many-to-many: Documents <-> Industries
CREATE TABLE document_industries (
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, industry_id)
);

-- Many-to-many: Documents <-> Topics (primarily for articles)
CREATE TABLE document_topics (
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, topic_id)
);

-- ============================================
-- RAG CHUNKS TABLE
-- ============================================

-- Content chunks with embeddings for semantic search
CREATE TABLE content_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL, -- Order within the document
    chunk_type TEXT DEFAULT 'text', -- 'text', 'metric', 'quote', 'strategy'
    
    -- Embedding for semantic search (1536 dimensions for text-embedding-3-small)
    embedding vector(1536),
    
    -- Metadata for filtering and display
    metadata JSONB DEFAULT '{}', -- Flexible storage for extracted entities, metrics, etc.
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(document_id, chunk_index)
);

-- ============================================
-- VISUAL ASSETS TABLE
-- ============================================

-- Stores references to images/charts extracted via LlamaParse
CREATE TABLE visual_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES content_chunks(id) ON DELETE SET NULL, -- Optional link to specific chunk
    
    -- Storage info (Supabase Storage with signed URLs)
    storage_path TEXT NOT NULL, -- Path in Supabase Storage bucket
    bucket_name TEXT DEFAULT 'document-assets',
    
    -- Metadata
    asset_type TEXT NOT NULL, -- 'chart', 'diagram', 'photo', 'logo', 'infographic'
    alt_text TEXT,
    caption TEXT,
    original_filename TEXT,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    
    -- For semantic retrieval of images
    description TEXT, -- LlamaParse-extracted description
    description_embedding vector(1536),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- METRICS TABLE (for case studies with MetricGrid)
-- ============================================

-- Extracted KPIs and stats from documents
CREATE TABLE document_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    label TEXT NOT NULL, -- e.g., "ROI", "Engagement Increase", "Revenue Growth"
    value TEXT NOT NULL, -- e.g., "340%", "$2.5M", "3x"
    context TEXT, -- Additional context for the metric
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Vector similarity search index (IVFFlat for faster approximate search)
CREATE INDEX idx_chunks_embedding ON content_chunks 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Vector index for visual asset descriptions
CREATE INDEX idx_assets_embedding ON visual_assets 
USING ivfflat (description_embedding vector_cosine_ops) 
WITH (lists = 50);

-- Full-text search index for hybrid search
CREATE INDEX idx_chunks_content_trgm ON content_chunks 
USING gin (content gin_trgm_ops);

-- Foreign key indexes
CREATE INDEX idx_chunks_document ON content_chunks(document_id);
CREATE INDEX idx_assets_document ON visual_assets(document_id);
CREATE INDEX idx_metrics_document ON document_metrics(document_id);

-- Document type index for filtering
CREATE INDEX idx_documents_type ON documents(doc_type);

-- Taxonomy join table indexes
CREATE INDEX idx_doc_capabilities_capability ON document_capabilities(capability_id);
CREATE INDEX idx_doc_industries_industry ON document_industries(industry_id);
CREATE INDEX idx_doc_topics_topic ON document_topics(topic_id);

-- ============================================
-- HYBRID SEARCH FUNCTION
-- ============================================

-- Combines semantic (vector) + keyword (trgm) search with taxonomy filtering
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

-- ============================================
-- VISUAL ASSET SEARCH FUNCTION
-- ============================================

-- Search for relevant images/charts based on description embedding
CREATE OR REPLACE FUNCTION search_visual_assets(
    query_embedding vector(1536),
    document_ids UUID[] DEFAULT NULL,
    asset_types TEXT[] DEFAULT NULL,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    asset_id UUID,
    document_id UUID,
    storage_path TEXT,
    bucket_name TEXT,
    asset_type TEXT,
    alt_text TEXT,
    caption TEXT,
    description TEXT,
    similarity_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        va.id AS asset_id,
        va.document_id,
        va.storage_path,
        va.bucket_name,
        va.asset_type,
        va.alt_text,
        va.caption,
        va.description,
        (1 - (va.description_embedding <=> query_embedding))::FLOAT AS similarity_score
    FROM visual_assets va
    WHERE 
        va.description_embedding IS NOT NULL
        AND (document_ids IS NULL OR va.document_id = ANY(document_ids))
        AND (asset_types IS NULL OR va.asset_type = ANY(asset_types))
    ORDER BY va.description_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_metrics ENABLE ROW LEVEL SECURITY;

-- Public read access (adjust based on your auth requirements)
CREATE POLICY "Public read access" ON capabilities FOR SELECT USING (true);
CREATE POLICY "Public read access" ON industries FOR SELECT USING (true);
CREATE POLICY "Public read access" ON topics FOR SELECT USING (true);
CREATE POLICY "Public read access" ON documents FOR SELECT USING (true);
CREATE POLICY "Public read access" ON content_chunks FOR SELECT USING (true);
CREATE POLICY "Public read access" ON visual_assets FOR SELECT USING (true);
CREATE POLICY "Public read access" ON document_metrics FOR SELECT USING (true);

-- ============================================
-- SEED DATA: Capabilities, Industries & Topics
-- ============================================

INSERT INTO capabilities (name, slug, description) VALUES
    ('Brand Strategy', 'brand-strategy', 'Defining brand positioning, identity, and market differentiation'),
    ('Content Marketing', 'content-marketing', 'Creating and distributing valuable content to attract audiences'),
    ('Creative Direction', 'creative-direction', 'Visual storytelling and design leadership'),
    ('Digital Transformation', 'digital-transformation', 'Modernizing business operations through technology'),
    ('Experience Design', 'experience-design', 'Crafting user journeys and touchpoints'),
    ('Growth Marketing', 'growth-marketing', 'Data-driven strategies for scaling acquisition'),
    ('Social Strategy', 'social-strategy', 'Building engaged communities across platforms'),
    ('Video Production', 'video-production', 'Storytelling through motion and film');

INSERT INTO industries (name, slug, description) VALUES
    ('Technology', 'technology', 'Software, hardware, and digital services'),
    ('Healthcare', 'healthcare', 'Medical, pharmaceutical, and wellness'),
    ('Finance', 'finance', 'Banking, insurance, and financial services'),
    ('Retail', 'retail', 'Consumer goods and e-commerce'),
    ('Media & Entertainment', 'media-entertainment', 'Publishing, streaming, and content'),
    ('B2B Services', 'b2b-services', 'Professional and enterprise services'),
    ('Consumer Goods', 'consumer-goods', 'CPG and lifestyle brands'),
    ('Non-Profit', 'non-profit', 'Foundations and social impact organizations');

INSERT INTO topics (name, slug, description) VALUES
    ('AI & Innovation', 'ai-innovation', 'Artificial intelligence, machine learning, and emerging tech'),
    ('Brand Building', 'brand-building', 'Creating and growing memorable brands'),
    ('Marketing Trends', 'marketing-trends', 'Latest developments in marketing and advertising'),
    ('Leadership', 'leadership', 'Management, culture, and organizational growth'),
    ('Creative Process', 'creative-process', 'Behind-the-scenes of creative work'),
    ('Industry Insights', 'industry-insights', 'Analysis and commentary on market trends'),
    ('Case Study Breakdowns', 'case-study-breakdowns', 'Deep dives into successful campaigns'),
    ('Agency Life', 'agency-life', 'Culture, hiring, and running an agency');
