/**
 * Article Ingestion Script
 * 
 * Ingests Article Group articles (thought leadership, newsletters, etc.)
 * Uses simple PDF text extraction - no LlamaParse.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ============================================
// PDF TEXT EXTRACTION
// ============================================

/**
 * Extract all text from a PDF using Python/PyMuPDF
 */
async function extractPdfText(pdfPath: string): Promise<string> {
  const pythonScript = `
import fitz
import sys
import json

pdf_path = sys.argv[1]

doc = fitz.open(pdf_path)
full_text = ""
for page in doc:
    full_text += page.get_text() + "\\n\\n"
doc.close()

print(json.dumps({"text": full_text}))
`;

  const tempScript = '/tmp/extract_pdf.py';
  fs.writeFileSync(tempScript, pythonScript);

  try {
    const pythonCommands = ['python3.13', 'python3.12', 'python3.11', 'python3', 'python'];
    let result: string | null = null;

    for (const cmd of pythonCommands) {
      try {
        result = execSync(`${cmd} "${tempScript}" "${pdfPath}"`, {
          encoding: 'utf-8',
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });
        break;
      } catch {
        continue;
      }
    }

    if (!result) {
      throw new Error('No Python interpreter found');
    }

    const parsed = JSON.parse(result.trim());
    return parsed.text || '';
  } catch (error) {
    console.error(`Error extracting PDF:`, error);
    return '';
  }
}

// ============================================
// CONTENT CLEANING
// ============================================

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Remove page numbers
    .replace(/^\d+\s*$/gm, '')
    // Remove common junk
    .replace(/Proprietary\s*\+?\s*Confidential/gi, '')
    .replace(/©\s*\d{4}/g, '')
    // Clean whitespace
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

/**
 * Extract title and summary from filename and content
 */
function extractMetadata(filename: string, content: string): { title: string; summary: string; topics: string[] } {
  // Parse the descriptive filename
  let title = filename
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' - ')
    .trim();

  // Shorten overly long titles
  if (title.length > 150) {
    // Try to find a natural break point
    const breakPoints = [' - ', ' and ', ' with ', ' for '];
    for (const bp of breakPoints) {
      const idx = title.indexOf(bp);
      if (idx > 30 && idx < 120) {
        title = title.slice(0, idx);
        break;
      }
    }
    if (title.length > 150) {
      title = title.slice(0, 147) + '...';
    }
  }

  // Extract summary from first meaningful paragraph
  const paragraphs = content.split('\n\n').filter(p => p.length > 50);
  let summary = '';
  for (const para of paragraphs) {
    // Skip headers and short lines
    if (para.length > 100 && !para.match(/^[A-Z\s]{10,}$/)) {
      summary = para.slice(0, 300);
      break;
    }
  }

  // Determine topics based on content/filename
  const topics: string[] = [];
  const contentLower = (content + ' ' + filename).toLowerCase();

  if (contentLower.includes('newsletter') || contentLower.includes('human conditions')) {
    topics.push('newsletter');
  }
  if (contentLower.includes('case study') || contentLower.includes('crowdstrike') || contentLower.includes('aws')) {
    topics.push('case-study');
  }
  if (contentLower.includes('career') || contentLower.includes('jobs') || contentLower.includes('hiring')) {
    topics.push('careers');
  }
  if (contentLower.includes('framework') || contentLower.includes('guide') || contentLower.includes('strategy')) {
    topics.push('thought-leadership');
  }
  if (contentLower.includes('marketing') || contentLower.includes('brand')) {
    topics.push('marketing');
  }
  if (contentLower.includes('ai') || contentLower.includes('generative')) {
    topics.push('ai');
  }
  if (contentLower.includes('creative') || contentLower.includes('storytelling')) {
    topics.push('creative');
  }

  // Default topic if none found
  if (topics.length === 0) {
    topics.push('insights');
  }

  return { title, summary, topics };
}

// ============================================
// EMBEDDING & CHUNKING
// ============================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

/**
 * Split content into chunks
 */
function chunkContent(content: string, maxChunkSize: number = 1500): string[] {
  const paragraphs = content.split('\n\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

async function ensureTopicsExist(slugs: string[]): Promise<void> {
  const topicNames: Record<string, string> = {
    'newsletter': 'Newsletter',
    'case-study': 'Case Study',
    'careers': 'Careers',
    'thought-leadership': 'Thought Leadership',
    'marketing': 'Marketing',
    'ai': 'AI & Technology',
    'creative': 'Creative',
    'insights': 'Insights',
  };

  for (const slug of slugs) {
    const { data: existing } = await supabase
      .from('topics')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!existing) {
      await supabase.from('topics').insert({
        name: topicNames[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        slug,
      });
    }
  }
}

async function ingestArticle(pdfPath: string): Promise<boolean> {
  const filename = path.basename(pdfPath);
  console.log(`\n📄 Processing: ${filename.slice(0, 60)}...`);

  try {
    // Extract text
    const rawText = await extractPdfText(pdfPath);
    if (!rawText || rawText.length < 100) {
      console.log(`  ⚠️ No text extracted`);
      return false;
    }

    // Clean content
    const content = cleanText(rawText);
    console.log(`  📝 Extracted ${content.length} chars`);

    // Extract metadata
    const { title, summary, topics } = extractMetadata(filename, content);
    const slug = generateSlug(title);

    // Check if already exists
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      console.log(`  ⏭️ Already exists, skipping`);
      return true;
    }

    // Ensure topics exist
    await ensureTopicsExist(topics);

    // Create document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        slug,
        doc_type: 'article',
        summary: summary || null,
        source_file_path: filename,
      })
      .select()
      .single();

    if (docError) {
      console.error(`  ❌ Error creating document:`, docError);
      return false;
    }

    console.log(`  ✅ Created document: ${doc.id}`);

    // Link topics
    for (const topicSlug of topics) {
      const { data: topic } = await supabase
        .from('topics')
        .select('id')
        .eq('slug', topicSlug)
        .single();

      if (topic) {
        await supabase.from('document_topics').insert({
          document_id: doc.id,
          topic_id: topic.id,
          topic_slug: topicSlug,
        });
      }
    }

    // Create chunks with embeddings
    const chunks = chunkContent(content);
    console.log(`  🔄 Creating ${chunks.length} chunks...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length < 50) continue;

      const embedding = await generateEmbedding(chunk);

      const { error: chunkError } = await supabase.from('content_chunks').insert({
        document_id: doc.id,
        content: chunk,
        chunk_index: i,
        chunk_type: 'text',
        embedding,
      });

      if (chunkError) {
        console.error(`  ⚠️ Error creating chunk ${i}:`, chunkError);
      }
    }

    console.log(`  ✅ Created ${chunks.length} chunks`);
    return true;

  } catch (error) {
    console.error(`  ❌ Error:`, error);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const articlesDir = process.argv[2] || './content/Articles';

  if (!fs.existsSync(articlesDir)) {
    console.error(`Articles directory not found: ${articlesDir}`);
    process.exit(1);
  }

  // Get all PDF files
  const files = fs.readdirSync(articlesDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(articlesDir, f));

  console.log('🚀 Starting article ingestion...');
  console.log(`📁 Directory: ${articlesDir}`);
  console.log(`📊 PDFs found: ${files.length}`);

  let successful = 0;
  let failed = 0;

  for (const file of files) {
    const success = await ingestArticle(file);
    if (success) {
      successful++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 INGESTION COMPLETE');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));
}

main().catch(console.error);
