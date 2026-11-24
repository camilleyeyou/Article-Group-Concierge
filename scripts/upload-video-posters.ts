/**
 * One-off, additive poster upload.
 *
 * Usage: npx tsx scripts/upload-video-posters.ts <list.txt> <posterDir>
 *   list.txt: "slug url" per line (url = public Supabase .mp4 URL)
 *   posterDir: contains final_<slug>.jpg
 *
 * Uploads each poster beside its video as <name>.poster.jpg. Never overwrites:
 * upsert is false, existing objects are skipped. Never logs credentials.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { posterUrlFor } from '../src/lib/video-poster';

const BUCKET = 'case-study-videos';
const MARKER = `/storage/v1/object/public/${BUCKET}/`;

async function head(url: string) {
  const r = await fetch(url, { method: 'HEAD' });
  return { status: r.status, type: r.headers.get('content-type') ?? '' };
}

async function main() {
  const [listFile, posterDir] = process.argv.slice(2);
  if (!listFile || !posterDir) {
    console.error('Usage: upload-video-posters.ts <list.txt> <posterDir>');
    process.exit(2);
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, key);
  const lines = fs.readFileSync(listFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  let failed = 0;

  for (const line of lines) {
    const [slug, url] = line.split(/\s+/);
    const posterUrl = posterUrlFor(url);
    if (!posterUrl || !posterUrl.includes(MARKER)) {
      console.error(`${slug}: cannot derive poster path`);
      failed++;
      continue;
    }
    const objectPath = decodeURIComponent(posterUrl.split(MARKER)[1]);
    const existing = await head(posterUrl);
    if (existing.status === 200) {
      console.log(`${slug}: exists, skipped  ${posterUrl} ${existing.status} ${existing.type}`);
      continue;
    }
    const buffer = fs.readFileSync(path.join(posterDir, `final_${slug}.jpg`));
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
      cacheControl: '31536000',
    });
    if (error && !/duplicate|already exists|409/i.test(error.message)) {
      console.error(`${slug}: upload failed: ${error.message}`);
      failed++;
      continue;
    }
    const after = await head(posterUrl);
    const ok = after.status === 200 && after.type.startsWith('image/jpeg');
    console.log(`${slug}: ${error ? 'duplicate, skipped' : 'uploaded'}  ${posterUrl} ${after.status} ${after.type}`);
    if (!ok) failed++;
  }
  if (failed) process.exit(1);
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : 'failed');
  process.exit(1);
});
