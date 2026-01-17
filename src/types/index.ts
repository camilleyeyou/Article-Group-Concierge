// Article Group AI Concierge - Type Definitions

// ============================================
// DATABASE TYPES
// ============================================

export type DocumentType = 'case_study' | 'article';

export interface Capability {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface Industry {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

// Unified document type for case studies and articles
export interface Document {
  id: string;
  title: string;
  slug: string;
  doc_type: DocumentType;
  summary: string | null;
  source_file_path: string | null;
  
  // Case study specific
  client_name: string | null;
  vimeo_url: string | null;
  thumbnail_url: string | null;      // Card thumbnail image
  hero_image_url: string | null;     // Detail page hero image
  
  // Article specific
  author: string | null;
  published_date: string | null;
  external_url: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined relations
  capabilities?: Capability[];
  industries?: Industry[];
  topics?: Topic[];
  metrics?: DocumentMetric[];
}

// Alias for backward compatibility
export type CaseStudy = Document;

export interface ContentChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  chunk_type: 'text' | 'metric' | 'quote' | 'strategy';
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined relations
  document?: Document;
  visual_assets?: VisualAsset[];
}

export interface VisualAsset {
  id: string;
  document_id: string;
  chunk_id: string | null;
  storage_path: string;
  bucket_name: string;
  asset_type: 'chart' | 'diagram' | 'photo' | 'logo' | 'infographic';
  alt_text: string | null;
  caption: string | null;
  original_filename: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  description: string | null;
  description_embedding: number[] | null;
  created_at: string;
  // Runtime property (generated via signed URL)
  signed_url?: string;
}

export interface DocumentMetric {
  id: string;
  document_id: string;
  label: string;
  value: string;
  context: string | null;
  display_order: number;
  created_at: string;
}

// Alias for backward compatibility
export type CaseStudyMetric = DocumentMetric;

// ============================================
// SEARCH RESULT TYPES
// ============================================

export interface HybridSearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  chunk_type: string;
  metadata: Record<string, unknown>;
  document_title: string;
  document_type: DocumentType;
  slug: string;
  client_name: string | null;
  author: string | null;
  vimeo_url: string | null;
  thumbnail_url: string | null;
  similarity_score: number;
  keyword_score: number;
  combined_score: number;
}

export interface VisualAssetSearchResult {
  asset_id: string;
  document_id: string;
  storage_path: string;
  bucket_name: string;
  asset_type: string;
  alt_text: string | null;
  caption: string | null;
  description: string | null;
  similarity_score: number;
  signed_url?: string;
}

// ============================================
// COMPONENT PROPS TYPES
// ============================================

export interface HeroBlockProps {
  title: string;
  subtitle?: string;
  challengeSummary?: string;
  backgroundVariant?: 'dark' | 'light' | 'gradient';
}

export interface StrategyCardProps {
  title: string;
  content: string;
  icon?: 'lightbulb' | 'target' | 'chart' | 'users' | 'rocket';
  accentColor?: string;
}

export interface VideoPlayerProps {
  url: string; // Vimeo URL
  caption?: string;
  aspectRatio?: '16:9' | '4:3' | '1:1';
  autoplay?: boolean;
}

export interface MetricGridProps {
  stats: Array<{
    label: string;
    value: string;
    context?: string;
  }>;
  columns?: 2 | 3 | 4;
  variant?: 'default' | 'highlight' | 'minimal';
}

export interface VisualAssetProps {
  src: string; // Signed URL
  alt: string;
  caption?: string;
  aspectRatio?: 'auto' | '16:9' | '4:3' | '1:1' | '3:2';
  loading?: 'lazy' | 'eager';
  enableLightbox?: boolean;
}

export interface CaseStudyTeaserProps {
  title: string;
  clientName?: string;
  summary: string;
  capabilities?: string[];
  industries?: string[];
  thumbnailUrl?: string;
  slug: string;
}

// ============================================
// LAYOUT ORCHESTRATOR TYPES
// ============================================

export type ComponentType = 
  | 'HeroBlock'
  | 'StrategyCard'
  | 'VideoPlayer'
  | 'MetricGrid'
  | 'VisualAsset'
  | 'CaseStudyTeaser';

export interface LayoutComponent {
  component: ComponentType;
  props: 
    | HeroBlockProps 
    | StrategyCardProps 
    | VideoPlayerProps 
    | MetricGridProps 
    | VisualAssetProps 
    | CaseStudyTeaserProps;
}

export interface LayoutPlan {
  layout: LayoutComponent[];
}

// ============================================
// ORCHESTRATOR CONTEXT TYPES
// ============================================

export interface RetrievedContext {
  chunks: HybridSearchResult[];
  visualAssets: VisualAssetSearchResult[];
  relatedMetrics: DocumentMetric[];
  capabilities: Capability[];
  industries: Industry[];
  topics: Topic[];
}

export interface OrchestratorInput {
  userQuery: string;
  context: RetrievedContext;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface OrchestratorOutput {
  layoutPlan: LayoutPlan;
  explanation: string;
  suggestedFollowUps?: string[];
  contactCTA?: boolean; // True if no relevant content found
}

// ============================================
// INGESTION TYPES
// ============================================

export interface LlamaParseOutput {
  text: string;
  images: Array<{
    image_url: string;
    page_number: number;
    description?: string;
  }>;
  metadata: {
    page_count: number;
    file_name: string;
    file_type: string;
  };
}

export interface ChunkingConfig {
  chunkSize: number; // Target tokens per chunk
  chunkOverlap: number; // Overlap tokens
  separators?: string[]; // Custom split points
}

export interface IngestionJob {
  id: string;
  case_study_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source_path: string;
  chunks_created: number;
  assets_created: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}
