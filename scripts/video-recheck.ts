/**
 * Video re-check (Phase 6, plan 06-08). Read-only: select-only DB access, HEAD/GET-range and
 * oEmbed fetches. Writes only 06-STATIC-CHECKS.md (## Videos) and 06-STATIC-CHECKS.json.
 *
 *   npx tsx scripts/video-recheck.ts
 *
 * Expected mapping = approved rows of 02-VIDEO-AUDIT.md (keep / relink / link_new), plus the
 * 06-05 decision (Google for Education trailer MP4 also as documents.vimeo_url).
 * Exit 1 if mismatched_videos > 0.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';
import { isPlayableVideoUrl, vimeoIdOf } from '../src/lib/concierge-config';
import { posterUrlFor, isDirectVideoUrl } from '../src/lib/video-poster';

const AUDIT = path.resolve('.planning/phases/02-content-and-data/02-VIDEO-AUDIT.md');
const OUT_MD = path.resolve('.planning/phases/06-proof/06-STATIC-CHECKS.md');
const OUT_JSON = path.resolve('.planning/phases/06-proof/06-STATIC-CHECKS.json');
const GFE = 'google-for-education-a-world-of-perspectives-on-the-future-of-learning';

const safe = (s: string) => s.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
const baseOf = (u: string) => {
  try { return safe(decodeURIComponent(u.split(/[?#]/)[0].split('/').pop()!)); } catch { return safe(u.split('/').pop()!); }
};
/** Identity of a video: vimeo id, or normalised file name. */
const keyOf = (u: string) => { const id = vimeoIdOf(u); return id ? `vimeo:${id}` : `file:${baseOf(u)}`; };

interface Expected { slug: string; key: string; note: string }

function parseApproved(): Expected[] {
  const out: Expected[] = [];
  for (const line of fs.readFileSync(AUDIT, 'utf8').split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const c = line.split('|').slice(1, -1).map((s) => s.trim());
    if (c.length < 11) continue;
    const [num, slug, , file, , , , , , action, decision] = c;
    if (!/^approved/i.test(decision)) continue;
    const m = action.match(/^(keep|relink|link_new|unlink|remove_support|leave_unlinked)(?:\s*->\s*(\S+))?/);
    if (!m) continue;
    const [, act, target] = m;
    if (act === 'keep') out.push({ slug, key: keyOf(file), note: `#${num} keep` });
    else if (act === 'relink' || act === 'link_new') out.push({ slug: target, key: keyOf(file), note: `#${num} ${act}` });
  }
  return out;
}

async function reach(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    if (vimeoIdOf(url)) {
      const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      return { ok: r.ok, detail: `oembed ${r.status}` };
    }
    let r = await fetch(url, { method: 'HEAD' });
    if (!r.ok) r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    const ct = r.headers.get('content-type') ?? '';
    return { ok: (r.status === 200 || r.status === 206) && ct.startsWith('video/'), detail: `${r.status} ${ct}` };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 60) };
  }
}
async function posterOk(url: string): Promise<string> {
  const p = posterUrlFor(url);
  if (!p) return 'n/a';
  try {
    const r = await fetch(p, { method: 'HEAD' });
    return r.status === 200 ? 'yes' : `no (${r.status})`;
  } catch { return 'no (error)'; }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: docs, error } = await sb
    .from('documents').select('id, slug, hero_video_url, vimeo_url').eq('doc_type', 'case_study');
  if (error) throw error;
  const { data: sup, error: e2 } = await sb.from('support_videos').select('document_id, video_url');
  if (e2) throw e2;
  const slugById = new Map(docs!.map((d) => [d.id, d.slug]));

  const expected = parseApproved();
  // 06-05 decision: GFE trailer MP4 is now documents.vimeo_url; the old dead Vimeo link is retired.
  const gfeTrailer = expected.find((e) => e.slug === GFE && e.key.startsWith('file:') && /trailer/i.test(e.key));
  const expSet = new Set(expected.map((e) => `${e.slug}|${e.key}`));
  const dropOld = `${GFE}|vimeo:877614456`;
  expSet.delete(dropOld);

  const items: { slug: string; role: string; url: string }[] = [];
  for (const d of docs!) {
    if (d.hero_video_url) items.push({ slug: d.slug, role: 'hero', url: d.hero_video_url });
    if (d.vimeo_url && d.vimeo_url !== d.hero_video_url) items.push({ slug: d.slug, role: 'vimeo_url', url: d.vimeo_url });
  }
  for (const s of sup!) items.push({ slug: slugById.get(s.document_id) ?? '(unknown)', role: 'support', url: s.video_url });

  const rows: Record<string, unknown>[] = [];
  let mismatched = 0;
  const seen = new Set<string>();
  for (const it of items) {
    const playable = isPlayableVideoUrl(it.url);
    const k = `${it.slug}|${keyOf(it.url)}`;
    seen.add(k);
    const approved = expSet.has(k) || (it.slug === GFE && gfeTrailer && keyOf(it.url) === gfeTrailer.key);
    let reachable = 'skipped (hidden)', poster = 'n/a', rd = '';
    if (playable) {
      const r = await reach(it.url); rd = r.detail; reachable = r.ok ? `yes (${r.detail})` : `NO (${r.detail})`;
      poster = isDirectVideoUrl(it.url) ? await posterOk(it.url) : 'n/a';
      await sleep(150);
    }
    let verdict: string;
    if (!playable) verdict = 'hidden';
    else if (!approved) verdict = 'MISMATCH: not in approved table for this study';
    else if (!reachable.startsWith('yes')) verdict = 'MISMATCH: shown but unreachable';
    else verdict = poster.startsWith('no') ? 'ok (poster missing)' : 'ok';
    if (verdict.startsWith('MISMATCH')) mismatched++;
    rows.push({ slug: it.slug, role: it.role, url: it.url, playable_in_app: playable, reachable, poster, approved_match: !!approved, verdict });
  }
  const missingExpected = [...expSet].filter((k) => !seen.has(k));

  const trunc = (u: string) => (u.length > 70 ? '...' + u.slice(-67) : u);
  const md = ['## Videos', '',
    `Checked ${new Date().toISOString()} against the live DB (select only). Approved source: 02-VIDEO-AUDIT.md + quick 261124-0q7 hides + 06-05 decision (GFE trailer MP4).`, '',
    '| Study | Role | URL | playable_in_app | reachable | poster | approved match | verdict |', '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.slug} | ${r.role} | ${trunc(String(r.url))} | ${r.playable_in_app} | ${r.reachable} | ${r.poster} | ${r.approved_match} | ${r.verdict} |`),
    '', `mismatched_videos = ${mismatched}`, '',
    missingExpected.length ? `Approved but not present in DB (informational, not counted): ${missingExpected.join('; ')}` : 'Approved but not present in DB: none.', ''].join('\n');

  let existing = fs.existsSync(OUT_MD) ? fs.readFileSync(OUT_MD, 'utf8') : '# 06-08 Static checks\n\n';
  const re = /## Videos[\s\S]*?(?=\n## |$)/;
  existing = re.test(existing) ? existing.replace(re, md) : existing.trimEnd() + '\n\n' + md;
  fs.writeFileSync(OUT_MD, existing);

  const prev = fs.existsSync(OUT_JSON) ? JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')) : {};
  fs.writeFileSync(OUT_JSON, JSON.stringify({ ...prev, checked_at: new Date().toISOString(), mismatched_videos: mismatched, video_rows: rows }, null, 2) + '\n');

  console.table(rows.map((r) => ({ slug: String(r.slug).slice(0, 38), role: r.role, playable: r.playable_in_app, reach: String(r.reachable).slice(0, 18), poster: r.poster, verdict: r.verdict })));
  console.log('mismatched_videos', mismatched, '| approved-but-absent', missingExpected);
  if (mismatched > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
