/**
 * Generate PDF Thumbnails Script
 * 
 * Generates thumbnail images from PDF first pages and uploads to Supabase Storage.
 * Updates the thumbnail_url in the documents table.
 * 
 * Usage:
 *   npm run generate:thumbnails
 * 
 * Prerequisites:
 *   pip3 install pymupdf Pillow
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
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const THUMBNAIL_BUCKET = 'thumbnails';
const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_HEIGHT = 600;

async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === THUMBNAIL_BUCKET);
  
  if (!exists) {
    console.log(`📦 Creating bucket: ${THUMBNAIL_BUCKET}`);
    const { error } = await supabase.storage.createBucket(THUMBNAIL_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    });
    if (error && !error.message.includes('already exists')) {
      console.error('Bucket creation error:', error);
    }
  }
}

/**
 * Generate thumbnail from PDF using PyMuPDF (no poppler required)
 */
function generateThumbnailFromPdf(pdfUrl: string, outputPath: string): boolean {
  const pythonScript = `
import sys
import json
import urllib.request
import io

try:
    import fitz  # PyMuPDF
    from PIL import Image
except ImportError as e:
    print(json.dumps({"error": f"Missing dependencies: {e}. Run: pip3 install pymupdf Pillow"}))
    sys.exit(1)

pdf_url = sys.argv[1]
output_path = sys.argv[2]
width = int(sys.argv[3])
height = int(sys.argv[4])

try:
    # Download PDF
    req = urllib.request.Request(pdf_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        pdf_bytes = response.read()
    
    # Open PDF with PyMuPDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    if len(doc) == 0:
        print(json.dumps({"error": "No pages in PDF"}))
        sys.exit(1)
    
    # Get first page
    page = doc[0]
    
    # Render page to image (2x for better quality)
    mat = fitz.Matrix(2, 2)
    pix = page.get_pixmap(matrix=mat)
    
    # Convert to PIL Image
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    # Resize to thumbnail maintaining aspect ratio
    img.thumbnail((width, height), Image.Resampling.LANCZOS)
    
    # Create new image with white background
    thumb = Image.new('RGB', (width, height), (255, 255, 255))
    
    # Paste the resized image centered
    x = (width - img.width) // 2
    y = (height - img.height) // 2
    thumb.paste(img, (x, y))
    
    # Save as JPEG
    thumb.save(output_path, 'JPEG', quality=85)
    
    doc.close()
    print(json.dumps({"success": True, "path": output_path}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

  const tempScript = path.join(process.cwd(), '.temp-thumbnail.py');
  fs.writeFileSync(tempScript, pythonScript);

  try {
    const result = execSync(
      `python3 "${tempScript}" "${pdfUrl}" "${outputPath}" ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}`,
      { encoding: 'utf-8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    fs.unlinkSync(tempScript);
    
    const lines = result.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine);
    if (parsed.error) {
      console.log(`⚠️ ${parsed.error.slice(0, 50)}`);
      return false;
    }
    return true;
  } catch (error: any) {
    if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    const errMsg = error.stderr?.toString() || error.message || 'Unknown error';
    console.log(`⚠️ ${errMsg.slice(0, 60)}`);
    return false;
  }
}

async function processDocument(doc: { id: string; slug: string; pdf_url: string; title: string }): Promise<boolean> {
  const shortTitle = doc.title.length > 45 ? doc.title.slice(0, 42) + '...' : doc.title;
  process.stdout.write(`📄 ${shortTitle} `);

  if (!doc.pdf_url) {
    console.log('⚠️ No PDF URL');
    return false;
  }

  try {
    // Create temp file for thumbnail
    const tempThumbPath = path.join(process.cwd(), `.temp-thumb-${doc.slug}.jpg`);
    
    // Generate thumbnail
    const success = generateThumbnailFromPdf(doc.pdf_url, tempThumbPath);
    
    if (!success || !fs.existsSync(tempThumbPath)) {
      console.log('❌ Failed to generate');
      return false;
    }

    // Upload to Supabase Storage
    const thumbBuffer = fs.readFileSync(tempThumbPath);
    const storagePath = `${doc.slug}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .upload(storagePath, thumbBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    // Clean up temp file
    fs.unlinkSync(tempThumbPath);

    if (uploadError) {
      console.log(`❌ Upload error: ${uploadError.message}`);
      return false;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(THUMBNAIL_BUCKET)
      .getPublicUrl(storagePath);

    // Update document
    const { error: updateError } = await supabase
      .from('documents')
      .update({ thumbnail_url: urlData.publicUrl })
      .eq('id', doc.id);

    if (updateError) {
      console.log(`❌ DB update error: ${updateError.message}`);
      return false;
    }

    console.log('✅');
    return true;

  } catch (error: any) {
    console.log(`❌ ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`
🖼️  PDF Thumbnail Generator
==========================================
`);

  // Ensure bucket exists
  await ensureBucketExists();

  // Get all documents with PDF URLs but no thumbnail
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, slug, pdf_url, title, doc_type')
    .not('pdf_url', 'is', null)
    .is('thumbnail_url', null)
    .order('doc_type', { ascending: false }) // Case studies first
    .order('title');

  if (error) {
    console.error('❌ Error fetching documents:', error);
    process.exit(1);
  }

  if (!docs || docs.length === 0) {
    console.log('✅ All documents already have thumbnails!');
    return;
  }

  console.log(`Found ${docs.length} documents needing thumbnails\n`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    process.stdout.write(`[${i + 1}/${docs.length}] `);
    
    const success = await processDocument(docs[i]);
    if (success) {
      successful++;
    } else {
      failed++;
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`
==========================================
📊 THUMBNAIL GENERATION COMPLETE
==========================================
Successful: ${successful}
Failed:     ${failed}
Total:      ${docs.length}
==========================================
`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
