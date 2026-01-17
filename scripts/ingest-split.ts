/**
 * Case Study Splitter & Ingestion Script
 * 
 * This script:
 * 1. Splits the multi-page PDF into individual case study PDFs
 * 2. Creates proper document records for each case study
 * 3. Ingests each with correct metadata (client, title, capabilities)
 * 
 * Usage:
 *   npm run ingest:split ./path/to/AG-single-page-case-studies.pdf
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { execSync } from 'child_process';
import { ingestDocument } from '../src/lib/ingestion';

// Case study metadata extracted from PDF analysis
const CASE_STUDIES: Array<{
  page: number;
  client: string;
  title: string;
  capabilities: string[];
  industries: string[];
}> = [
  { page: 2, client: "Renew Home", title: "Go-to-Market Story for Sustainable Energy Launch", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 3, client: "Twitch", title: "Brand Partnership Studio Creative Assets", capabilities: ["creative-direction", "content-marketing"], industries: ["media-entertainment"] },
  { page: 4, client: "AIG", title: "Investor Day Visual Narrative", capabilities: ["creative-direction", "content-marketing"], industries: ["finance"] },
  { page: 5, client: "AWS", title: "Amazon SageMaker Product Demo", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 6, client: "AWS", title: "Amazon Nova AI Models Video Campaign", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 7, client: "Chrome Enterprise", title: "Chrome Enterprise Premium Security Video", capabilities: ["video-production", "content-marketing"], industries: ["technology"] },
  { page: 8, client: "Chrome Enterprise", title: "No Place Like Chrome Campaign Reset", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 9, client: "J.P. Morgan", title: "Payments Hardware Terminal Naming", capabilities: ["brand-strategy"], industries: ["finance"] },
  { page: 10, client: "Android Enterprise", title: "Gen Z Workforce Research & Outreach", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 11, client: "Chorus (Alphabet X)", title: "Brand & Narrative for Asset Visibility Platform", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 12, client: "Google", title: "Cross-Product Narrative Unification", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 13, client: "Android Enterprise", title: "Financial Services Industry Story", capabilities: ["content-marketing"], industries: ["technology", "finance"] },
  { page: 14, client: "Google", title: "Executive Thought Leadership in Education", capabilities: ["content-marketing", "social-strategy"], industries: ["technology"] },
  { page: 15, client: "Google for Education", title: "Future of Education Video Series", capabilities: ["video-production", "content-marketing"], industries: ["technology"] },
  { page: 16, client: "Google Learning", title: "LinkedIn Executive Presence", capabilities: ["content-marketing", "social-strategy"], industries: ["technology"] },
  { page: 17, client: "ChromeOS", title: "Small Business Market Campaign", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 18, client: "Google/Cameyo", title: "VAD Platform Integration Marketing", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 19, client: "Google Workspace", title: "G Suite to Workspace Rebrand", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 20, client: "Google Workspace", title: "Future of Work Thought Leadership", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 21, client: "Google Workspace", title: "Demand Generation Content Strategy", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 22, client: "Task Mate", title: "Inclusive Data eBook for Google I/O", capabilities: ["content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 23, client: "Task Mate", title: "In-Market App Campaign India", capabilities: ["growth-marketing", "creative-direction"], industries: ["technology"] },
  { page: 24, client: "MyLink (Google)", title: "Link-in-Bio Brand Identity", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 25, client: "Google NBU", title: "Nigeria Digital Behavior Research", capabilities: ["brand-strategy"], industries: ["technology"] },
  { page: 26, client: "Chrome Enterprise", title: "Remote Work Thought Leadership", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 27, client: "Google/MCA", title: "Modern Computing Alliance Report", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 28, client: "Chrome Enterprise", title: "Demo Day Virtual Event", capabilities: ["experience-design", "creative-direction"], industries: ["technology"] },
  { page: 29, client: "Google Messages", title: "Product Awareness Campaign", capabilities: ["creative-direction", "video-production"], industries: ["technology"] },
  { page: 30, client: "Android", title: "Mobile Security Messaging", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 31, client: "UpShow/ChromeOS", title: "Retail Health Partner Marketing", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology", "healthcare"] },
  { page: 32, client: "ChromeOS", title: "SMB Consideration Campaign", capabilities: ["growth-marketing", "content-marketing"], industries: ["technology"] },
  { page: 33, client: "Salesforce/Slack", title: "Partner Sales Enablement Training", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 34, client: "Slalom/Salesforce", title: "Customer Success Stories", capabilities: ["content-marketing", "creative-direction"], industries: ["technology", "b2b-services"] },
  { page: 35, client: "Salesforce/WhatsApp", title: "LATAM Holiday Messaging Campaign", capabilities: ["growth-marketing", "content-marketing"], industries: ["technology"] },
  { page: 36, client: "Android Enterprise", title: "Brand Repositioning & Virtual Event", capabilities: ["brand-strategy", "experience-design"], industries: ["technology"] },
  { page: 37, client: "Google Cloud", title: "Cloud Innovators Program Identity", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 38, client: "AWS", title: "re:Invent Keynote Presentations", capabilities: ["creative-direction", "content-marketing"], industries: ["technology"] },
  { page: 39, client: "CrowdStrike", title: "Marketecture & Product Portfolio", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 40, client: "Amazon re:MARS", title: "Branded Docuseries", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 41, client: "ADP", title: "HR Keynote Presentations", capabilities: ["creative-direction", "content-marketing"], industries: ["technology", "b2b-services"] },
  { page: 42, client: "Simons Foundation", title: "Brand Identity & Sub-brand Unification", capabilities: ["brand-strategy", "creative-direction"], industries: ["non-profit"] },
  { page: 43, client: "AWS", title: "Global Brand Advertising Campaign", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 44, client: "Salt Security", title: "API Security Brand Refresh", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 45, client: "Meta", title: "B2B Messaging Platform Story", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 46, client: "Omnicell", title: "Autonomous Pharmacy Positioning", capabilities: ["brand-strategy", "content-marketing"], industries: ["healthcare", "technology"] },
  { page: 47, client: "AWS", title: "Digital Audit Symposium Solution", capabilities: ["digital-transformation", "content-marketing"], industries: ["technology"] },
  { page: 48, client: "ADP", title: "Meeting of the Minds Product Videos", capabilities: ["video-production", "creative-direction"], industries: ["technology", "b2b-services"] },
  { page: 49, client: "AWS/NVIDIA", title: "Project Ceiba AI Supercomputer Video", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
];

// Helper to create slug from client and title
function createSlug(client: string, title: string): string {
  const combined = `${client} ${title}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

// Check if pdftk or qpdf is available for splitting
function checkPdfTool(): { tool: 'pdftk' | 'qpdf' | 'python', pythonCmd?: string } | null {
  try {
    execSync('which pdftk', { stdio: 'ignore' });
    return { tool: 'pdftk' };
  } catch {
    try {
      execSync('which qpdf', { stdio: 'ignore' });
      return { tool: 'qpdf' };
    } catch {
      // Try different python commands
      const pythonCmds = ['python3.13', 'python3.12', 'python3.11', 'python3', 'python', '/usr/bin/python3', '/usr/local/bin/python3'];
      for (const cmd of pythonCmds) {
        try {
          execSync(`${cmd} -c "import fitz"`, { stdio: 'ignore' });
          return { tool: 'python', pythonCmd: cmd };
        } catch {
          continue;
        }
      }
      return null;
    }
  }
}

// Split PDF using available tool
async function splitPdf(inputPath: string, outputDir: string): Promise<Map<number, string>> {
  const toolInfo = checkPdfTool();
  const pageFiles = new Map<number, string>();
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  if (!toolInfo) {
    throw new Error('No PDF splitting tool available. Please install pdftk, qpdf, or PyMuPDF (pip install pymupdf)');
  }
  
  console.log(`Using ${toolInfo.tool}${toolInfo.pythonCmd ? ` (${toolInfo.pythonCmd})` : ''} to split PDF...`);
  
  if (toolInfo.tool === 'python') {
    const pythonCmd = toolInfo.pythonCmd || 'python3';
    // Use PyMuPDF to split
    const pythonScript = `
import fitz
import sys

input_path = "${inputPath}"
output_dir = "${outputDir}"

doc = fitz.open(input_path)
for page_num in range(doc.page_count):
    # Create a new PDF with just this page
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
    output_path = f"{output_dir}/page_{page_num + 1}.pdf"
    new_doc.save(output_path)
    new_doc.close()
    print(f"Created: {output_path}")

doc.close()
`;
    
    const tempScript = path.join(outputDir, '_split.py');
    fs.writeFileSync(tempScript, pythonScript);
    execSync(`${pythonCmd} "${tempScript}"`, { stdio: 'inherit' });
    fs.unlinkSync(tempScript);
    
  } else if (toolInfo.tool === 'pdftk') {
    execSync(`pdftk "${inputPath}" burst output "${outputDir}/page_%d.pdf"`, { stdio: 'inherit' });
  } else if (toolInfo.tool === 'qpdf') {
    // qpdf splits differently, need to do page by page
    const pageCount = parseInt(execSync(`qpdf --show-npages "${inputPath}"`).toString().trim());
    for (let i = 1; i <= pageCount; i++) {
      const outputPath = path.join(outputDir, `page_${i}.pdf`);
      execSync(`qpdf "${inputPath}" --pages . ${i} -- "${outputPath}"`, { stdio: 'ignore' });
    }
  }
  
  // Map page numbers to file paths
  for (const cs of CASE_STUDIES) {
    const filePath = path.join(outputDir, `page_${cs.page}.pdf`);
    if (fs.existsSync(filePath)) {
      pageFiles.set(cs.page, filePath);
    }
  }
  
  return pageFiles;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
📚 Case Study Splitter & Ingestion Script
==========================================

Usage:
  npm run ingest:split <path-to-pdf>

Example:
  npm run ingest:split "./content/AG single page case studies 2025.pdf"

This will:
1. Split the PDF into individual pages
2. Create a document record for each case study
3. Ingest with proper metadata (client, title, capabilities, industries)
`);
    process.exit(0);
  }
  
  const pdfPath = args[0];
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ File not found: ${pdfPath}`);
    process.exit(1);
  }
  
  console.log(`
🚀 Article Group Case Study Ingestion
==========================================
PDF: ${pdfPath}
Case Studies: ${CASE_STUDIES.length}
==========================================
`);
  
  // Create temp directory for split PDFs
  const tempDir = path.join(process.cwd(), '.temp-split-pdfs');
  
  try {
    // Step 1: Split PDF
    console.log('📄 Step 1: Splitting PDF into individual pages...\n');
    const pageFiles = await splitPdf(pdfPath, tempDir);
    console.log(`\n✅ Split into ${pageFiles.size} pages\n`);
    
    // Step 2: Ingest each case study
    console.log('📥 Step 2: Ingesting case studies...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const cs of CASE_STUDIES) {
      const filePath = pageFiles.get(cs.page);
      
      if (!filePath) {
        console.log(`⚠️  Page ${cs.page} not found, skipping ${cs.client}: ${cs.title}`);
        failCount++;
        continue;
      }
      
      const slug = createSlug(cs.client, cs.title);
      
      console.log(`\n📄 [${cs.page}/${CASE_STUDIES.length}] ${cs.client}: ${cs.title}`);
      console.log(`   Capabilities: ${cs.capabilities.join(', ')}`);
      console.log(`   Industries: ${cs.industries.join(', ')}`);
      
      try {
        const result = await ingestDocument(filePath, {
          title: `${cs.client}: ${cs.title}`,
          clientName: cs.client,
          slug: slug,
          docType: 'case_study',
          capabilitySlugs: cs.capabilities,
          industrySlugs: cs.industries,
        });
        
        console.log(`   ✅ Done! ID: ${result.documentId}, Chunks: ${result.chunksCreated}`);
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Failed: ${error}`);
        failCount++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up temporary files...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log(`
==========================================
✅ INGESTION COMPLETE
==========================================
Successful: ${successCount}
Failed: ${failCount}
Total: ${CASE_STUDIES.length}
==========================================
`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    process.exit(1);
  }
}

main().catch(console.error);