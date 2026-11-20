/**
 * Article Ingestion Script
 * 
 * Ingests Article Group articles (thought leadership, newsletters, etc.)
 * Uses PyMuPDF for PDF text extraction and OpenAI for embeddings.
 * 
 * Usage:
 *   npm run ingest:articles "./content/Articles"
 * 
 * Prerequisites:
 *   - pymupdf installed: pip3 install pymupdf
 *   - OpenAI API key in .env.local
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { embeddingConfig } from '../src/lib/llm-config';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// Embeddings go to OpenAI directly, or via OpenRouter when OPENROUTER_API_KEY is set
const embedding = embeddingConfig();
const openaiKey = embedding.apiKey!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables. Check .env.local');
  process.exit(1);
}

if (!openaiKey) {
  console.error('❌ Missing OPENAI_API_KEY (or OPENROUTER_API_KEY). Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// OPENAI EMBEDDING
// ============================================

async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${embedding.baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embedding.model,
          input: text.slice(0, 8000), // Limit input size
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.log(`   ⚠️ Retry ${attempt}/${retries}...`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Failed after retries');
}

// ============================================
// PDF TEXT EXTRACTION
// ============================================

function extractPdfText(pdfPath: string): string {
  const pythonScript = `
import sys
import json

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed. Run: pip3 install pymupdf"}))
    sys.exit(1)

pdf_path = sys.argv[1]

try:
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\\n\\n"
    doc.close()
    print(json.dumps({"text": full_text}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

  const tempScript = path.join(process.cwd(), '.temp-extract.py');
  fs.writeFileSync(tempScript, pythonScript);

  try {
    const result = execSync(`python3 "${tempScript}" "${pdfPath}"`, {
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    
    fs.unlinkSync(tempScript);
    
    const parsed = JSON.parse(result.trim());
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return parsed.text || '';
  } catch (error: any) {
    if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    throw error;
  }
}

// ============================================
// CONTENT PROCESSING
// ============================================

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\d+\s*$/gm, '') // Remove page numbers
    .replace(/Proprietary\s*\+?\s*Confidential/gi, '')
    .replace(/©\s*\d{4}/g, '')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

function extractMetadata(filename: string, content: string): { title: string; summary: string; topics: string[] } {
  // Parse the descriptive filename
  let title = filename
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' - ')
    .trim();

  // Shorten overly long titles
  if (title.length > 150) {
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
    if (para.length > 100 && !para.match(/^[A-Z\s]{10,}$/)) {
      summary = para.slice(0, 500);
      break;
    }
  }

  // Determine topics based on content/filename
  const topics: string[] = [];
  const contentLower = (content + ' ' + filename).toLowerCase();

  if (contentLower.includes('newsletter') || contentLower.includes('human conditions')) {
    topics.push('newsletter');
  }
  if (contentLower.includes('career') || contentLower.includes('jobs') || contentLower.includes('hiring')) {
    topics.push('careers');
  }
  if (contentLower.includes('framework') || contentLower.includes('guide') || contentLower.includes('strategy') || contentLower.includes('glossary')) {
    topics.push('thought-leadership');
  }
  if (contentLower.includes('marketing') || contentLower.includes('brand')) {
    topics.push('marketing');
  }
  if (contentLower.includes('ai') || contentLower.includes('generative') || contentLower.includes('technology')) {
    topics.push('ai');
  }
  if (contentLower.includes('creative') || contentLower.includes('storytelling')) {
    topics.push('creative');
  }
  if (contentLower.includes('linkedin') || contentLower.includes('posts')) {
    topics.push('social');
  }

  // Default topic if none found
  if (topics.length === 0) {
    topics.push('insights');
  }

  return { title, summary, topics };
}

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

  return chunks.filter(c => c.length > 50);
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

// ============================================
// DATABASE OPERATIONS
// ============================================

async function ensureTopicsExist(slugs: string[]): Promise<Map<string, string>> {
  const topicNames: Record<string, string> = {
    'newsletter': 'Newsletter',
    'careers': 'Careers',
    'thought-leadership': 'Thought Leadership',
    'marketing': 'Marketing',
    'ai': 'AI & Technology',
    'creative': 'Creative',
    'social': 'Social Media',
    'insights': 'Insights',
  };

  const topicMap = new Map<string, string>();

  for (const slug of slugs) {
    // Check if exists
    let { data: existing } = await supabase
      .from('topics')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (!existing) {
      // Create it
      const { data: created, error } = await supabase
        .from('topics')
        .insert({
          name: topicNames[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          slug,
        })
        .select('id')
        .single();

      if (error) {
        console.log(`   ⚠️ Error creating topic ${slug}: ${error.message}`);
        continue;
      }
      existing = created;
    }

    if (existing) {
      topicMap.set(slug, existing.id);
    }
  }

  return topicMap;
}

async function ingestArticle(pdfPath: string): Promise<boolean> {
  const filename = path.basename(pdfPath);
  const shortName = filename.length > 55 ? filename.slice(0, 52) + '...' : filename;
  
  process.stdout.write(`📄 ${shortName} `);

  try {
    // Extract text
    const rawText = extractPdfText(pdfPath);
    if (!rawText || rawText.length < 100) {
      console.log('⚠️ No text extracted');
      return false;
    }

    // Clean content
    const content = cleanText(rawText);

    // Extract metadata
    const { title, summary, topics } = extractMetadata(filename, content);
    const slug = generateSlug(title);

    // Check if already exists
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      console.log('⏭️ Already exists');
      return true;
    }

    // Ensure topics exist
    const topicMap = await ensureTopicsExist(topics);

    // Create document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        slug,
        doc_type: 'article',
        summary: summary || content.slice(0, 300),
        source_file_path: filename,
      })
      .select('id')
      .single();

    if (docError) {
      console.log(`❌ ${docError.message}`);
      return false;
    }

    // Link topics
    for (const [topicSlug, topicId] of topicMap) {
      const { error: linkError } = await supabase.from('document_topics').insert({
        document_id: doc.id,
        topic_id: topicId,
      });
      // Ignore duplicate errors silently
      if (linkError && !linkError.message.includes('duplicate')) {
        console.log(`   ⚠️ Topic link error: ${linkError.message}`);
      }
    }

    // Create chunks with embeddings
    const chunks = chunkContent(content);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const embedding = await generateEmbedding(chunk);

        await supabase.from('content_chunks').insert({
          document_id: doc.id,
          content: chunk,
          chunk_index: i,
          chunk_type: 'text',
          embedding,
          metadata: { source: 'article' },
        });
      } catch (err: any) {
        console.log(`   ⚠️ Chunk ${i} error: ${err.message}`);
      }
      
      // Rate limiting
      if (i % 5 === 0 && i > 0) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log(`✅ ${chunks.length} chunks`);
    return true;

  } catch (error: any) {
    console.log(`❌ ${error.message}`);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const articlesDir = process.argv[2] || './content/Articles';

  if (!fs.existsSync(articlesDir)) {
    console.error(`❌ Articles directory not found: ${articlesDir}`);
    console.log('\nUsage: npm run ingest:articles "./content/Articles"');
    process.exit(1);
  }

  // Get all PDF files
  const files = fs.readdirSync(articlesDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort()
    .map(f => path.join(articlesDir, f));

  console.log(`
🚀 Article Group Article Ingestion
==========================================
Directory: ${articlesDir}
PDFs found: ${files.length}
==========================================
`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    process.stdout.write(`[${i + 1}/${files.length}] `);
    
    const success = await ingestArticle(file);
    if (success) {
      successful++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`
==========================================
📊 INGESTION COMPLETE
==========================================
Successful: ${successful}
Failed:     ${failed}
Total:      ${files.length}
==========================================

✨ Articles are now searchable alongside case studies!
`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
