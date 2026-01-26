/**
 * Populate Case Studies Script
 * 
 * Creates document records with metadata, links PDFs, and generates embeddings.
 * Skips LlamaParse - uses predefined summaries instead.
 * 
 * Usage:
 *   npm run populate
 * 
 * Prerequisites:
 *   - PDFs already uploaded to Supabase Storage (run split:upload first)
 *   - OpenAI API key in .env.local
 *   - Database cleared (run DELETE queries first)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables. Check .env.local');
  process.exit(1);
}

if (!openaiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'case-study-pdfs';

// ============================================
// OPENAI EMBEDDING
// ============================================

async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
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
// CASE STUDY DEFINITIONS
// ============================================
interface CaseStudyDef {
  page: number;
  client: string;
  title: string;
  summary: string;
  capabilities: string[];
  industries: string[];
  vimeoUrl?: string;
}

const CASE_STUDIES: CaseStudyDef[] = [
  { page: 2, client: "Renew Home", title: "Go-to-Market Story for Sustainable Energy Launch", summary: "Developed go-to-market narrative for sustainable energy company's Distributech launch, including CEO and executive presentation content.", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 3, client: "Twitch", title: "Brand Partnership Studio Creative Assets", summary: "Created versatile creative assets for Twitch Brand Partnership Studio, extending brand into sports and adventure TV content categories.", capabilities: ["creative-direction", "content-marketing"], industries: ["media-entertainment"] },
  { page: 4, client: "AIG", title: "Investor Day Visual Narrative", summary: "Transformed complex strategic roadmap and financials into compelling visual narrative for AIG's first Investor Day in over a decade.", capabilities: ["creative-direction", "content-marketing"], industries: ["finance"] },
  { page: 5, client: "AWS", title: "Amazon SageMaker Product Demo", summary: "Created unified product demo for Amazon SageMaker launch, clarifying platform complexity and showcasing ML model building capabilities.", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 6, client: "AWS", title: "Amazon Nova AI Models Video Campaign", summary: "Produced video campaign for Amazon Nova AI models launch, showcasing new generative AI capabilities.", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 7, client: "Chrome Enterprise", title: "Chrome Enterprise Premium Security Video", summary: "Created security-focused video content for Chrome Enterprise Premium, highlighting enterprise security features.", capabilities: ["video-production", "content-marketing"], industries: ["technology"] },
  { page: 8, client: "Chrome Enterprise", title: "No Place Like Chrome Campaign Reset", summary: "Reset and refreshed the No Place Like Chrome campaign with new creative direction and messaging.", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 9, client: "J.P. Morgan", title: "Payments Hardware Terminal Naming", summary: "Developed naming strategy for J.P. Morgan's payments hardware terminal product line.", capabilities: ["brand-strategy"], industries: ["finance"] },
  { page: 10, client: "Android Enterprise", title: "Gen Z Workforce Research & Outreach", summary: "Conducted research and developed outreach strategy targeting Gen Z workforce for Android Enterprise adoption.", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 11, client: "Chorus (Alphabet X)", title: "Brand & Narrative for Asset Visibility Platform", summary: "Created brand identity and narrative for Alphabet X's Chorus asset visibility platform.", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 12, client: "Google", title: "Cross-Product Narrative Unification", summary: "Unified narrative across multiple Google product lines for consistent brand storytelling.", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 13, client: "Android Enterprise", title: "Financial Services Industry Story", summary: "Developed industry-specific narrative for Android Enterprise targeting financial services sector.", capabilities: ["content-marketing"], industries: ["technology", "finance"] },
  { page: 14, client: "Google", title: "Executive Thought Leadership in Education", summary: "Created executive thought leadership content focused on education sector for Google leadership.", capabilities: ["content-marketing", "social-strategy"], industries: ["technology"] },
  { page: 15, client: "Google for Education", title: "Future of Education Video Series", summary: "Produced video series exploring the future of education with Google for Education.", capabilities: ["video-production", "content-marketing"], industries: ["technology"] },
  { page: 16, client: "Google Learning", title: "LinkedIn Executive Presence", summary: "Developed LinkedIn executive presence strategy and content for Google Learning leadership.", capabilities: ["content-marketing", "social-strategy"], industries: ["technology"] },
  { page: 17, client: "ChromeOS", title: "Small Business Market Campaign", summary: "Created marketing campaign targeting small business market for ChromeOS adoption.", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 18, client: "Google/Cameyo", title: "VAD Platform Integration Marketing", summary: "Developed marketing for Google and Cameyo VAD platform integration partnership.", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 19, client: "Google Workspace", title: "G Suite to Workspace Rebrand", summary: "Led the comprehensive rebrand from G Suite to Google Workspace, including new visual identity and messaging.", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 20, client: "Google Workspace", title: "Future of Work Thought Leadership", summary: "Created thought leadership content on the future of work for Google Workspace.", capabilities: ["content-marketing", "brand-strategy"], industries: ["technology"] },
  { page: 21, client: "Google Workspace", title: "Demand Generation Content Strategy", summary: "Developed demand generation content strategy for Google Workspace growth initiatives.", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology"] },
  { page: 22, client: "Task Mate", title: "Inclusive Data eBook for Google I/O", summary: "Created inclusive data eBook for Task Mate launch at Google I/O conference.", capabilities: ["content-marketing", "creative-direction"], industries: ["technology"] },
  { page: 23, client: "Task Mate", title: "In-Market App Campaign India", summary: "Developed in-market app campaign for Task Mate launch in India market.", capabilities: ["growth-marketing", "creative-direction"], industries: ["technology"] },
  { page: 24, client: "MyLink (Google)", title: "Link-in-Bio Brand Identity", summary: "Created brand identity for Google's MyLink link-in-bio product.", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 25, client: "Google NBU", title: "Nigeria Digital Behavior Research", summary: "Conducted digital behavior research in Nigeria for Google Next Billion Users initiative.", capabilities: ["brand-strategy"], industries: ["technology"] },
  { page: 26, client: "Chrome Enterprise", title: "Remote Work Thought Leadership", summary: "Developed thought leadership content on remote work trends for Chrome Enterprise.", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 27, client: "Google/MCA", title: "Modern Computing Alliance Report", summary: "Created comprehensive industry report for Modern Computing Alliance partnership.", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 28, client: "Chrome Enterprise", title: "Demo Day Virtual Event", summary: "Designed and produced Chrome Enterprise Demo Day virtual event experience.", capabilities: ["experience-design", "creative-direction"], industries: ["technology"] },
  { page: 29, client: "Google Messages", title: "Product Awareness Campaign", summary: "Created product awareness campaign for Google Messages app features.", capabilities: ["creative-direction", "video-production"], industries: ["technology"] },
  { page: 30, client: "Android", title: "Mobile Security Messaging", summary: "Developed mobile security messaging and positioning for Android platform.", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 31, client: "UpShow/ChromeOS", title: "Retail Health Partner Marketing", summary: "Created partner marketing for UpShow and ChromeOS retail health solution.", capabilities: ["content-marketing", "growth-marketing"], industries: ["technology", "healthcare"] },
  { page: 32, client: "ChromeOS", title: "SMB Consideration Campaign", summary: "Developed consideration campaign targeting SMB market for ChromeOS adoption.", capabilities: ["growth-marketing", "content-marketing"], industries: ["technology"] },
  { page: 33, client: "Salesforce/Slack", title: "Partner Sales Enablement Training", summary: "Created sales enablement training materials for Salesforce/Slack partnership.", capabilities: ["content-marketing"], industries: ["technology"] },
  { page: 34, client: "Slalom/Salesforce", title: "Customer Success Stories", summary: "Developed customer success story content for Slalom/Salesforce partnership.", capabilities: ["content-marketing", "creative-direction"], industries: ["technology", "b2b-services"] },
  { page: 35, client: "Salesforce/WhatsApp", title: "LATAM Holiday Messaging Campaign", summary: "Created holiday messaging campaign for Salesforce/WhatsApp in LATAM market.", capabilities: ["growth-marketing", "content-marketing"], industries: ["technology"] },
  { page: 36, client: "Android Enterprise", title: "Brand Repositioning & Virtual Event", summary: "Led brand repositioning and produced virtual event for Android Enterprise.", capabilities: ["brand-strategy", "experience-design"], industries: ["technology"] },
  { page: 37, client: "Google Cloud", title: "Cloud Innovators Program Identity", summary: "Created brand identity for Google Cloud Innovators Program.", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 38, client: "AWS", title: "re:Invent Keynote Presentations", summary: "Developed keynote presentations for AWS re:Invent conference main stage.", capabilities: ["creative-direction", "content-marketing"], industries: ["technology"] },
  { page: 39, client: "CrowdStrike", title: "Marketecture & Product Portfolio", summary: "Created marketecture and product portfolio visualization for CrowdStrike security platform.", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 40, client: "Amazon re:MARS", title: "Branded Docuseries", summary: "Produced branded docuseries for Amazon re:MARS conference on AI, ML, and robotics.", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
  { page: 41, client: "ADP", title: "HR Keynote Presentations", summary: "Created HR-focused keynote presentations for ADP industry events.", capabilities: ["creative-direction", "content-marketing"], industries: ["technology", "b2b-services"] },
  { page: 42, client: "Simons Foundation", title: "Brand Identity & Sub-brand Unification", summary: "Unified brand identity across Simons Foundation and its sub-brands for consistent scientific communication.", capabilities: ["brand-strategy", "creative-direction"], industries: ["non-profit"] },
  { page: 43, client: "AWS", title: "Global Brand Advertising Campaign", summary: "Developed global brand advertising campaign for AWS cloud services.", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 44, client: "Salt Security", title: "API Security Brand Refresh", summary: "Refreshed brand identity for Salt Security API security platform.", capabilities: ["brand-strategy", "creative-direction"], industries: ["technology"] },
  { page: 45, client: "Meta", title: "B2B Messaging Platform Story", summary: "Developed B2B messaging and positioning for Meta business platform.", capabilities: ["brand-strategy", "content-marketing"], industries: ["technology"] },
  { page: 46, client: "Omnicell", title: "Autonomous Pharmacy Positioning", summary: "Created positioning strategy for Omnicell autonomous pharmacy solutions in healthcare.", capabilities: ["brand-strategy", "content-marketing"], industries: ["healthcare", "technology"] },
  { page: 47, client: "AWS", title: "Digital Audit Symposium Solution", summary: "Developed solution content for AWS Digital Audit Symposium.", capabilities: ["digital-transformation", "content-marketing"], industries: ["technology"] },
  { page: 48, client: "ADP", title: "Meeting of the Minds Product Videos", summary: "Produced product videos for ADP Meeting of the Minds event.", capabilities: ["video-production", "creative-direction"], industries: ["technology", "b2b-services"] },
  { page: 49, client: "AWS/NVIDIA", title: "Project Ceiba AI Supercomputer Video", summary: "Created video showcasing Project Ceiba AI supercomputer partnership between AWS and NVIDIA.", capabilities: ["video-production", "creative-direction"], industries: ["technology"] },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function createSlug(client: string, title: string): string {
  const combined = `${client} ${title}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function generateStorageFilename(client: string, title: string): string {
  const slug = createSlug(client, title);
  return `${slug}.pdf`;
}

// Get PDF URL from storage
function getPdfUrl(client: string, title: string): string {
  const filename = generateStorageFilename(client, title);
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/individual/${filename}`;
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  console.log(`
🚀 Article Group Case Study Population
==========================================
Case Studies: ${CASE_STUDIES.length}
==========================================
`);

  // Fetch capability and industry IDs
  console.log('📚 Loading taxonomy...');
  
  const { data: capabilities } = await supabase
    .from('capabilities')
    .select('id, slug');
  
  const { data: industries } = await supabase
    .from('industries')
    .select('id, slug');
  
  const capabilityMap = new Map(capabilities?.map(c => [c.slug, c.id]) || []);
  const industryMap = new Map(industries?.map(i => [i.slug, i.id]) || []);
  
  console.log(`   Found ${capabilityMap.size} capabilities, ${industryMap.size} industries\n`);

  let successCount = 0;
  let failCount = 0;

  for (const cs of CASE_STUDIES) {
    const fullTitle = `${cs.client}: ${cs.title}`;
    const slug = createSlug(cs.client, cs.title);
    const pdfUrl = getPdfUrl(cs.client, cs.title);
    
    process.stdout.write(`[${cs.page}] ${cs.client}: ${cs.title.substring(0, 35)}... `);
    
    try {
      // 1. Generate embedding for the summary
      const searchableText = `${cs.client} ${cs.title} ${cs.summary}`;
      const embedding = await generateEmbedding(searchableText);
      
      // 2. Create document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          title: fullTitle,
          slug: slug,
          doc_type: 'case_study',
          client_name: cs.client,
          summary: cs.summary,
          pdf_url: pdfUrl,
          vimeo_url: cs.vimeoUrl || null,
        })
        .select('id')
        .single();
      
      if (docError) {
        throw new Error(`Document insert: ${docError.message}`);
      }
      
      const documentId = doc.id;
      
      // 3. Create content chunk with embedding (for RAG search)
      const { error: chunkError } = await supabase
        .from('content_chunks')
        .insert({
          document_id: documentId,
          content: cs.summary,
          chunk_index: 0,
          chunk_type: 'narrative',
          embedding: embedding,
          metadata: { source: 'summary' },
        });
      
      if (chunkError) {
        console.warn(`   ⚠️ Chunk insert warning: ${chunkError.message}`);
      }
      
      // 4. Link capabilities
      const capabilityIds = cs.capabilities
        .map(slug => capabilityMap.get(slug))
        .filter(Boolean);
      
      if (capabilityIds.length > 0) {
        await supabase.from('document_capabilities').insert(
          capabilityIds.map(capId => ({ document_id: documentId, capability_id: capId }))
        );
      }
      
      // 5. Link industries
      const industryIds = cs.industries
        .map(slug => industryMap.get(slug))
        .filter(Boolean);
      
      if (industryIds.length > 0) {
        await supabase.from('document_industries').insert(
          industryIds.map(indId => ({ document_id: documentId, industry_id: indId }))
        );
      }
      
      console.log('✅');
      successCount++;
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
      
    } catch (error: any) {
      console.log(`❌ ${error.message}`);
      failCount++;
    }
  }

  console.log(`
==========================================
📊 SUMMARY
==========================================
Successful: ${successCount}
Failed:     ${failCount}
Total:      ${CASE_STUDIES.length}
==========================================

✨ Done! Case studies are now searchable and have PDFs linked.
`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
