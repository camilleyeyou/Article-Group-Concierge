/**
 * Article Group AI Concierge - Ingestion Pipeline
 * 
 * Processes portfolio documents (PDFs, DOCXs) through LlamaParse,
 * chunks the content, generates embeddings, and stores everything
 * in Supabase.
 * 
 * Pipeline flow:
 * 1. Parse document with LlamaParse (multimodal mode)
 * 2. Extract text + image URLs
 * 3. Chunk text with overlap
 * 4. Generate embeddings for chunks
 * 5. Upload images to Supabase Storage
 * 6. Store everything in database
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { supabase, generateEmbedding } from './supabase';
import type {
  LlamaParseOutput,
  ChunkingConfig,
  Document,
  DocumentType,
  ContentChunk,
  VisualAsset,
  DocumentMetric,
} from '../types';

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CHUNK_CONFIG: ChunkingConfig = {
  chunkSize: 500, // ~500 tokens
  chunkOverlap: 50, // 10% overlap
  separators: ['\n\n', '\n', '. ', '! ', '? '],
};

const LLAMA_CLOUD_BASE_URL = 'https://api.cloud.llamaindex.ai/api/parsing';
const STORAGE_BUCKET = 'document-assets';

// Lazy getter for API key
function getLlamaCloudApiKey(): string {
  const key = process.env.LLAMA_CLOUD_API_KEY;
  if (!key) {
    throw new Error('LLAMA_CLOUD_API_KEY is required. Get one at https://cloud.llamaindex.ai');
  }
  return key;
}

// ============================================
// LLAMACLOUD API INTEGRATION
// ============================================

/**
 * Parse a document using LlamaCloud API (cloud-hosted LlamaParse).
 * Extracts both text and image references in multimodal mode.
 * 
 * Pricing: ~$0.003 per page
 * Docs: https://docs.cloud.llamaindex.ai/
 */
async function parseDocument(
  filePath: string,
  options?: { extractImages?: boolean }
): Promise<LlamaParseOutput> {
  const LLAMA_CLOUD_API_KEY = getLlamaCloudApiKey();

  // Read the file
  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  
  // Create form data for upload
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);
  
  // Optional: Set parsing options
  // multimodal mode extracts images with descriptions
  formData.append('parsing_instruction', 'Extract all text, tables, and images. For images, provide detailed descriptions.');
  formData.append('result_type', 'markdown');
  
  // Step 1: Upload and start parsing job
  console.log(`Uploading ${fileName} to LlamaCloud...`);
  const uploadResponse = await fetch(`${LLAMA_CLOUD_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
    },
    body: formData,
  });
  
  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`LlamaCloud upload error: ${error}`);
  }
  
  const { id: jobId } = await uploadResponse.json();
  console.log(`Parsing job started: ${jobId}`);
  
  // Step 2: Poll for completion
  let jobResult: any;
  let attempts = 0;
  const maxAttempts = 60; // 60 seconds timeout
  
  while (attempts < maxAttempts) {
    const statusResponse = await fetch(`${LLAMA_CLOUD_BASE_URL}/job/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
      },
    });
    
    jobResult = await statusResponse.json();
    
    if (jobResult.status === 'SUCCESS') {
      console.log('Parsing complete!');
      break;
    }
    
    if (jobResult.status === 'ERROR') {
      throw new Error(`LlamaCloud parsing error: ${jobResult.error}`);
    }
    
    // Still processing, wait and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('LlamaCloud parsing timeout');
  }
  
  // Step 3: Get the markdown result
  const markdownResponse = await fetch(`${LLAMA_CLOUD_BASE_URL}/job/${jobId}/result/markdown`, {
    headers: {
      'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
    },
  });
  
  const markdownText = await markdownResponse.text();
  
  // Step 4: Get extracted images if available
  let images: LlamaParseOutput['images'] = [];
  
  if (options?.extractImages !== false) {
    try {
      const imagesResponse = await fetch(`${LLAMA_CLOUD_BASE_URL}/job/${jobId}/result/images`, {
        headers: {
          'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
        },
      });
      
      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json();
        images = imagesData.map((img: any) => ({
          image_url: img.url || img.data, // URL or base64
          page_number: img.page_number || 1,
          description: img.description || img.caption || '',
        }));
      }
    } catch (e) {
      console.warn('Could not fetch images:', e);
    }
  }
  
  return {
    text: markdownText,
    images,
    metadata: {
      page_count: jobResult?.pages || 1,
      file_name: fileName,
      file_type: path.extname(filePath).slice(1).toLowerCase(),
    },
  };
}

// ============================================
// TEXT CHUNKING
// ============================================

/**
 * Estimates token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Splits text into chunks with overlap.
 * Uses a recursive approach with configurable separators.
 */
function chunkText(
  text: string,
  config: ChunkingConfig = DEFAULT_CHUNK_CONFIG
): string[] {
  const { chunkSize, chunkOverlap, separators = DEFAULT_CHUNK_CONFIG.separators! } = config;
  
  const chunks: string[] = [];
  
  // Recursive split function
  function splitRecursively(text: string, separatorIndex: number): string[] {
    if (estimateTokens(text) <= chunkSize) {
      return [text.trim()].filter(Boolean);
    }
    
    if (separatorIndex >= separators.length) {
      // Force split by character count as last resort
      const charLimit = chunkSize * 4;
      const result: string[] = [];
      for (let i = 0; i < text.length; i += charLimit - chunkOverlap * 4) {
        result.push(text.slice(i, i + charLimit).trim());
      }
      return result.filter(Boolean);
    }
    
    const separator = separators[separatorIndex];
    const parts = text.split(separator);
    
    const result: string[] = [];
    let currentChunk = '';
    
    for (const part of parts) {
      const potentialChunk = currentChunk 
        ? currentChunk + separator + part 
        : part;
      
      if (estimateTokens(potentialChunk) <= chunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          result.push(currentChunk.trim());
        }
        
        // If this part alone is too big, recursively split it
        if (estimateTokens(part) > chunkSize) {
          result.push(...splitRecursively(part, separatorIndex + 1));
          currentChunk = '';
        } else {
          currentChunk = part;
        }
      }
    }
    
    if (currentChunk.trim()) {
      result.push(currentChunk.trim());
    }
    
    return result;
  }
  
  const rawChunks = splitRecursively(text, 0);
  
  // Add overlap between chunks
  for (let i = 0; i < rawChunks.length; i++) {
    let chunk = rawChunks[i];
    
    // Add overlap from previous chunk
    if (i > 0 && chunkOverlap > 0) {
      const prevChunk = rawChunks[i - 1];
      const overlapChars = chunkOverlap * 4;
      const overlap = prevChunk.slice(-overlapChars);
      chunk = overlap + ' ' + chunk;
    }
    
    chunks.push(chunk.trim());
  }
  
  return chunks;
}

/**
 * Detects the type of content in a chunk for better categorization.
 */
function detectChunkType(content: string): ContentChunk['chunk_type'] {
  const lowerContent = content.toLowerCase();
  
  // Check for metrics/stats patterns
  if (/\d+%|\$[\d,]+|[\d.]+x|\d+ (percent|million|billion)/.test(content)) {
    return 'metric';
  }
  
  // Check for quote patterns
  if (/^[""]|said|according to|noted|explained/.test(lowerContent)) {
    return 'quote';
  }
  
  // Check for strategic content
  if (/strategy|approach|framework|methodology|process|solution/.test(lowerContent)) {
    return 'strategy';
  }
  
  return 'text';
}

// ============================================
// IMAGE PROCESSING
// ============================================

/**
 * Downloads an image and uploads it to Supabase Storage.
 * Returns the storage path for signed URL generation.
 */
async function processImage(
  imageUrl: string,
  caseStudyId: string,
  pageNumber: number,
  index: number
): Promise<{ storagePath: string; metadata: Partial<VisualAsset> }> {
  // Download the image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${imageUrl}`);
  }
  
  const contentType = response.headers.get('content-type') || 'image/png';
  const extension = contentType.split('/')[1] || 'png';
  const buffer = await response.arrayBuffer();
  
  // Generate storage path
  const storagePath = `${caseStudyId}/page-${pageNumber}-img-${index}.${extension}`;
  
  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });
  
  if (error) {
    throw new Error(`Storage upload error: ${error.message}`);
  }
  
  return {
    storagePath,
    metadata: {
      mime_type: contentType,
      original_filename: `page-${pageNumber}-img-${index}.${extension}`,
    },
  };
}

// ============================================
// METRIC EXTRACTION
// ============================================

/**
 * Attempts to extract structured metrics from text content.
 * Uses regex patterns to find common metric formats.
 */
function extractMetrics(text: string): Partial<DocumentMetric>[] {
  const metrics: Partial<DocumentMetric>[] = [];
  
  // Pattern: "340% increase in X" or "X increased by 340%"
  const percentPattern = /(\d+(?:\.\d+)?%)\s+(?:increase|growth|improvement|boost|rise|gain)\s+in\s+([^,.]+)|([^,.]+)\s+(?:increased|grew|improved|rose)\s+by\s+(\d+(?:\.\d+)?%)/gi;
  
  let match;
  while ((match = percentPattern.exec(text)) !== null) {
    metrics.push({
      value: match[1] || match[4],
      label: (match[2] || match[3])?.trim(),
    });
  }
  
  // Pattern: "$X million/billion"
  const moneyPattern = /\$[\d,.]+\s*(?:million|billion|M|B|k)/gi;
  while ((match = moneyPattern.exec(text)) !== null) {
    // Look for context around the match
    const contextStart = Math.max(0, match.index - 50);
    const contextEnd = Math.min(text.length, match.index + match[0].length + 50);
    const context = text.slice(contextStart, contextEnd);
    
    metrics.push({
      value: match[0],
      label: 'Revenue/Investment',
      context: context.trim(),
    });
  }
  
  // Pattern: "X out of Y" or "X/Y rating"
  const ratingPattern = /([\d.]+)\s*(?:out of|\/)\s*([\d.]+)\s*(?:rating|score|stars)?/gi;
  while ((match = ratingPattern.exec(text)) !== null) {
    metrics.push({
      value: `${match[1]}/${match[2]}`,
      label: 'Rating/Score',
    });
  }
  
  return metrics;
}

// ============================================
// MAIN INGESTION FUNCTION
// ============================================

interface IngestionOptions {
  documentId?: string; // If updating existing
  title: string;
  slug: string;
  docType?: DocumentType; // 'case_study' or 'article'
  summary?: string;
  
  // Case study specific
  clientName?: string;
  vimeoUrl?: string;
  
  // Article specific
  author?: string;
  publishedDate?: string;
  externalUrl?: string;
  
  // Taxonomy
  capabilitySlugs?: string[];
  industrySlugs?: string[];
  topicSlugs?: string[];
  
  chunkConfig?: ChunkingConfig;
}

/**
 * Main ingestion function. Processes a document and stores all data.
 */
export async function ingestDocument(
  filePath: string,
  options: IngestionOptions
): Promise<{ documentId: string; chunksCreated: number; assetsCreated: number }> {
  const docType = options.docType || 'case_study';
  console.log(`Starting ingestion for: ${options.title} (${docType})`);
  
  // Step 1: Parse document with LlamaParse
  console.log('Parsing document...');
  const parseResult = await parseDocument(filePath, { extractImages: true });
  
  // Step 2: Create or update document record
  let documentId = options.documentId;
  
  if (!documentId) {
    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        title: options.title,
        slug: options.slug,
        doc_type: docType,
        summary: options.summary || parseResult.text.slice(0, 500),
        source_file_path: filePath,
        // Case study fields
        client_name: options.clientName,
        vimeo_url: options.vimeoUrl,
        // Article fields
        author: options.author,
        published_date: options.publishedDate,
        external_url: options.externalUrl,
      })
      .select()
      .single();
    
    if (error) throw error;
    documentId = document.id;
    console.log(`Created document: ${documentId}`);
  }
  
  // Step 3: Link capabilities
  if (options.capabilitySlugs?.length) {
    const { data: capabilities } = await supabase
      .from('capabilities')
      .select('id')
      .in('slug', options.capabilitySlugs);
    
    if (capabilities?.length) {
      await supabase.from('document_capabilities').upsert(
        capabilities.map(c => ({ document_id: documentId, capability_id: c.id }))
      );
    }
  }
  
  // Step 4: Link industries
  if (options.industrySlugs?.length) {
    const { data: industries } = await supabase
      .from('industries')
      .select('id')
      .in('slug', options.industrySlugs);
    
    if (industries?.length) {
      await supabase.from('document_industries').upsert(
        industries.map(i => ({ document_id: documentId, industry_id: i.id }))
      );
    }
  }
  
  // Step 5: Link topics (primarily for articles)
  if (options.topicSlugs?.length) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id')
      .in('slug', options.topicSlugs);
    
    if (topics?.length) {
      await supabase.from('document_topics').upsert(
        topics.map(t => ({ document_id: documentId, topic_id: t.id }))
      );
    }
  }
  
  // Step 6: Chunk the text
  console.log('Chunking text...');
  const chunks = chunkText(parseResult.text, options.chunkConfig);
  console.log(`Created ${chunks.length} chunks`);
  
  // Step 7: Generate embeddings and store chunks
  console.log('Generating embeddings...');
  let chunksCreated = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const chunkType = detectChunkType(content);
    
    // Generate embedding
    const embedding = await generateEmbedding(content);
    
    // Store chunk
    const { error } = await supabase.from('content_chunks').insert({
      document_id: documentId,
      content,
      chunk_index: i,
      chunk_type: chunkType,
      embedding,
      metadata: {
        token_estimate: estimateTokens(content),
        source_page: Math.floor(i / 3) + 1, // Rough page estimate
      },
    });
    
    if (error) {
      console.error(`Error storing chunk ${i}:`, error);
    } else {
      chunksCreated++;
    }
    
    // Rate limiting for embedding API
    if (i % 10 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Step 8: Process and store images
  console.log('Processing images...');
  let assetsCreated = 0;
  
  for (let i = 0; i < parseResult.images.length; i++) {
    const image = parseResult.images[i];
    
    try {
      const { storagePath, metadata } = await processImage(
        image.image_url,
        documentId!,
        image.page_number,
        i
      );
      
      // Generate description embedding if description exists
      let descriptionEmbedding: number[] | undefined;
      if (image.description) {
        descriptionEmbedding = await generateEmbedding(image.description);
      }
      
      // Store visual asset record
      const { error } = await supabase.from('visual_assets').insert({
        document_id: documentId,
        storage_path: storagePath,
        bucket_name: STORAGE_BUCKET,
        asset_type: 'diagram', // Default, could be smarter with classification
        description: image.description,
        description_embedding: descriptionEmbedding,
        ...metadata,
      });
      
      if (error) {
        console.error(`Error storing asset ${i}:`, error);
      } else {
        assetsCreated++;
      }
    } catch (e) {
      console.error(`Error processing image ${i}:`, e);
    }
  }
  
  // Step 9: Extract and store metrics (primarily for case studies)
  if (docType === 'case_study') {
    console.log('Extracting metrics...');
    const allMetrics = extractMetrics(parseResult.text);
    
    for (let i = 0; i < allMetrics.length; i++) {
      const metric = allMetrics[i];
      if (metric.label && metric.value) {
        await supabase.from('document_metrics').insert({
          document_id: documentId,
          label: metric.label,
          value: metric.value,
          context: metric.context,
          display_order: i,
        });
      }
    }
  }
  
  console.log(`Ingestion complete! Chunks: ${chunksCreated}, Assets: ${assetsCreated}`);
  
  return {
    documentId: documentId!,
    chunksCreated,
    assetsCreated,
  };
}

// ============================================
// BATCH INGESTION
// ============================================

interface BatchIngestionItem {
  filePath: string;
  options: IngestionOptions;
}

/**
 * Process multiple documents in sequence with progress tracking.
 */
export async function batchIngest(
  items: BatchIngestionItem[],
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<{ successful: number; failed: number; results: any[] }> {
  const results: any[] = [];
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i, items.length, item.options.title);
    
    try {
      const result = await ingestDocument(item.filePath, item.options);
      results.push({ ...result, status: 'success' });
      successful++;
    } catch (error) {
      console.error(`Failed to ingest ${item.options.title}:`, error);
      results.push({ 
        title: item.options.title, 
        status: 'failed', 
        error: (error as Error).message 
      });
      failed++;
    }
    
    // Small delay between documents
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return { successful, failed, results };
}

export default ingestDocument;
