/**
 * Generate PDF Thumbnails & Hero Images Script
 *
 * Generates two images from each PDF's first page and uploads to Supabase Storage:
 *   - thumbnail: 800x600 WebP for cards / search results
 *   - hero:      1600px wide WebP for detail page hero sections
 *
 * Updates thumbnail_url and hero_image_url in the documents table.
 *
 * Usage:
 *   npm run generate:thumbnails              (only docs missing images)
 *   npm run generate:thumbnails -- --force   (regenerate all)
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
const HERO_BUCKET = 'hero-images';
const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_HEIGHT = 600;
const HERO_WIDTH = 1600;

async function ensureBucketExists(bucketName: string, fileSizeLimit: number): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === bucketName);

  if (!exists) {
    console.log(`📦 Creating bucket: ${bucketName}`);
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit,
    });
    if (error && !error.message.includes('already exists')) {
      console.error('Bucket creation error:', error);
    }
  }
}

/**
 * Render PDF page 1 into both a thumbnail (fixed-canvas WebP) and a
 * hero image (aspect-preserving WebP) using PyMuPDF.
 */
function renderPdfImages(
  pdfUrl: string,
  thumbPath: string,
  heroPath: string
): boolean {
  const pythonScript = `
import sys
import json
import urllib.request

try:
    import fitz  # PyMuPDF
    from PIL import Image
except ImportError as e:
    print(json.dumps({"error": f"Missing dependencies: {e}. Run: pip3 install pymupdf Pillow"}))
    sys.exit(1)

pdf_url = sys.argv[1]
thumb_path = sys.argv[2]
hero_path = sys.argv[3]
thumb_w = int(sys.argv[4])
thumb_h = int(sys.argv[5])
hero_w = int(sys.argv[6])

try:
    req = urllib.request.Request(pdf_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        pdf_bytes = response.read()

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if len(doc) == 0:
        print(json.dumps({"error": "No pages in PDF"}))
        sys.exit(1)

    page = doc[0]

    # Render at 3x for hero quality, then derive thumbnail from same source
    mat = fitz.Matrix(3, 3)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    src = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    # Hero: aspect-preserving resize to HERO_WIDTH
    hero_height = int(src.height * (hero_w / src.width))
    hero_img = src.resize((hero_w, hero_height), Image.Resampling.LANCZOS)
    hero_img.save(hero_path, 'WEBP', quality=85, method=6)

    # Thumbnail: fit-inside thumb_w x thumb_h on white canvas, centered
    thumb_src = src.copy()
    thumb_src.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    thumb_canvas = Image.new('RGB', (thumb_w, thumb_h), (255, 255, 255))
    x = (thumb_w - thumb_src.width) // 2
    y = (thumb_h - thumb_src.height) // 2
    thumb_canvas.paste(thumb_src, (x, y))
    thumb_canvas.save(thumb_path, 'WEBP', quality=82, method=6)

    doc.close()
    print(json.dumps({"success": True}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

  const tempScript = path.join(process.cwd(), '.temp-thumbnail.py');
  fs.writeFileSync(tempScript, pythonScript);

  try {
    const result = execSync(
      `python3 "${tempScript}" "${pdfUrl}" "${thumbPath}" "${heroPath}" ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT} ${HERO_WIDTH}`,
      { encoding: 'utf-8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    fs.unlinkSync(tempScript);

    const lines = result.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine);
    if (parsed.error) {
      console.log(`⚠️ ${parsed.error.slice(0, 80)}`);
      return false;
    }
    return true;
  } catch (error: any) {
    if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    const errMsg = error.stderr?.toString() || error.message || 'Unknown error';
    console.log(`⚠️ ${errMsg.slice(0, 80)}`);
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

  const tempThumbPath = path.join(process.cwd(), `.temp-thumb-${doc.slug}.webp`);
  const tempHeroPath = path.join(process.cwd(), `.temp-hero-${doc.slug}.webp`);

  try {
    const success = renderPdfImages(doc.pdf_url, tempThumbPath, tempHeroPath);

    if (!success || !fs.existsSync(tempThumbPath) || !fs.existsSync(tempHeroPath)) {
      console.log('❌ Failed to render');
      return false;
    }

    const storagePath = `${doc.slug}.webp`;

    // Upload thumbnail
    const thumbBuffer = fs.readFileSync(tempThumbPath);
    const { error: thumbUploadError } = await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .upload(storagePath, thumbBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (thumbUploadError) {
      console.log(`❌ Thumb upload: ${thumbUploadError.message}`);
      return false;
    }

    // Upload hero
    const heroBuffer = fs.readFileSync(tempHeroPath);
    const { error: heroUploadError } = await supabase.storage
      .from(HERO_BUCKET)
      .upload(storagePath, heroBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (heroUploadError) {
      console.log(`❌ Hero upload: ${heroUploadError.message}`);
      return false;
    }

    const { data: thumbUrl } = supabase.storage
      .from(THUMBNAIL_BUCKET)
      .getPublicUrl(storagePath);
    const { data: heroUrl } = supabase.storage
      .from(HERO_BUCKET)
      .getPublicUrl(storagePath);

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        thumbnail_url: thumbUrl.publicUrl,
        hero_image_url: heroUrl.publicUrl,
      })
      .eq('id', doc.id);

    if (updateError) {
      console.log(`❌ DB update: ${updateError.message}`);
      return false;
    }

    console.log('✅');
    return true;
  } catch (error: any) {
    console.log(`❌ ${error.message}`);
    return false;
  } finally {
    if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
    if (fs.existsSync(tempHeroPath)) fs.unlinkSync(tempHeroPath);
  }
}

async function main() {
  const force = process.argv.includes('--force');

  console.log(`
🖼️  PDF Thumbnail & Hero Image Generator
==========================================
Mode: ${force ? 'force regenerate all' : 'only docs missing images'}
==========================================
`);

  await ensureBucketExists(THUMBNAIL_BUCKET, 10 * 1024 * 1024);
  await ensureBucketExists(HERO_BUCKET, 25 * 1024 * 1024);

  // Get documents with PDF URLs that need images
  let query = supabase
    .from('documents')
    .select('id, slug, pdf_url, title, doc_type')
    .not('pdf_url', 'is', null);

  if (!force) {
    query = query.or('thumbnail_url.is.null,hero_image_url.is.null');
  }

  const { data: docs, error } = await query
    .order('doc_type', { ascending: false }) // Case studies first
    .order('title');

  if (error) {
    console.error('❌ Error fetching documents:', error);
    process.exit(1);
  }

  if (!docs || docs.length === 0) {
    console.log('✅ All documents already have thumbnail and hero images!');
    return;
  }

  console.log(`Found ${docs.length} documents needing images\n`);

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
📊 IMAGE GENERATION COMPLETE
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
