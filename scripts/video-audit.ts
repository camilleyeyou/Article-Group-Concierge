/**
 * Video audit (Phase 2, plan 02-05).
 *
 *   npx tsx scripts/video-audit.ts --extract   # frames + audio + transcripts, read-only
 *   npx tsx scripts/video-audit.ts --apply --yes   # added after user approval (Task 4)
 *
 * --extract never writes to the DB or to storage.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const FFMPEG = '/opt/local/bin/ffmpeg';
const FFPROBE = '/opt/local/bin/ffprobe';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CACHE = path.resolve('data/.cache/video-audit');
const FILES = path.join(CACHE, 'files');
const VENV_PY = path.resolve('data/.cache/whisper-venv/bin/python');
const VIDEO_DIR = path.resolve('content/videos');

const safeName = (f: string) => f.replace(/[^a-zA-Z0-9.-]/g, '_');
const idOf = (f: string) => safeName(f).replace(/\.mp4$/i, '');

interface Entry {
  id: string;
  role: 'hero' | 'support' | 'vimeo' | 'unlinked';
  doc_slug: string | null;
  doc_title: string | null;
  url: string | null;
  support_video_id?: string;
  local_path: string | null;
  duration_s: number | null;
  frames: string[];
  transcript_path: string | null;
  transcript_note?: string;
  oembed?: unknown;
}

async function extract() {
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env vars');
  const sb = createClient(supabaseUrl, supabaseKey);
  fs.mkdirSync(FILES, { recursive: true });

  const { data: docs, error } = await sb
    .from('documents')
    .select('id, slug, title, hero_video_url, vimeo_url')
    .eq('doc_type', 'case_study');
  if (error) throw error;
  const { data: supports, error: e2 } = await sb
    .from('support_videos')
    .select('id, document_id, video_url, title');
  if (e2) throw e2;

  const byId = new Map(docs!.map((d) => [d.id, d]));
  const disk = fs.existsSync(VIDEO_DIR) ? fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.mp4')) : [];
  const diskBySafe = new Map(disk.map((f) => [safeName(f), f]));

  const entries: Entry[] = [];
  const referenced = new Set<string>();
  const base = (u: string) => decodeURIComponent(u.split('/').pop()!);

  for (const d of docs!) {
    if (d.hero_video_url) {
      referenced.add(base(d.hero_video_url));
      entries.push({ id: idOf(base(d.hero_video_url)), role: 'hero', doc_slug: d.slug, doc_title: d.title, url: d.hero_video_url, local_path: null, duration_s: null, frames: [], transcript_path: null });
    }
    // vimeo_url mirrors hero_video_url for most rows (storage URL); only audit real vimeo.com links
    if (d.vimeo_url && /vimeo\.com/.test(d.vimeo_url)) {
      let oembed: unknown = null;
      try {
        const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(d.vimeo_url)}`);
        if (r.ok) {
          const j = await r.json();
          oembed = { title: j.title, author_name: j.author_name, duration: j.duration };
        } else oembed = { error: `HTTP ${r.status}` };
      } catch (e) {
        oembed = { error: String(e) };
      }
      entries.push({ id: `vimeo-${d.slug}`, role: 'vimeo', doc_slug: d.slug, doc_title: d.title, url: d.vimeo_url, local_path: null, duration_s: null, frames: [], transcript_path: null, oembed });
    }
  }
  for (const s of supports!) {
    const d = byId.get(s.document_id);
    referenced.add(base(s.video_url));
    entries.push({ id: idOf(base(s.video_url)), role: 'support', doc_slug: d?.slug ?? null, doc_title: d?.title ?? null, url: s.video_url, support_video_id: s.id, local_path: null, duration_s: null, frames: [], transcript_path: null });
  }
  for (const [safe, orig] of diskBySafe) {
    if (!referenced.has(safe)) {
      entries.push({ id: idOf(orig), role: 'unlinked', doc_slug: null, doc_title: null, url: null, local_path: path.join(VIDEO_DIR, orig), duration_s: null, frames: [], transcript_path: null });
    }
  }

  const haveWhisper = fs.existsSync(VENV_PY);
  for (const e of entries) {
    if (e.role === 'vimeo') continue;
    // locate or download file
    if (!e.local_path) {
      const safe = e.url ? base(e.url) : '';
      const orig = diskBySafe.get(safe);
      if (orig) e.local_path = path.join(VIDEO_DIR, orig);
      else {
        const dest = path.join(FILES, safe);
        if (!fs.existsSync(dest)) {
          const r = await fetch(e.url!);
          if (!r.ok) throw new Error(`download ${e.url}: ${r.status}`);
          fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
        }
        e.local_path = dest;
      }
    }
    const out = path.join(CACHE, e.id);
    fs.mkdirSync(out, { recursive: true });
    const dur = parseFloat(
      execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', e.local_path]).toString().trim(),
    );
    e.duration_s = Math.round(dur * 10) / 10;
    [0.1, 0.35, 0.6, 0.85].forEach((p, i) => {
      const f = path.join(out, `frame-${i + 1}.jpg`);
      if (!fs.existsSync(f)) {
        execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', String(dur * p), '-i', e.local_path!, '-frames:v', '1', '-vf', 'scale=640:-2', f]);
      }
      e.frames.push(f);
    });
    const wav = path.join(out, 'audio.wav');
    if (!fs.existsSync(wav)) {
      try {
        execFileSync(FFMPEG, ['-y', '-v', 'error', '-t', '180', '-i', e.local_path, '-vn', '-ac', '1', '-ar', '16000', wav]);
      } catch {
        e.transcript_note = 'no audio stream';
      }
    }
    const tx = path.join(out, 'transcript.txt');
    if (fs.existsSync(wav) && haveWhisper) {
      if (!fs.existsSync(tx)) {
        execFileSync(VENV_PY, [path.resolve('scripts/transcribe.py'), wav, tx]);
      }
      e.transcript_path = tx;
    } else if (!haveWhisper) {
      e.transcript_note = 'transcription skipped: faster-whisper venv not available';
    }
    console.log(`${e.role.padEnd(9)} ${e.id} ${e.duration_s}s`);
  }

  fs.writeFileSync(path.join(CACHE, 'manifest.json'), JSON.stringify(entries, null, 2));
  console.log(`manifest: ${entries.length} entries`);
}


interface Action {
  n: number;
  action: string;
  final_action?: string;
  doc_slug: string | null;
  role: string;
  from_url: string | null;
  to_doc_slug: string | null;
  support_video_id: string | null;
  to_local_file: string | null;
  link_as?: 'hero' | 'support';
  decision: string;
}

/** Applies approved actions from data/video-fixes.json. Idempotent; never removes/overwrites storage objects. */
async function apply(dryRun: boolean) {
  const sb = createClient(supabaseUrl, supabaseKey);
  const fixes = JSON.parse(fs.readFileSync('data/video-fixes.json', 'utf8')) as { actions: Action[] };
  const open = fixes.actions.filter((a) => a.decision === 'pending');
  if (open.length) throw new Error(`${open.length} actions still pending; refusing to apply`);

  // 1. Backup (never overwrite an existing backup: it holds the true pre-change state)
  const backupPath = path.resolve('data/video-backup.json');
  if (!fs.existsSync(backupPath)) {
    const { data: docs, error } = await sb.from('documents').select('id, slug, hero_video_url, vimeo_url').eq('doc_type', 'case_study');
    if (error) throw error;
    const { data: sup, error: e2 } = await sb.from('support_videos').select('*');
    if (e2) throw e2;
    fs.writeFileSync(backupPath, JSON.stringify({ taken_at: new Date().toISOString(), documents: docs, support_videos: sup }, null, 2));
  }
  if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) throw new Error('backup missing; abort');

  const docId = async (slug: string) => {
    const { data, error } = await sb.from('documents').select('id, hero_video_url, vimeo_url').eq('slug', slug).single();
    if (error) throw error;
    return data;
  };
  const head200 = async (u: string) => (await fetch(u, { method: 'HEAD' })).status === 200;
  const log = (m: string) => console.log(`${dryRun ? '[dry-run] ' : ''}${m}`);

  const addSupport = async (docIdVal: string, url: string, title: string) => {
    const { data: ex } = await sb.from('support_videos').select('id, display_order, video_url').eq('document_id', docIdVal);
    if (ex?.some((r: any) => r.video_url === url)) return log(`  support already present: ${title}`);
    const next = Math.max(0, ...(ex ?? []).map((r: any) => r.display_order ?? 0)) + 1;
    if (!dryRun) {
      const { error } = await sb.from('support_videos').insert({ document_id: docIdVal, video_url: url, title, display_order: next });
      if (error) throw error;
    }
    log(`  insert support_video ${title}`);
  };
  const clearHero = async (slug: string, url: string | null) => {
    const d = await docId(slug);
    if (d.hero_video_url !== url) return log(`  hero already changed on ${slug}, skip`);
    const patch: Record<string, null> = { hero_video_url: null };
    if (d.vimeo_url === url) patch.vimeo_url = null;
    if (!dryRun) {
      const { error } = await sb.from('documents').update(patch).eq('id', d.id);
      if (error) throw error;
    }
    log(`  cleared hero on ${slug}`);
  };
  const removeSupport = async (id: string | null) => {
    if (!id) return;
    if (!dryRun) {
      const { error } = await sb.from('support_videos').delete().eq('id', id);
      if (error) throw error;
    }
    log(`  removed support_videos row ${id}`);
  };

  for (const a of fixes.actions) {
    if (a.decision === 'rejected') continue;
    const act = a.final_action ?? a.action;
    if (act === 'keep' || act === 'leave_unlinked') continue;
    log(`#${a.n} ${act} ${a.doc_slug}`);
    const title = (a.from_url ?? a.to_local_file ?? '').split('/').pop()!.replace(/\.mp4$/i, '');
    if (act === 'unlink') {
      if (a.role === 'vimeo') {
        const d = await docId(a.doc_slug!);
        if (d.vimeo_url === a.from_url && !dryRun) await sb.from('documents').update({ vimeo_url: null }).eq('id', d.id);
        log(`  cleared vimeo_url on ${a.doc_slug}`);
      } else await clearHero(a.doc_slug!, a.from_url);
    } else if (act === 'remove_support') {
      await removeSupport(a.support_video_id);
    } else if (act === 'relink') {
      if (!a.to_doc_slug || !a.from_url) throw new Error(`#${a.n}: relink needs to_doc_slug/from_url`);
      if (!(await head200(a.from_url))) throw new Error(`#${a.n}: ${a.from_url} not HTTP 200`);
      const t = await docId(a.to_doc_slug);
      if (a.role === 'support') {
        await addSupport(t.id, a.from_url, title);
        await removeSupport(a.support_video_id);
      } else {
        if (!t.hero_video_url) {
          if (!dryRun) {
            const { error } = await sb.from('documents').update({ hero_video_url: a.from_url }).eq('id', t.id);
            if (error) throw error;
          }
          log(`  set hero on ${a.to_doc_slug}`);
        } else if (t.hero_video_url !== a.from_url) await addSupport(t.id, a.from_url, title);
        await clearHero(a.doc_slug!, a.from_url);
      }
    } else if (act === 'link_new') {
      const t = await docId(a.to_doc_slug!);
      const file = a.to_local_file!;
      const safe = safeName(path.basename(file));
      const storagePath = `${a.to_doc_slug}/${safe}`;
      const url = `${supabaseUrl}/storage/v1/object/public/case-study-videos/${storagePath}`;
      if (!(await head200(url))) {
        if (!dryRun) {
          const { error } = await sb.storage.from('case-study-videos').upload(storagePath, fs.readFileSync(file), { contentType: 'video/mp4', upsert: false });
          if (error) throw error;
        }
        log(`  uploaded ${storagePath}`);
      } else log(`  storage object exists, reuse ${storagePath}`);
      if (t.hero_video_url === url) log(`  hero already set on ${a.to_doc_slug}, skip`);
      else if (a.link_as === 'support' || t.hero_video_url) await addSupport(t.id, url, path.basename(file, '.mp4'));
      else {
        if (!dryRun) {
          const { error } = await sb.from('documents').update({ hero_video_url: url }).eq('id', t.id);
          if (error) throw error;
        }
        log(`  set hero on ${a.to_doc_slug}`);
      }
    } else throw new Error(`#${a.n}: unknown action ${act}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--extract')) return extract();
  if (args.includes('--apply')) {
    if (args.includes('--dry-run')) return apply(true);
    if (!args.includes('--yes')) {
      console.error('refusing: pass --yes (or --dry-run)');
      process.exit(1);
    }
    return apply(false);
  }
  console.error('usage: --extract | --apply --yes');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
