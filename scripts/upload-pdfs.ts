/**
 * PDF Upload Script
 * 
 * Uploads case study PDFs to Supabase Storage and updates the documents table
 * with the PDF URL.
 * 
 * Usage:
 *   npm run upload:pdfs "./content/case-studies"
 * 
 * Expected folder structure:
 *   ./content/case-studies/
 *     ├── CrowdStrike - Marketecture.pdf
 *     ├── AWS - re:Invent Keynote.pdf
 *     └── ...
 * 
 * The script matches PDFs to case studies by:
 *   1. Client name in filename
 *   2. Fuzzy matching on title
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'case-study-pdfs';

// Mapping of filename patterns to client names
const CLIENT_MAPPINGS: Record<string, string[]> = {
  'CrowdStrike': ['crowdstrike', 'falcon', 'fal.con'],
  'AWS': ['aws', 'amazon web services', 'reinvent', 're:invent', 'sagemaker'],
  'Google': ['google'],
  'Google Workspace': ['workspace', 'g suite', 'gsuite'],
  'Google Cloud': ['google cloud', 'gcp'],
  'Chrome Enterprise': ['chrome enterprise'],
  'ChromeOS': ['chromeos', 'chrome os'],
  'Android': ['android'],
  'Android Enterprise': ['android enterprise'],
  'Salesforce/Slack': ['salesforce', 'slack'],
  'Simons Foundation': ['simons'],
  'Amazon re:MARS': ['re:mars', 'remars'],
  'ADP': ['adp'],
  'AIG': ['aig'],
  'Twitch': ['twitch'],
  'Meta': ['meta', 'facebook'],
  'J.P. Morgan': ['jp morgan', 'jpmorgan', 'j.p. morgan'],
  'Omnicell': ['omnicell'],
  'Salt Security': ['salt security', 'salt'],
  'Renew Home': ['renew home', 'renew'],
};

/**
 * Find matching client name from filename
 */
function findClientFromFilename(filename: string): string | null {
  const lowerFilename = filename.toLowerCase();
  
  for (const [clientName, patterns] of Object.entries(CLIENT_MAPPINGS)) {
    for (const pattern of patterns) {
      if (lowerFilename.includes(pattern.toLowerCase())) {
        return clientName;
      }
    }
  }
  
  return null;
}

/**
 * Generate a clean storage path
 */
function generateStoragePath(filename: string): string {
  const cleanFilename = filename
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `pdfs/${cleanFilename}`;
}

/**
 * Main upload function
 */
async function uploadPdfs(pdfDir: string) {
  console.log('📄 Starting PDF upload...\n');
  
  // Check if directory exists
  if (!fs.existsSync(pdfDir)) {
    console.error(`❌ Directory not found: ${pdfDir}`);
    process.exit(1);
  }
  
  // Create bucket if it doesn't exist
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
  
  if (!bucketExists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['application/pdf'],
    });
    
    if (createError) {
      console.error('❌ Failed to create bucket:', createError.message);
      process.exit(1);
    }
    console.log(`✅ Created bucket: ${BUCKET_NAME}`);
  } else {
    console.log(`✅ Using existing bucket: ${BUCKET_NAME}`);
  }
  
  // Get all PDF files
  const files = fs.readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`📁 Found ${files.length} PDF files\n`);
  
  // Get all case studies from database
  const { data: caseStudies, error: fetchError } = await supabase
    .from('documents')
    .select('id, title, client_name, slug')
    .eq('doc_type', 'case_study');
  
  if (fetchError) {
    console.error('❌ Failed to fetch case studies:', fetchError.message);
    process.exit(1);
  }
  
  console.log(`📚 Found ${caseStudies?.length || 0} case studies in database\n`);
  
  let uploaded = 0;
  let matched = 0;
  let unmatched: string[] = [];
  
  for (const file of files) {
    const filePath = path.join(pdfDir, file);
    const storagePath = generateStoragePath(file);
    
    console.log(`📤 Processing: ${file}`);
    
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    
    if (uploadError) {
      console.error(`   ❌ Upload failed: ${uploadError.message}`);
      continue;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    
    const pdfUrl = urlData.publicUrl;
    uploaded++;
    
    // Find matching case study
    const clientName = findClientFromFilename(file);
    
    if (clientName && caseStudies) {
      // Find case studies for this client
      const matchingStudies = caseStudies.filter(cs => 
        cs.client_name?.toLowerCase().includes(clientName.toLowerCase()) ||
        cs.title?.toLowerCase().includes(clientName.toLowerCase())
      );
      
      if (matchingStudies.length > 0) {
        // Update all matching case studies with the PDF URL
        for (const study of matchingStudies) {
          const { error: updateError } = await supabase
            .from('documents')
            .update({ pdf_url: pdfUrl })
            .eq('id', study.id);
          
          if (updateError) {
            console.error(`   ⚠️ Failed to update ${study.title}: ${updateError.message}`);
          } else {
            console.log(`   ✅ Linked to: ${study.title}`);
            matched++;
          }
        }
      } else {
        console.log(`   ⚠️ No case study found for client: ${clientName}`);
        unmatched.push(file);
      }
    } else {
      console.log(`   ⚠️ Could not determine client from filename`);
      unmatched.push(file);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Uploaded: ${uploaded} PDFs`);
  console.log(`🔗 Linked: ${matched} case studies`);
  console.log(`⚠️ Unmatched: ${unmatched.length} PDFs`);
  
  if (unmatched.length > 0) {
    console.log('\n⚠️ Unmatched PDFs:');
    unmatched.forEach(f => console.log(`   ${f}`));
  }
}

// Run script
const pdfDir = process.argv[2] || './content/case-studies';
uploadPdfs(pdfDir).then(() => {
  console.log('\n✨ PDF upload complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
