/**
 * Clean PDF Ingestion Script
 * 
 * Uses simple pdf-parse instead of LlamaParse for cleaner output.
 * Specifically designed for Article Group case study PDFs.
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
// CASE STUDY DEFINITIONS
// ============================================

interface CaseStudyDef {
  page: number;
  client: string;
  title: string;
  capabilities: string[];
  industries: string[];
}

const CASE_STUDIES: CaseStudyDef[] = [
  { page: 2, client: "Renew Home", title: "Go-to-Market Story for Sustainable Energy Launch", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 3, client: "Twitch", title: "Brand Partnership Studio Creative Assets", capabilities: ["creative-direction", "content-marketing"], industries: ["media-entertainment"] },
  { page: 4, client: "AIG", title: "Investor Day Visual Narrative", capabilities: ["creative-direction", "content-marketing"], industries: ["finance"] },
  { page: 5, client: "AWS", title: "Amazon SageMaker Product Demo", capabilities: ["creative-direction", "video-production"], industries: ["technology"] },
  { page: 6, client: "AWS", title: "Amazon Nova AI Models Video Campaign", capabilities: ["video-production", "content-marketing"], industries: ["technology"] },
  { page: 7, client: "Chrome Enterprise", title: "Remote Work Thought Leadership", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 8, client: "J.P. Morgan", title: "Payments Hardware Terminal Naming", capabilities: ["brand-strategy"], industries: ["finance"] },
  { page: 9, client: "Android Enterprise", title: "Gen Z Workforce Research & Outreach", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 10, client: "Chorus (Alphabet X)", title: "Brand & Narrative for Asset Visibility Platform", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 11, client: "Google", title: "Executive Thought Leadership in Education", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 12, client: "ChromeOS", title: "SMB Consideration Campaign", capabilities: ["content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 13, client: "Google for Education", title: "Future of Education Video Series", capabilities: ["video-production", "content-marketing"], industries: ["technology"] },
  { page: 14, client: "Task Mate", title: "Inclusive Data eBook for Google I/O", capabilities: ["content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 15, client: "Google Workspace", title: "Future of Work Thought Leadership", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 16, client: "MyLink (Google)", title: "Link-in-Bio Brand Identity", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 17, client: "AWS", title: "re:Invent Keynote Presentations", capabilities: ["creative-direction", "video-production"], industries: ["technology"] },
  { page: 18, client: "Google Workspace", title: "G Suite to Workspace Rebrand", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 19, client: "Chrome Enterprise", title: "Demo Day Virtual Event", capabilities: ["creative-direction", "video-production"], industries: ["technology"] },
  { page: 20, client: "Android Enterprise", title: "Financial Services Industry Story", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology", "finance"] },
  { page: 21, client: "Salesforce/Slack", title: "Partner Sales Enablement Training", capabilities: ["content-marketing", "sales-enablement"], industries: ["technology"] },
  { page: 22, client: "Google/MCA", title: "Modern Computing Alliance Report", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 23, client: "Google NBU", title: "Nigeria Digital Behavior Research", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 24, client: "Slalom/Salesforce", title: "Customer Success Stories", capabilities: ["content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 25, client: "Google/Cameyo", title: "VAD Platform Integration Marketing", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 26, client: "ChromeOS", title: "Small Business Market Campaign", capabilities: ["content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 27, client: "Salesforce/WhatsApp", title: "LATAM Holiday Messaging Campaign", capabilities: ["creative-direction", "content-marketing"], industries: ["technology"] },
  { page: 28, client: "Google Cloud", title: "Cloud Innovators Program Identity", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 29, client: "Google Messages", title: "Product Awareness Campaign", capabilities: ["creative-direction", "content-marketing"], industries: ["technology"] },
  { page: 30, client: "Task Mate", title: "In-Market App Campaign India", capabilities: ["creative-direction", "content-marketing"], industries: ["technology"] },
  { page: 31, client: "Salt Security", title: "API Security Brand Refresh", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 32, client: "AWS", title: "Digital Audit Symposium Solution", capabilities: ["creative-direction", "content-marketing"], industries: ["technology", "finance"] },
  { page: 33, client: "Google Workspace", title: "Demand Generation Content Strategy", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 34, client: "Chrome Enterprise", title: "Chrome Enterprise Premium Security Video", capabilities: ["video-production", "content-marketing"], industries: ["technology"] },
  { page: 35, client: "Google", title: "Cross-Product Narrative Unification", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 36, client: "Android Enterprise", title: "Brand Repositioning & Virtual Event", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 37, client: "Google Learning", title: "LinkedIn Executive Presence", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 38, client: "Android", title: "Mobile Security Messaging", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 39, client: "CrowdStrike", title: "Marketecture & Product Portfolio", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 40, client: "Amazon re:MARS", title: "Branded Docuseries", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 41, client: "ADP", title: "HR Keynote Presentations", capabilities: ["creative-direction", "content-marketing"], industries: ["technology", "b2b-services"] },
  { page: 42, client: "Simons Foundation", title: "Brand Identity & Sub-brand Unification", capabilities: ["brand-strategy", "creative-direction"], industries: ["non-profit"] },
  { page: 43, client: "AWS", title: "Global Brand Advertising Campaign", capabilities: ["creative-direction", "brand-strategy"], industries: ["technology"] },
  { page: 44, client: "Chrome Enterprise", title: "No Place Like Chrome Campaign Reset", capabilities: ["creative-direction", "content-marketing"], industries: ["technology"] },
  { page: 45, client: "Meta", title: "B2B Messaging Platform Story", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 46, client: "Omnicell", title: "Autonomous Pharmacy Positioning", capabilities: ["brand-strategy", "content-marketing"], industries: ["healthcare"] },
  { page: 47, client: "AWS/NVIDIA", title: "Project Ceiba AI Supercomputer Video", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 48, client: "UpShow/ChromeOS", title: "Retail Health Partner Marketing", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology", "healthcare"] },
  { page: 49, client: "ADP", title: "Meeting of the Minds Product Videos", capabilities: ["video-production", "content-marketing"], industries: ["technology", "b2b-services"] },
];

// ============================================
// PDF TEXT EXTRACTION
// ============================================

/**
 * Extract text from a specific page of a PDF using Python/PyMuPDF
 */
async function extractPageText(pdfPath: string, pageNum: number): Promise<string> {
  const pythonScript = `
import fitz
import sys
import json

pdf_path = sys.argv[1]
page_num = int(sys.argv[2])

doc = fitz.open(pdf_path)
if page_num <= len(doc):
    page = doc[page_num - 1]
    text = page.get_text()
    print(json.dumps({"text": text}))
else:
    print(json.dumps({"text": "", "error": "Page not found"}))
doc.close()
`;

  const tempScript = '/tmp/extract_page.py';
  fs.writeFileSync(tempScript, pythonScript);

  try {
    // Try different Python commands
    const pythonCommands = ['python3.13', 'python3.12', 'python3.11', 'python3', 'python'];
    let result: string | null = null;

    for (const cmd of pythonCommands) {
      try {
        result = execSync(`${cmd} ${tempScript} "${pdfPath}" ${pageNum}`, {
          encoding: 'utf-8',
          timeout: 30000,
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
    console.error(`Error extracting page ${pageNum}:`, error);
    return '';
  }
}

// ============================================
// CONTENT CLEANING & STRUCTURING
// ============================================

/**
 * Clean and structure the extracted text
 */
function cleanAndStructureContent(rawText: string, caseStudy: CaseStudyDef): {
  summary: string;
  challenge: string;
  journey: string;
  solution: string;
  fullContent: string;
} {
  // Basic cleaning
  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Try to extract structured sections
  let challenge = '';
  let journey = '';
  let solution = '';
  let summary = '';

  // Common patterns in AG case studies
  const challengeMatch = text.match(/Challenge:?\s*\n?([\s\S]*?)(?=Journey:|Solution:|$)/i);
  const journeyMatch = text.match(/Journey:?\s*\n?([\s\S]*?)(?=Solution:|Challenge:|$)/i);
  const solutionMatch = text.match(/Solution:?\s*\n?([\s\S]*?)(?=Challenge:|Journey:|$)/i);

  if (challengeMatch) {
    challenge = cleanSection(challengeMatch[1]);
  }
  if (journeyMatch) {
    journey = cleanSection(journeyMatch[1]);
  }
  if (solutionMatch) {
    solution = cleanSection(solutionMatch[1]);
  }

  // Create summary from challenge or first meaningful paragraph
  if (challenge) {
    summary = challenge.split('\n')[0].slice(0, 300);
  } else {
    // Find first paragraph that's not a header
    const paragraphs = text.split('\n\n').filter(p => p.length > 50);
    if (paragraphs.length > 0) {
      summary = paragraphs[0].slice(0, 300);
    }
  }

  // Build clean full content
  const sections: string[] = [];
  if (challenge) sections.push(`**Challenge**\n${challenge}`);
  if (journey) sections.push(`**Journey**\n${journey}`);
  if (solution) sections.push(`**Solution**\n${solution}`);

  const fullContent = sections.length > 0 
    ? sections.join('\n\n') 
    : cleanSection(text);

  return {
    summary: cleanSection(summary),
    challenge,
    journey,
    solution,
    fullContent,
  };
}

/**
 * Clean a text section
 */
function cleanSection(text: string): string {
  return text
    // Remove page numbers
    .replace(/^\d+\s*$/gm, '')
    // Remove common junk
    .replace(/Proprietary\s*\+?\s*Confidential/gi, '')
    .replace(/Article\s*Group/gi, '')
    .replace(/©\s*\d{4}/g, '')
    // Clean whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

// ============================================
// EMBEDDING GENERATION
// ============================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // Limit input size
  });
  return response.data[0].embedding;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

function generateSlug(client: string, title: string): string {
  return `${client}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

async function ensureCapabilitiesExist(slugs: string[]): Promise<void> {
  const capabilityNames: Record<string, string> = {
    'brand-strategy': 'Brand Strategy',
    'content-marketing': 'Content Marketing',
    'creative-direction': 'Creative Direction',
    'video-production': 'Video Production',
    'sales-enablement': 'Sales Enablement',
  };

  for (const slug of slugs) {
    const { data: existing } = await supabase
      .from('capabilities')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!existing) {
      await supabase.from('capabilities').insert({
        name: capabilityNames[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        slug,
      });
    }
  }
}

async function ensureIndustriesExist(slugs: string[]): Promise<void> {
  const industryNames: Record<string, string> = {
    'technology': 'Technology',
    'finance': 'Finance',
    'healthcare': 'Healthcare',
    'media-entertainment': 'Media & Entertainment',
    'non-profit': 'Non-Profit',
    'b2b-services': 'B2B Services',
  };

  for (const slug of slugs) {
    const { data: existing } = await supabase
      .from('industries')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!existing) {
      await supabase.from('industries').insert({
        name: industryNames[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        slug,
      });
    }
  }
}

async function ingestCaseStudy(
  pdfPath: string,
  caseStudy: CaseStudyDef
): Promise<boolean> {
  const slug = generateSlug(caseStudy.client, caseStudy.title);
  console.log(`\n📄 Processing: ${caseStudy.client}: ${caseStudy.title}`);

  try {
    // Extract text from page
    const rawText = await extractPageText(pdfPath, caseStudy.page);
    if (!rawText || rawText.length < 50) {
      console.log(`  ⚠️ No text extracted from page ${caseStudy.page}`);
      return false;
    }

    // Clean and structure content
    const content = cleanAndStructureContent(rawText, caseStudy);
    console.log(`  📝 Extracted ${content.fullContent.length} chars`);

    // Ensure capabilities and industries exist
    await ensureCapabilitiesExist(caseStudy.capabilities);
    await ensureIndustriesExist(caseStudy.industries);

    // Create document record
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        title: `${caseStudy.client}: ${caseStudy.title}`,
        slug,
        doc_type: 'case_study',
        client_name: caseStudy.client,
        summary: content.summary || null,
      })
      .select()
      .single();

    if (docError) {
      console.error(`  ❌ Error creating document:`, docError);
      return false;
    }

    console.log(`  ✅ Created document: ${doc.id}`);

    // Link capabilities
    for (const capSlug of caseStudy.capabilities) {
      const { data: cap } = await supabase
        .from('capabilities')
        .select('id')
        .eq('slug', capSlug)
        .single();

      if (cap) {
        await supabase.from('document_capabilities').insert({
          document_id: doc.id,
          capability_id: cap.id,
          capability_slug: capSlug,
        });
      }
    }

    // Link industries
    for (const indSlug of caseStudy.industries) {
      const { data: ind } = await supabase
        .from('industries')
        .select('id')
        .eq('slug', indSlug)
        .single();

      if (ind) {
        await supabase.from('document_industries').insert({
          document_id: doc.id,
          industry_id: ind.id,
          industry_slug: indSlug,
        });
      }
    }

    // Create content chunks with embeddings
    const chunks = [
      { type: 'full', content: content.fullContent },
    ];

    // Add individual sections if they exist
    if (content.challenge) {
      chunks.push({ type: 'challenge', content: content.challenge });
    }
    if (content.journey) {
      chunks.push({ type: 'journey', content: content.journey });
    }
    if (content.solution) {
      chunks.push({ type: 'solution', content: content.solution });
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.content || chunk.content.length < 10) continue;

      console.log(`  🔄 Generating embedding for ${chunk.type} chunk...`);
      const embedding = await generateEmbedding(chunk.content);

      const { error: chunkError } = await supabase.from('content_chunks').insert({
        document_id: doc.id,
        content: chunk.content,
        chunk_index: i,
        chunk_type: chunk.type,
        embedding,
      });

      if (chunkError) {
        console.error(`  ⚠️ Error creating chunk:`, chunkError);
      }
    }

    console.log(`  ✅ Created ${chunks.length} chunks`);
    return true;

  } catch (error) {
    console.error(`  ❌ Error processing case study:`, error);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log('Usage: npx ts-node scripts/ingest-clean.ts <path-to-pdf>');
    console.log('Example: npx ts-node scripts/ingest-clean.ts "./content/AG single page case studies 2025.pdf"');
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log('🚀 Starting clean ingestion...');
  console.log(`📁 PDF: ${pdfPath}`);
  console.log(`📊 Case studies to process: ${CASE_STUDIES.length}`);

  let successful = 0;
  let failed = 0;

  for (const caseStudy of CASE_STUDIES) {
    const success = await ingestCaseStudy(pdfPath, caseStudy);
    if (success) {
      successful++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 INGESTION COMPLETE');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));
}

main().catch(console.error);
