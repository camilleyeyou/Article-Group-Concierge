/**
 * Split & Upload PDF Script
 * 
 * This script handles the single multi-page PDF containing all case studies:
 * 1. Splits the PDF into individual pages (one per case study)
 * 2. Uploads each page to Supabase Storage
 * 3. Updates the pdf_url column in the documents table (creates record if missing)
 * 
 * Usage:
 *   npm run split:upload "./AG single page case studies 2025.pdf"
 * 
 * Options:
 *   --create-missing    Create document records if they don't exist
 * 
 * Prerequisites:
 *   - pypdf installed: pip install pypdf --break-system-packages
 *   - Supabase bucket 'case-study-pdfs' exists and is public
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables. Check .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'case-study-pdfs';

// ============================================
// CASE STUDY DEFINITIONS (page -> metadata)
// This maps each PDF page to its case study
// ============================================
interface CaseStudyDef {
  page: number;
  client: string;
  title: string;
  capabilities?: string[];
  industries?: string[];
}

const CASE_STUDIES: CaseStudyDef[] = [
  // Source: AG Website RAG case studies.pdf (43 pages, 1 case study per page)
  { page: 1, client: "Renew Home", title: "Elevating a New Brand to Own the Market Conversation", capabilities: ["brand-strategy", "content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 2, client: "Twitch", title: "Expanding a Vibrant Visual Universe", capabilities: ["creative-direction", "brand-strategy"], industries: ["media-entertainment"] },
  { page: 3, client: "AIG", title: "When Stakes Are High: Reintroducing AIG to the Market", capabilities: ["creative-direction", "content-marketing"], industries: ["finance"] },
  { page: 4, client: "AWS", title: "Creating a New Kind of Product Demo", capabilities: ["creative-direction", "content-marketing"], industries: ["technology"] },
  { page: 5, client: "AWS", title: "Bringing Powerful Gen AI Models to Life", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 6, client: "Chrome Enterprise", title: "Turning a Security Upgrade into a Compelling Video", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 7, client: "Chrome Enterprise", title: "Reclaiming the Browser Conversation", capabilities: ["brand-strategy", "creative-direction", "growth-marketing"], industries: ["technology"] },
  { page: 8, client: "J.P. Morgan", title: "Naming the Future of Retail Payments Hardware", capabilities: ["brand-strategy"], industries: ["finance"] },
  { page: 9, client: "Chorus (Alphabet X)", title: "Creating an Eye-Opening Asset Visibility Brand", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 10, client: "Google", title: "Crafting a Cross-Product Narrative", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 11, client: "Android Enterprise", title: "Hyper-Targeted Consideration Campaign", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology", "finance"] },
  { page: 12, client: "ChromeOS", title: "Cohesive Small Business Campaign", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 13, client: "ChromeOS/Cameyo", title: "Maintaining Momentum Through Launch", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 14, client: "Google Workspace", title: "Positioning a New Brand for Launch", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 15, client: "Google Workspace", title: "Building an Editorial Program", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 16, client: "Google Workspace", title: "Planning and Delivering Demand Generation", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 17, client: "Task Mate (Google)", title: "Elevated Long-Form Content", capabilities: ["content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 18, client: "Task Mate (Google)", title: "Driving Growth with Inclusive Messaging", capabilities: ["growth-marketing", "creative-direction"], industries: ["technology"] },
  { page: 19, client: "MyLink (Google)", title: "Insight-Driven Brand Development", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 20, client: "Chrome Enterprise", title: "Timely, Compelling Thought Leadership", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 21, client: "Modern Computing Alliance", title: "Delightfully Useful Design", capabilities: ["content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 22, client: "Chrome Enterprise", title: "A Vibrant Virtual Event", capabilities: ["experience-design", "creative-direction", "video-production"], industries: ["technology"] },
  { page: 23, client: "Google Messages", title: "Human-Centered Product Ads", capabilities: ["creative-direction", "video-production"], industries: ["technology"] },
  { page: 24, client: "Android", title: "Telling a More Human Story", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 25, client: "UpShow/ChromeOS", title: "Purposeful Partner Marketing", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology", "healthcare"] },
  { page: 26, client: "Chrome", title: "Earning SMB Consideration", capabilities: ["growth-marketing", "content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 27, client: "Salesforce/Slack", title: "Strategic Sales Enablement", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 28, client: "Slalom", title: "Celebrating Customer Success", capabilities: ["content-marketing", "creative-direction"], industries: ["technology", "b2b-services"] },
  { page: 29, client: "Salesforce/WhatsApp", title: "Hyping Up a Holiday Virtual Event", capabilities: ["growth-marketing", "content-marketing", "experience-design"], industries: ["technology"] },
  { page: 30, client: "Android", title: "Crafting a Brand New Virtual Event", capabilities: ["brand-strategy", "experience-design", "video-production"], industries: ["technology"] },
  { page: 31, client: "Google Cloud", title: "Illuminating a New Brand Identity", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 32, client: "AWS", title: "Keynotes That Reshape Perspectives", capabilities: ["creative-direction", "content-marketing"], industries: ["technology"] },
  { page: 33, client: "CrowdStrike", title: "Applying the Power of a Great Marketecture", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 34, client: "Amazon re:MARS", title: "Bold, Inspirational Branded Docuseries", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 35, client: "ADP", title: "Creating Keynotes That Connect", capabilities: ["creative-direction", "content-marketing"], industries: ["technology", "b2b-services"] },
  { page: 36, client: "Simons Foundation", title: "Illuminating a New Brand Identity", capabilities: ["brand-strategy", "creative-direction"], industries: ["non-profit"] },
  { page: 37, client: "AWS", title: "Inspirational Global Advertising Campaign", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 38, client: "Salt Security", title: "Defending Market Territory", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 39, client: "Meta", title: "Informed Messaging and a Unified Story", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 40, client: "Omnicell", title: "Making Marketing and Sales Talk", capabilities: ["brand-strategy", "content-marketing"], industries: ["healthcare", "technology"] },
  { page: 41, client: "AWS", title: "Transforming Digital Audits", capabilities: ["video-production", "content-marketing"], industries: ["technology"] },
  { page: 42, client: "ADP", title: "Customer Story Videos", capabilities: ["video-production", "creative-direction"], industries: ["technology", "b2b-services"] },
  { page: 43, client: "AWS/NVIDIA", title: "Co-Branded Video for a Visionary Collaboration", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
];

// Generate slug from client and title
function createSlug(client: string, title: string): string {
  const combined = `${client} ${title}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

// Generate clean filename for storage
function generateStorageFilename(client: string, title: string): string {
  const slug = createSlug(client, title);
  return `${slug}.pdf`;
}

// Split PDF using pypdf (Python)
async function splitPdfWithPython(inputPath: string, outputDir: string): Promise<void> {
  console.log('🔪 Splitting PDF using pypdf...\n');
  
  const pythonScript = `
import sys
sys.stdout.reconfigure(encoding='utf-8')

from pypdf import PdfReader, PdfWriter
import os

input_path = r"""${inputPath.replace(/\\/g, '\\\\')}"""
output_dir = r"""${outputDir.replace(/\\/g, '\\\\')}"""

os.makedirs(output_dir, exist_ok=True)

reader = PdfReader(input_path)
total_pages = len(reader.pages)
print(f"Total pages in PDF: {total_pages}")

for i in range(total_pages):
    writer = PdfWriter()
    writer.add_page(reader.pages[i])
    output_path = os.path.join(output_dir, f"page_{i + 1}.pdf")
    with open(output_path, 'wb') as output_file:
        writer.write(output_file)
    print(f"Created: page_{i + 1}.pdf")

print(f"\\nSplit complete: {total_pages} pages extracted")
`;

  const tempScript = path.join(outputDir, '_split_script.py');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(tempScript, pythonScript);
  
  try {
    execSync(`python3 "${tempScript}"`, { stdio: 'inherit' });
  } finally {
    fs.unlinkSync(tempScript);
  }
}

// Ensure bucket exists
async function ensureBucket(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
  
  if (!bucketExists) {
    console.log(`📦 Creating bucket: ${BUCKET_NAME}`);
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['application/pdf'],
    });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`✅ Bucket created\n`);
  } else {
    console.log(`✅ Bucket exists: ${BUCKET_NAME}\n`);
  }
}

// Upload a single PDF to Supabase Storage
async function uploadPdf(localPath: string, storagePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(localPath);
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
  
  if (error) throw new Error(`Upload failed: ${error.message}`);
  
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
  return data.publicUrl;
}

// Find and update the matching document in the database
async function findOrCreateDocument(
  cs: CaseStudyDef,
  pdfUrl: string,
  createMissing: boolean
): Promise<{ matched: boolean; created: boolean; documentId?: string; documentTitle?: string }> {
  
  const fullTitle = `${cs.client}: ${cs.title}`;
  const slug = createSlug(cs.client, cs.title);
  
  // Strategy 1: Try exact slug match
  let { data: existing } = await supabase
    .from('documents')
    .select('id, title')
    .eq('slug', slug)
    .eq('doc_type', 'case_study')
    .maybeSingle();
  
  // Strategy 2: Try title match
  if (!existing) {
    const { data: titleMatch } = await supabase
      .from('documents')
      .select('id, title')
      .eq('doc_type', 'case_study')
      .ilike('title', `%${cs.client}%`)
      .ilike('title', `%${cs.title.split(' ').slice(0, 3).join('%')}%`)
      .maybeSingle();
    existing = titleMatch;
  }
  
  // Strategy 3: Try client name match
  if (!existing) {
    const { data: clientMatch } = await supabase
      .from('documents')
      .select('id, title')
      .eq('doc_type', 'case_study')
      .or(`client_name.ilike.%${cs.client}%,title.ilike.%${cs.client}%`)
      .maybeSingle();
    existing = clientMatch;
  }
  
  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('documents')
      .update({ pdf_url: pdfUrl })
      .eq('id', existing.id);
    
    if (error) {
      console.log(`   ⚠️ Failed to update: ${error.message}`);
      return { matched: false, created: false };
    }
    
    return { matched: true, created: false, documentId: existing.id, documentTitle: existing.title };
  }
  
  // No existing record found
  if (createMissing) {
    // Create a new document record (minimal - no embeddings)
    const { data: newDoc, error } = await supabase
      .from('documents')
      .insert({
        title: fullTitle,
        slug: slug,
        doc_type: 'case_study',
        client_name: cs.client,
        summary: `${cs.client} case study: ${cs.title}`,
        pdf_url: pdfUrl,
      })
      .select('id, title')
      .single();
    
    if (error) {
      console.log(`   ⚠️ Failed to create: ${error.message}`);
      return { matched: false, created: false };
    }
    
    return { matched: true, created: true, documentId: newDoc.id, documentTitle: newDoc.title };
  }
  
  return { matched: false, created: false };
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const createMissing = args.includes('--create-missing');
  const pdfPathArg = args.find(arg => !arg.startsWith('--'));
  
  if (!pdfPathArg) {
    console.log(`
📄 Split & Upload PDF Script
=============================

Splits a multi-page PDF and uploads individual pages to Supabase Storage,
then links each page to its corresponding case study in the database.

Usage:
  npm run split:upload "./AG single page case studies 2025.pdf"
  npm run split:upload "./AG single page case studies 2025.pdf" --create-missing

Options:
  --create-missing    Create document records if they don't exist in the database

Prerequisites:
  1. pypdf installed: pip install pypdf --break-system-packages
  2. Environment variables set in .env.local
`);
    process.exit(0);
  }
  
  const pdfPath = path.resolve(pdfPathArg);
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ File not found: ${pdfPath}`);
    process.exit(1);
  }
  
  console.log(`
🚀 Article Group PDF Splitter & Uploader
==========================================
Input: ${pdfPath}
Case Studies: ${CASE_STUDIES.length}
Create Missing: ${createMissing ? 'Yes' : 'No'}
==========================================
`);

  // Create temp directory
  const tempDir = path.join(process.cwd(), '.temp-pdf-split');
  
  try {
    // Step 1: Ensure bucket exists
    await ensureBucket();
    
    // Step 2: Split PDF
    console.log('📄 Step 1: Splitting PDF...\n');
    await splitPdfWithPython(pdfPath, tempDir);
    
    // Step 3: Upload each case study page
    console.log('\n📤 Step 2: Uploading & linking case studies...\n');
    
    let uploadedCount = 0;
    let linkedCount = 0;
    let createdCount = 0;
    let notFoundCount = 0;
    const notFound: string[] = [];
    
    for (const cs of CASE_STUDIES) {
      const pageFile = path.join(tempDir, `page_${cs.page}.pdf`);
      
      if (!fs.existsSync(pageFile)) {
        console.log(`⚠️ Page ${cs.page} not found, skipping`);
        continue;
      }
      
      const storageFilename = generateStorageFilename(cs.client, cs.title);
      const storagePath = `individual/${storageFilename}`;
      
      process.stdout.write(`[${cs.page}] ${cs.client}: ${cs.title.substring(0, 35)}... `);
      
      try {
        // Upload to Supabase Storage
        const pdfUrl = await uploadPdf(pageFile, storagePath);
        uploadedCount++;
        
        // Update or create document record
        const result = await findOrCreateDocument(cs, pdfUrl, createMissing);
        
        if (result.matched) {
          linkedCount++;
          if (result.created) {
            createdCount++;
            console.log('✅ Created & Linked');
          } else {
            console.log('✅ Linked');
          }
        } else {
          notFoundCount++;
          notFound.push(`${cs.client}: ${cs.title}`);
          console.log('⚠️ Uploaded (no DB match)');
        }
        
      } catch (error: any) {
        console.log(`❌ Error: ${error.message || error}`);
      }
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up temporary files...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Summary
    console.log(`
==========================================
📊 SUMMARY
==========================================
Uploaded:  ${uploadedCount} PDFs
Linked:    ${linkedCount} case studies
Created:   ${createdCount} new records
Unmatched: ${notFoundCount} (uploaded but no DB record)
==========================================
`);

    if (notFound.length > 0 && !createMissing) {
      console.log('⚠️ Unmatched case studies:');
      notFound.slice(0, 10).forEach(cs => console.log(`   - ${cs}`));
      if (notFound.length > 10) console.log(`   ... and ${notFound.length - 10} more`);
      console.log('\n💡 Tip: Run with --create-missing to auto-create document records');
    }
    
    console.log('\n✨ Done! PDFs are now available on case study detail pages.');
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message || error);
    
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    process.exit(1);
  }
}

main().catch(console.error);
