/**
 * Video Upload Script
 * 
 * Uploads videos to Supabase Storage and links them to case studies.
 * Automatically maps video filenames to case study slugs.
 * 
 * Usage:
 *   npm run upload:videos "./content/videos"
 * 
 * Supports natural filenames like:
 *   "AWS - App Studio Demo.mp4"
 *   "Chrome Enterprise - Beyond Browsing.mp4"
 *   
 * Will auto-detect if it's a hero video (first video per case study)
 * or support video (additional videos).
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

const VIDEO_BUCKET = 'case-study-videos';
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB - Supabase Pro tier

interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  hero_video_url: string | null;
}

interface VideoMatch {
  filename: string;
  filepath: string;
  caseStudy: CaseStudy;
  isHero: boolean;
  supportOrder: number;
}

// Mapping of video filename patterns to case study search terms
const VIDEO_MAPPINGS: Record<string, string[]> = {
  'ADP': ['adp'],
  'AWS': ['aws'],
  'Amazon': ['amazon', 'aws'],
  'Android': ['android'],
  'Chrome': ['chrome'],
  'ChromeOS': ['chromeos'],
  'Chorus': ['chorus'],
  'CrowdStrike': ['crowdstrike'],
  'Facebook': ['meta', 'facebook'],
  'Google': ['google'],
  'Meta': ['meta'],
  'Salesforce': ['salesforce'],
  'Slack': ['slack'],
  'UCLA': ['ucla'],
  'NVIDIA': ['nvidia'],
};

async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === VIDEO_BUCKET);
  
  if (!exists) {
    console.log(`📦 Creating bucket: ${VIDEO_BUCKET}`);
    const { error } = await supabase.storage.createBucket(VIDEO_BUCKET, {
      public: true,
      fileSizeLimit: MAX_VIDEO_SIZE,
    });
    if (error && !error.message.includes('already exists')) {
      // Don't fail - bucket might have different settings
      console.log(`⚠️ Bucket note: ${error.message}`);
    }
  }
}

async function getAllCaseStudies(): Promise<CaseStudy[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, slug, title, client_name, hero_video_url')
    .eq('doc_type', 'case_study');
  
  if (error) {
    console.error('Error fetching case studies:', error);
    return [];
  }
  return data || [];
}

function findMatchingCaseStudy(filename: string, caseStudies: CaseStudy[]): CaseStudy | null {
  const lowerFilename = filename.toLowerCase();
  
  // Extract key terms from filename
  const fileTerms = lowerFilename
    .replace(/\.mp4$/i, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(t => t.length > 2);
  
  // Score each case study
  let bestMatch: CaseStudy | null = null;
  let bestScore = 0;
  
  for (const cs of caseStudies) {
    let score = 0;
    const csTerms = [
      cs.slug,
      cs.title.toLowerCase(),
      cs.client_name?.toLowerCase() || '',
    ].join(' ');
    
    // Check for client name matches
    for (const [key, searchTerms] of Object.entries(VIDEO_MAPPINGS)) {
      if (lowerFilename.includes(key.toLowerCase())) {
        for (const term of searchTerms) {
          if (csTerms.includes(term)) {
            score += 10;
          }
        }
      }
    }
    
    // Check for keyword overlap
    for (const term of fileTerms) {
      if (csTerms.includes(term)) {
        score += 1;
      }
    }
    
    // Bonus for exact client name match
    if (cs.client_name && lowerFilename.includes(cs.client_name.toLowerCase())) {
      score += 15;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cs;
    }
  }
  
  // Only return if we have a reasonable match
  return bestScore >= 5 ? bestMatch : null;
}

async function uploadVideo(match: VideoMatch): Promise<boolean> {
  const shortName = match.filename.length > 45 
    ? match.filename.slice(0, 42) + '...' 
    : match.filename;
  
  const videoType = match.isHero ? '🎬 Hero' : `📹 Support #${match.supportOrder}`;
  process.stdout.write(`${videoType} ${shortName} → ${match.caseStudy.client_name || match.caseStudy.slug.slice(0, 15)} `);

  try {
    // Check file size
    const stats = fs.statSync(match.filepath);
    const sizeMB = stats.size / 1024 / 1024;
    
    if (stats.size > MAX_VIDEO_SIZE) {
      console.log(`⚠️ Too large (${sizeMB.toFixed(1)}MB > 500MB)`);
      return false;
    }

    // Read video file
    const videoBuffer = fs.readFileSync(match.filepath);
    const safeFilename = match.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${match.caseStudy.slug}/${safeFilename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(storagePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      console.log(`❌ ${uploadError.message.slice(0, 40)}`);
      return false;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(VIDEO_BUCKET)
      .getPublicUrl(storagePath);

    const videoUrl = urlData.publicUrl;

    // Update database based on video type
    if (match.isHero) {
      const { error: updateError } = await supabase
        .from('documents')
        .update({ hero_video_url: videoUrl })
        .eq('id', match.caseStudy.id);

      if (updateError) {
        console.log(`❌ DB: ${updateError.message.slice(0, 30)}`);
        return false;
      }
      console.log(`✅`);
    } else {
      // Add to support_videos table
      const { error: insertError } = await supabase
        .from('support_videos')
        .insert({
          document_id: match.caseStudy.id,
          video_url: videoUrl,
          storage_path: storagePath,
          title: match.filename.replace(/\.mp4$/i, ''),
          display_order: match.supportOrder,
        });

      if (insertError && !insertError.message.includes('duplicate')) {
        console.log(`❌ DB: ${insertError.message.slice(0, 30)}`);
        return false;
      }
      console.log(`✅`);
    }

    return true;

  } catch (error: any) {
    console.log(`❌ ${error.message?.slice(0, 40) || 'Error'}`);
    return false;
  }
}

async function main() {
  const videosDir = process.argv[2] || './content/videos';

  if (!fs.existsSync(videosDir)) {
    console.error(`❌ Videos directory not found: ${videosDir}`);
    process.exit(1);
  }

  // Ensure bucket exists
  await ensureBucketExists();

  // Get all case studies
  const caseStudies = await getAllCaseStudies();
  if (caseStudies.length === 0) {
    console.error('❌ No case studies found in database');
    process.exit(1);
  }

  // Get all video files
  const files = fs.readdirSync(videosDir)
    .filter(f => f.toLowerCase().endsWith('.mp4'))
    .sort();

  if (files.length === 0) {
    console.log('❌ No MP4 files found in directory');
    process.exit(1);
  }

  console.log(`
🎬 Smart Video Upload
==========================================
Directory: ${videosDir}
Videos found: ${files.length}
Case studies in DB: ${caseStudies.length}
Max file size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB
==========================================
`);

  // Match videos to case studies
  const matches: VideoMatch[] = [];
  const unmatched: string[] = [];
  const tooLarge: string[] = [];
  
  // Track videos per case study for hero vs support designation
  const videosPerCaseStudy = new Map<string, number>();

  for (const file of files) {
    const filepath = path.join(videosDir, file);
    const stats = fs.statSync(filepath);
    
    if (stats.size > MAX_VIDEO_SIZE) {
      tooLarge.push(`${file} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      continue;
    }
    
    const caseStudy = findMatchingCaseStudy(file, caseStudies);
    
    if (caseStudy) {
      const count = videosPerCaseStudy.get(caseStudy.id) || 0;
      const isHero = count === 0 && !caseStudy.hero_video_url;
      
      matches.push({
        filename: file,
        filepath,
        caseStudy,
        isHero,
        supportOrder: isHero ? 0 : count + 1,
      });
      
      videosPerCaseStudy.set(caseStudy.id, count + 1);
    } else {
      unmatched.push(file);
    }
  }

  // Report matches
  console.log(`Matched: ${matches.length} videos`);
  console.log(`Unmatched: ${unmatched.length} videos`);
  console.log(`Too large: ${tooLarge.length} videos\n`);

  if (unmatched.length > 0) {
    console.log('⚠️ Unmatched videos (no case study found):');
    unmatched.slice(0, 10).forEach(f => console.log(`   - ${f}`));
    if (unmatched.length > 10) console.log(`   ... and ${unmatched.length - 10} more`);
    console.log('');
  }

  if (tooLarge.length > 0) {
    console.log('⚠️ Videos too large (need compression):');
    tooLarge.forEach(f => console.log(`   - ${f}`));
    console.log('');
  }

  if (matches.length === 0) {
    console.log('❌ No videos to upload');
    process.exit(1);
  }

  console.log('--- Starting uploads ---\n');

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < matches.length; i++) {
    process.stdout.write(`[${i + 1}/${matches.length}] `);
    
    const success = await uploadVideo(matches[i]);
    if (success) {
      successful++;
    } else {
      failed++;
    }

    // Delay between uploads
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`
==========================================
📊 UPLOAD COMPLETE
==========================================
Successful: ${successful}
Failed:     ${failed}
Skipped:    ${unmatched.length + tooLarge.length}
==========================================
`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
