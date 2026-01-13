/**
 * Ingestion Script for Article Group Content
 * Supports both case studies and blog articles
 * 
 * Usage:
 *   npx tsx scripts/ingest.ts
 * 
 * Or use npm scripts:
 *   npm run ingest:single
 *   npm run ingest:batch
 *   npm run ingest:discover ./path/to/pdfs
 */

// Load environment variables FIRST before any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Now import the rest
import * as fs from 'fs';
import { ingestDocument, batchIngest } from '../src/lib/ingestion';
import type { DocumentType } from '../src/types';

// ============================================
// CONFIGURATION - Update these!
// ============================================

// Option 1: Single file ingestion
const SINGLE_FILE = {
  filePath: './content/example.pdf', // Update this path
  options: {
    title: 'Example Document Title',
    slug: 'example-document',
    docType: 'case_study' as DocumentType, // or 'article'
    
    // For case studies:
    clientName: 'Client Name',
    vimeoUrl: 'https://vimeo.com/123456789',
    
    // For articles:
    // author: 'Author Name',
    // publishedDate: '2024-01-15',
    
    summary: 'Brief summary of the document...',
    capabilitySlugs: ['brand-strategy', 'creative-direction'],
    industrySlugs: ['technology'],
    topicSlugs: [], // For articles
  }
};

// Option 2: Batch ingestion - configure all your documents here
const BATCH_FILES = [
  // === CASE STUDIES ===
  {
    filePath: './content/case-studies/nike-campaign.pdf',
    options: {
      title: 'Nike: Breaking the Finish Line',
      slug: 'nike-breaking-finish-line',
      docType: 'case_study' as DocumentType,
      clientName: 'Nike',
      capabilitySlugs: ['brand-strategy', 'creative-direction', 'video-production'],
      industrySlugs: ['retail', 'consumer-goods'],
    }
  },
  {
    filePath: './content/case-studies/stripe-rebrand.pdf',
    options: {
      title: 'Stripe: Simplifying Payments',
      slug: 'stripe-simplifying-payments',
      docType: 'case_study' as DocumentType,
      clientName: 'Stripe',
      capabilitySlugs: ['brand-strategy', 'digital-transformation'],
      industrySlugs: ['technology', 'finance'],
    }
  },
  
  // === ARTICLES ===
  {
    filePath: './content/articles/future-of-branding.pdf',
    options: {
      title: 'The Future of Branding in the AI Era',
      slug: 'future-of-branding-ai-era',
      docType: 'article' as DocumentType,
      author: 'Article Group',
      publishedDate: '2024-06-15',
      topicSlugs: ['ai-innovation', 'brand-building'],
      capabilitySlugs: ['brand-strategy'],
    }
  },
  {
    filePath: './content/articles/marketing-trends-2024.pdf',
    options: {
      title: '10 Marketing Trends to Watch in 2024',
      slug: 'marketing-trends-2024',
      docType: 'article' as DocumentType,
      author: 'Article Group',
      publishedDate: '2024-01-10',
      topicSlugs: ['marketing-trends', 'industry-insights'],
      capabilitySlugs: ['growth-marketing', 'content-marketing'],
    }
  },
  // Add more documents...
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function listPDFsInDirectory(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter(file => file.toLowerCase().endsWith('.pdf'))
    .map(file => path.join(dirPath, file));
}

function inferDocType(filePath: string): DocumentType {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.includes('article') || lowerPath.includes('blog') || lowerPath.includes('post')) {
    return 'article';
  }
  return 'case_study';
}

// ============================================
// MAIN INGESTION LOGIC
// ============================================

async function ingestSingleFile() {
  console.log('='.repeat(50));
  console.log('SINGLE FILE INGESTION');
  console.log('='.repeat(50));
  
  const { filePath, options } = SINGLE_FILE;
  
  if (!fileExists(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    console.log('\nMake sure to update the file path in scripts/ingest.ts');
    process.exit(1);
  }
  
  console.log(`\n📄 Ingesting: ${options.title}`);
  console.log(`   Type: ${options.docType}`);
  console.log(`   File: ${filePath}`);
  
  try {
    const result = await ingestDocument(filePath, options);
    console.log(`\n✅ Success!`);
    console.log(`   Document ID: ${result.documentId}`);
    console.log(`   Chunks created: ${result.chunksCreated}`);
    console.log(`   Assets created: ${result.assetsCreated}`);
  } catch (error) {
    console.error(`\n❌ Failed:`, error);
    process.exit(1);
  }
}

async function ingestBatchFiles() {
  console.log('='.repeat(50));
  console.log('BATCH INGESTION');
  console.log('='.repeat(50));
  
  // Filter to only existing files
  const validFiles = BATCH_FILES.filter(item => {
    if (!fileExists(item.filePath)) {
      console.warn(`⚠️  Skipping (not found): ${item.filePath}`);
      return false;
    }
    return true;
  });
  
  if (validFiles.length === 0) {
    console.error('\n❌ No valid files found!');
    console.log('Update the BATCH_FILES array in scripts/ingest.ts with your file paths.');
    process.exit(1);
  }
  
  // Count by type
  const caseStudies = validFiles.filter(f => f.options.docType === 'case_study').length;
  const articles = validFiles.filter(f => f.options.docType === 'article').length;
  
  console.log(`\n📚 Found ${validFiles.length} files to ingest`);
  console.log(`   Case Studies: ${caseStudies}`);
  console.log(`   Articles: ${articles}\n`);
  
  const result = await batchIngest(validFiles, (completed, total, current) => {
    console.log(`[${completed + 1}/${total}] Processing: ${current}`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('BATCH RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${result.successful}`);
  console.log(`❌ Failed: ${result.failed}`);
  
  if (result.failed > 0) {
    console.log('\nFailed items:');
    result.results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`   - ${r.title}: ${r.error}`));
  }
}

async function discoverAndIngest(directory: string) {
  console.log('='.repeat(50));
  console.log('AUTO-DISCOVERY INGESTION');
  console.log('='.repeat(50));
  
  const pdfFiles = listPDFsInDirectory(directory);
  
  if (pdfFiles.length === 0) {
    console.error(`\n❌ No PDFs found in: ${directory}`);
    process.exit(1);
  }
  
  console.log(`\n📂 Found ${pdfFiles.length} PDFs in ${directory}\n`);
  
  for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath, '.pdf');
    const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const docType = inferDocType(filePath);
    
    console.log(`\n📄 Processing: ${fileName}`);
    console.log(`   Inferred type: ${docType}`);
    
    try {
      const result = await ingestDocument(filePath, {
        title: fileName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        slug,
        docType,
        // Add capabilities/industries/topics manually after via Supabase dashboard
      });
      
      console.log(`   ✅ Done! ID: ${result.documentId}, Chunks: ${result.chunksCreated}`);
    } catch (error) {
      console.error(`   ❌ Failed:`, (error as Error).message);
    }
  }
  
  console.log('\n💡 Tip: Add capabilities, industries, and topics via Supabase dashboard');
}

// ============================================
// CLI ENTRY POINT
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'single';
  
  console.log('\n🚀 Article Group Content Ingestion\n');
  
  // Check for required env vars
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'LLAMA_CLOUD_API_KEY',
  ];
  
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.log('\nMake sure your .env.local file is set up correctly.');
    process.exit(1);
  }
  
  switch (mode) {
    case 'single':
      await ingestSingleFile();
      break;
    
    case 'batch':
      await ingestBatchFiles();
      break;
    
    case 'discover':
      const dir = args[1] || './content';
      await discoverAndIngest(dir);
      break;
    
    default:
      console.log('Usage:');
      console.log('  npm run ingest single              - Ingest a single configured file');
      console.log('  npm run ingest batch               - Ingest all files in BATCH_FILES array');
      console.log('  npm run ingest discover ./content  - Auto-discover and ingest PDFs');
      console.log('\nDocument Types:');
      console.log('  case_study - Client work with metrics, videos');
      console.log('  article    - Blog posts, thought leadership');
  }
}

main().catch(console.error);
