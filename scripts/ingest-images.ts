/**
 * Image Ingestion Script
 * 
 * Scans /content/images folder, matches images to case studies,
 * uploads to Supabase Storage, and updates the database.
 * 
 * Supports multiple images per case study:
 * - thumbnail: Main card image
 * - hero: Large header image
 * - gallery: Supporting images throughout content
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// IMAGE TO CASE STUDY MAPPING
// ============================================

interface ImageMapping {
  keywords: string[];  // Keywords to match in filename
  client: string;      // Client name in database
  titleKeywords?: string[];  // Additional title keywords
}

// Mapping of filename patterns to case studies
const IMAGE_MAPPINGS: ImageMapping[] = [
  // CrowdStrike
  { 
    keywords: ['crowdstrike', 'marketecture', 'falcon', 'fal.con', 'george-kurtz', 'helping crowdstrike'],
    client: 'CrowdStrike'
  },
  // AWS - multiple case studies
  { 
    keywords: ['aws', 'sagemaker'],
    client: 'AWS',
    titleKeywords: ['sagemaker']
  },
  { 
    keywords: ['architecting the executive vision for amazon', 'aws re_ invent', 'helping speakers create memorable moments at aws'],
    client: 'AWS'
  },
  { 
    keywords: ['humanizing technology for the biggest company', 'amazon_web_servi'],
    client: 'AWS'
  },
  { 
    keywords: ['positioning amazon as an empathetic leader'],
    client: 'Amazon re:MARS'
  },
  { 
    keywords: ['re:mars', 'remars', 're-mars', 'amazon-remars', 'work_remars'],
    client: 'Amazon re:MARS'
  },
  // Salesforce - THIS IS THE BIG ONE
  {
    keywords: ['supporting the largest partner ecosystem', 'salesforce-c', 'work_work-card-salesforce'],
    client: 'Salesforce/Slack'
  },
  { 
    keywords: ['slalom'],
    client: 'Slalom/Salesforce'
  },
  // Google - main page with multiple brands
  {
    keywords: ['telling stories about ai that are actually stories about people'],
    client: 'Google'
  },
  // Google products
  { 
    keywords: ['chrome enterprise', 'chrome-enterprise', 'chromeenterprise'],
    client: 'Chrome Enterprise'
  },
  { 
    keywords: ['chromeos', 'chrome os', 'chrome-os'],
    client: 'ChromeOS'
  },
  { 
    keywords: ['creating the most powerful digital ecosystem for work', 'google workspace', 'google-workspace', 'g suite', 'gsuite', 'gws_'],
    client: 'Google Workspace'
  },
  { 
    keywords: ['google messages', 'google-messages'],
    client: 'Google Messages'
  },
  { 
    keywords: ['google for education', 'google-for-education', 'teaching for tomorrow', 'gfe_'],
    client: 'Google for Education'
  },
  { 
    keywords: ['google learning'],
    client: 'Google Learning'
  },
  { 
    keywords: ['google cloud', 'cloud innovators'],
    client: 'Google Cloud'
  },
  { 
    keywords: ['mylink'],
    client: 'MyLink (Google)'
  },
  { 
    keywords: ['android enterprise', 'android-enterprise', 'android_img', 'androidtalks'],
    client: 'Android Enterprise'
  },
  { 
    keywords: ['android'],
    client: 'Android'
  },
  {
    keywords: ['work_work-card-google'],
    client: 'Google'
  },
  // Simons Foundation
  {
    keywords: ['rebranding basic science to engage a global audience', 'launching a first-ever education division', 'simons', 'work_work-card-simons'],
    client: 'Simons Foundation'
  },
  // Others
  { 
    keywords: ['omnicell', 'pharmacy', 'autonomous pharmacy'],
    client: 'Omnicell'
  },
  { 
    keywords: ['salt security', 'salt-security', 'api security'],
    client: 'Salt Security'
  },
  { 
    keywords: ['meta', 'b2b messaging'],
    client: 'Meta'
  },
  { 
    keywords: ['aig', 'investor day'],
    client: 'AIG'
  },
  { 
    keywords: ['adp', 'meeting of the minds'],
    client: 'ADP'
  },
  { 
    keywords: ['twitch', 'brand partnership'],
    client: 'Twitch'
  },
  { 
    keywords: ['renew home', 'sustainable energy'],
    client: 'Renew Home'
  },
  { 
    keywords: ['j.p. morgan', 'jpmorgan', 'jp morgan', 'payments hardware'],
    client: 'J.P. Morgan'
  },
  { 
    keywords: ['chorus', 'alphabet x'],
    client: 'Chorus (Alphabet X)'
  },
  { 
    keywords: ['task mate', 'taskmate'],
    client: 'Task Mate'
  },
  { 
    keywords: ['nvidia', 'ceiba'],
    client: 'AWS/NVIDIA'
  },
  { 
    keywords: ['upshow'],
    client: 'UpShow/ChromeOS'
  },
  // Box - for thought leadership content (if you add it as case study later)
  { 
    keywords: ['establishing thought leadership by publishing share-worthy', 'box-', 'work_work-card-box'],
    client: 'Box'
  },
  // Work page card images
  {
    keywords: ['work_work-card-realtor', 'leading the home buying conversation', 'houselogic'],
    client: '_houselogic' // Not in DB yet
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determine image type based on filename
 * Priority: thumbnail > hero > featured > project > header > gallery
 */
function getImageType(filename: string): 'thumbnail' | 'hero' | 'gallery' | 'logo' {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes('logo')) return 'logo';
  if (lowerFilename.includes('thumb') || lowerFilename.includes('project-thumb')) return 'thumbnail';
  if (lowerFilename.includes('hero') || lowerFilename.includes('header') || lowerFilename.includes('featured')) return 'hero';
  
  // Default to gallery
  return 'gallery';
}

/**
 * Score an image for thumbnail suitability (higher = better)
 */
function getThumbnailScore(filename: string): number {
  const lowerFilename = filename.toLowerCase();
  let score = 0;
  
  // Best: explicit thumbnail
  if (lowerFilename.includes('thumb')) score += 100;
  if (lowerFilename.includes('project-thumb')) score += 50;
  
  // Good: hero/header images
  if (lowerFilename.includes('hero')) score += 80;
  if (lowerFilename.includes('header')) score += 70;
  if (lowerFilename.includes('featured')) score += 60;
  
  // OK: main/cover images
  if (lowerFilename.includes('cover')) score += 50;
  if (lowerFilename.includes('main')) score += 40;
  if (lowerFilename.includes('tile')) score += 35;
  if (lowerFilename.includes('card')) score += 35;
  
  // Penalize: small/icon/mobile images
  if (lowerFilename.includes('icon')) score -= 50;
  if (lowerFilename.includes('logo')) score -= 30;
  if (lowerFilename.includes('mobile')) score -= 20;
  if (lowerFilename.includes('arrow')) score -= 100;
  if (lowerFilename.includes('@2x')) score -= 10;
  
  // Prefer larger images (heuristic based on common naming)
  if (lowerFilename.includes('scaled')) score += 15;
  if (lowerFilename.includes('1080')) score += 10;
  if (lowerFilename.includes('720')) score += 5;
  
  // Base score for being an image
  if (!lowerFilename.includes('logo') && !lowerFilename.includes('icon')) {
    score += 10;
  }
  
  return score;
}

/**
 * Match filename to a case study client
 */
function matchImageToClient(filename: string): string | null {
  const lowerFilename = filename.toLowerCase();
  
  for (const mapping of IMAGE_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (lowerFilename.includes(keyword.toLowerCase())) {
        return mapping.client;
      }
    }
  }
  
  return null;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Check if file is an image (not video)
 */
function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
}

/**
 * Generate a clean storage path
 */
function generateStoragePath(client: string, filename: string): string {
  const cleanClient = client
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const cleanFilename = filename
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-');
  
  return `case-studies/${cleanClient}/${cleanFilename}`;
}

// ============================================
// MAIN INGESTION FUNCTION
// ============================================

async function ingestImages(imagesDir: string) {
  console.log('🖼️  Starting image ingestion...\n');
  
  // Check if directory exists
  if (!fs.existsSync(imagesDir)) {
    console.error(`❌ Directory not found: ${imagesDir}`);
    process.exit(1);
  }
  
  // Get all files
  const files = fs.readdirSync(imagesDir);
  console.log(`📁 Found ${files.length} files in ${imagesDir}\n`);
  
  // Filter to images only
  const imageFiles = files.filter(isImageFile);
  console.log(`🖼️  ${imageFiles.length} image files to process\n`);
  
  // Group images by client
  const imagesByClient: Record<string, string[]> = {};
  const unmatchedImages: string[] = [];
  
  for (const file of imageFiles) {
    const client = matchImageToClient(file);
    if (client && client !== '_articles') {
      if (!imagesByClient[client]) {
        imagesByClient[client] = [];
      }
      imagesByClient[client].push(file);
    } else {
      unmatchedImages.push(file);
    }
  }
  
  console.log('📊 Images grouped by client:');
  for (const [client, images] of Object.entries(imagesByClient)) {
    console.log(`   ${client}: ${images.length} images`);
  }
  console.log(`   ⚠️  Unmatched: ${unmatchedImages.length} images\n`);
  
  // Get all case studies from database
  const { data: caseStudies, error: csError } = await supabase
    .from('documents')
    .select('id, client_name, title, slug')
    .eq('doc_type', 'case_study');
  
  if (csError) {
    console.error('❌ Error fetching case studies:', csError);
    process.exit(1);
  }
  
  console.log(`📚 Found ${caseStudies?.length || 0} case studies in database\n`);
  
  // Use existing storage bucket
  const bucketName = 'case-study-assets';
  
  // Track stats
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;
  const thumbnailsSet: string[] = [];
  
  // Process each client's images
  for (const [clientName, images] of Object.entries(imagesByClient)) {
    // Find matching case study
    const matchingStudies = caseStudies?.filter(cs => 
      cs.client_name?.toLowerCase() === clientName.toLowerCase()
    ) || [];
    
    if (matchingStudies.length === 0) {
      console.log(`⚠️  No case study found for client: ${clientName}`);
      continue;
    }
    
    console.log(`\n📤 Processing ${images.length} images for ${clientName}...`);
    
    // Sort images by thumbnail score (best first)
    const sortedImages = images.sort((a, b) => {
      return getThumbnailScore(b) - getThumbnailScore(a);
    });
    
    let thumbnailSet = false;
    let bestThumbnailUrl: string | null = null;
    let bestThumbnailFile: string | null = null;
    
    for (const imageFile of sortedImages) {
      const imageType = getImageType(imageFile);
      const filePath = path.join(imagesDir, imageFile);
      const storagePath = generateStoragePath(clientName, imageFile);
      
      try {
        // Read file
        const fileBuffer = fs.readFileSync(filePath);
        const mimeType = getMimeType(imageFile);
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: true,
          });
        
        if (uploadError) {
          console.error(`   ❌ Upload failed: ${imageFile}`, uploadError.message);
          errors++;
          continue;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);
        
        // For each matching case study, add to visual_assets
        for (const study of matchingStudies) {
          // Insert into visual_assets
          const { error: insertError } = await supabase
            .from('visual_assets')
            .insert({
              document_id: study.id,
              storage_path: storagePath,
              bucket_name: bucketName,
              asset_type: imageType === 'logo' ? 'logo' : 'photo',
              original_filename: imageFile,
              mime_type: mimeType,
              alt_text: `${clientName} - ${study.title}`,
            });
          
          if (insertError) {
            // Might already exist, skip
            if (!insertError.message.includes('duplicate')) {
              console.error(`   ⚠️  DB insert warning: ${imageFile}`, insertError.message);
            }
          }
          
          // Track the best thumbnail candidate (first image in sorted list)
          if (!bestThumbnailUrl) {
            bestThumbnailUrl = publicUrl;
            bestThumbnailFile = imageFile;
          }
          
          // Set thumbnail on document if this is explicitly a thumbnail/hero
          if (!thumbnailSet && (imageType === 'thumbnail' || imageType === 'hero')) {
            // Update the document with thumbnail URL
            const { error: updateError } = await supabase
              .from('documents')
              .update({ 
                thumbnail_url: publicUrl,
                hero_image_url: publicUrl  // Use same image for hero if not set
              })
              .eq('id', study.id);
            
            if (updateError) {
              console.error(`   ⚠️  Could not set thumbnail for ${study.title}:`, updateError.message);
            } else {
              thumbnailSet = true;
              thumbnailsSet.push(`${clientName}: ${imageFile}`);
            }
          }
        }
        
        uploaded++;
        process.stdout.write(`   ✅ ${imageFile.substring(0, 50)}...\r`);
        
      } catch (err) {
        console.error(`   ❌ Error processing ${imageFile}:`, err);
        errors++;
      }
    }
    
    // If no explicit thumbnail was set, use the best candidate
    if (!thumbnailSet && bestThumbnailUrl && bestThumbnailFile) {
      for (const study of matchingStudies) {
        const { error: updateError } = await supabase
          .from('documents')
          .update({ 
            thumbnail_url: bestThumbnailUrl,
            hero_image_url: bestThumbnailUrl
          })
          .eq('id', study.id)
          .is('thumbnail_url', null);  // Only update if not already set
        
        if (!updateError) {
          thumbnailsSet.push(`${clientName}: ${bestThumbnailFile} (fallback)`);
        }
      }
    }
    
    console.log(`   ✅ Completed ${clientName}`);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 INGESTION SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Uploaded: ${uploaded} images`);
  console.log(`⏭️  Skipped: ${skipped} images`);
  console.log(`❌ Errors: ${errors} images`);
  console.log(`⚠️  Unmatched: ${unmatchedImages.length} images`);
  console.log('\n🖼️  Thumbnails set for:');
  thumbnailsSet.forEach(t => console.log(`   ${t}`));
  
  if (unmatchedImages.length > 0 && unmatchedImages.length <= 20) {
    console.log('\n⚠️  Unmatched images (first 20):');
    unmatchedImages.slice(0, 20).forEach(f => console.log(`   ${f}`));
  }
}

// ============================================
// RUN SCRIPT
// ============================================

const imagesDir = process.argv[2] || './content/images';
ingestImages(imagesDir).then(() => {
  console.log('\n✨ Image ingestion complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
