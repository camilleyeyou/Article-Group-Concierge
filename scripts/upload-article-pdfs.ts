/**
 * Upload Article PDFs Script
 * 
 * Uploads article PDFs to Supabase Storage and updates the pdf_url in documents table.
 * 
 * Usage:
 *   npm run upload:article-pdfs "./content/Articles"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'article-pdfs';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET_NAME);
  
  if (!exists) {
    console.log(`📦 Creating bucket: ${BUCKET_NAME}`);
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
    });
    if (error && !error.message.includes('already exists')) {
      throw error;
    }
  }
}

async function uploadArticlePdf(pdfPath: string): Promise<boolean> {
  const filename = path.basename(pdfPath);
  const shortName = filename.length > 55 ? filename.slice(0, 52) + '...' : filename;
  
  process.stdout.write(`📄 ${shortName} `);

  try {
    // Generate slug from filename
    const title = filename
      .replace(/\.pdf$/i, '')
      .replace(/_/g, ' ')
      .replace(/-/g, ' - ')
      .trim();
    
    // Truncate title for slug if too long
    let slugTitle = title;
    if (slugTitle.length > 150) {
      const breakPoints = [' - ', ' and ', ' with ', ' for '];
      for (const bp of breakPoints) {
        const idx = slugTitle.indexOf(bp);
        if (idx > 30 && idx < 120) {
          slugTitle = slugTitle.slice(0, idx);
          break;
        }
      }
      if (slugTitle.length > 150) {
        slugTitle = slugTitle.slice(0, 147);
      }
    }
    
    const slug = generateSlug(slugTitle);
    
    // Find the document
    const { data: doc, error: findError } = await supabase
      .from('documents')
      .select('id, slug, pdf_url')
      .eq('doc_type', 'article')
      .eq('slug', slug)
      .maybeSingle();

    if (findError) {
      console.log(`❌ DB error: ${findError.message}`);
      return false;
    }

    if (!doc) {
      console.log(`⚠️ No matching document found for slug: ${slug.slice(0, 40)}...`);
      return false;
    }

    // Skip if already has PDF
    if (doc.pdf_url) {
      console.log(`⏭️ Already has PDF`);
      return true;
    }

    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const storagePath = `${slug}.pdf`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.log(`❌ Upload error: ${uploadError.message}`);
      return false;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const pdfUrl = urlData.publicUrl;

    // Update document
    const { error: updateError } = await supabase
      .from('documents')
      .update({ pdf_url: pdfUrl })
      .eq('id', doc.id);

    if (updateError) {
      console.log(`❌ Update error: ${updateError.message}`);
      return false;
    }

    console.log(`✅ Uploaded`);
    return true;

  } catch (error: any) {
    console.log(`❌ ${error.message}`);
    return false;
  }
}

async function main() {
  const articlesDir = process.argv[2] || './content/Articles';

  if (!fs.existsSync(articlesDir)) {
    console.error(`❌ Articles directory not found: ${articlesDir}`);
    process.exit(1);
  }

  // Ensure bucket exists
  await ensureBucketExists();

  // Get all PDF files
  const files = fs.readdirSync(articlesDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort()
    .map(f => path.join(articlesDir, f));

  console.log(`
🚀 Article PDF Upload
==========================================
Directory: ${articlesDir}
PDFs found: ${files.length}
Bucket: ${BUCKET_NAME}
==========================================
`);

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    process.stdout.write(`[${i + 1}/${files.length}] `);
    
    const success = await uploadArticlePdf(file);
    if (success) {
      successful++;
    } else {
      failed++;
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`
==========================================
📊 UPLOAD COMPLETE
==========================================
Successful: ${successful}
Failed:     ${failed}
Total:      ${files.length}
==========================================
`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
