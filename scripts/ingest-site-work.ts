/**
 * Ingest approved articlegroup.com/work items as multi-chunk case studies (Phase 2, DATA-02).
 *
 * Usage:
 *   npx tsx scripts/ingest-site-work.ts --dry-run   (plan only, no embeddings, no writes)
 *   npx tsx scripts/ingest-site-work.ts --yes       (insert; idempotent)
 *   npx tsx scripts/ingest-site-work.ts --verify    (read-only checks, embeds 1 query per slug)
 *
 * Reads data/site-work.json. Ingests items with decision ingest | ingest-as-article.
 * Uses item.slug_override when present. Chunk content is the stored `text` verbatim
 * (never `preview`). Never updates existing rows. PDF text is not appended (no PDF
 * approval is recorded in site-work.json).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { embeddingConfig } from '../src/lib/llm-config';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data', 'site-work.json');

interface SiteItem {
  url: string;
  site_title: string;
  client: string;
  text: string;
  vimeo_urls: string[];
  decision: string;
  use_vimeo?: boolean;
  slug_override?: string;
}

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const YES = argv.includes('--yes');
const VERIFY = argv.includes('--verify');

if (!DRY && !YES && !VERIFY) {
  console.error('Refusing to write without --yes. Use --dry-run to preview or --verify to check.');
  process.exit(1);
}

const embedding = embeddingConfig();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey || (!DRY && !embedding.apiKey)) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and an embeddings key. Check .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ---------- helpers (same behaviour as populate-case-studies.ts / embed-articles.ts) ----------

function createSlug(client: string, title: string): string {
  return `${client} ${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
    .replace(/-$/, '');
}

async function embed(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${embedding.baseURL}/embeddings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${embedding.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: embedding.model, input: text.slice(0, 8000) }),
      });
      if (!res.ok) throw new Error(`Embedding API error: ${res.status} - ${await res.text()}`);
      const data = await res.json();
      return data.data[0].embedding;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Failed after retries');
}

function chunkContent(content: string, maxChunkSize = 1500): string[] {
  const paragraphs = content.split('\n\n');
  const chunks: string[] = [];
  let cur = '';
  for (const para of paragraphs) {
    if (cur.length + para.length > maxChunkSize && cur.length > 0) {
      chunks.push(cur.trim());
      cur = para;
    } else {
      cur += (cur ? '\n\n' : '') + para;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter((c) => c.length > 50);
}

function splitLong(chunk: string, max = 1500, hard = 2000): string[] {
  if (chunk.length <= hard) return [chunk];
  const sentences = chunk.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let cur = '';
  for (let s of sentences) {
    while (s.length > max) {
      if (cur) { out.push(cur); cur = ''; }
      let cut = s.lastIndexOf(' ', max);
      if (cut < max / 2) cut = max;
      out.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (cur.length + s.length + 1 > max && cur) {
      out.push(cur);
      cur = s;
    } else {
      cur += (cur ? ' ' : '') + s;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** First whole sentences of the stored text, verbatim, up to 600 chars (never generated wording). */
function firstSentences(text: string, max = 600): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const sentences = flat.split(/(?<=[.!?])\s+/);
  let out = '';
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) break;
    out = next;
  }
  return out || flat.slice(0, max);
}

interface Plan {
  item: SiteItem;
  slug: string;
  title: string;
  chunks: string[];
  vimeo: string | null;
}

function loadPlans(): Plan[] {
  const items = (JSON.parse(fs.readFileSync(DATA, 'utf-8')) as { items: SiteItem[] }).items;
  const plans: Plan[] = [];
  for (const item of items) {
    if (item.decision !== 'ingest' && item.decision !== 'ingest-as-article') continue;
    if (item.decision === 'ingest-as-article') throw new Error(`ingest-as-article not expected in this run: ${item.url}`);
    const slug = item.slug_override ?? createSlug(item.client, item.site_title);
    const text = item.text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const chunks = chunkContent(text, 1500).flatMap((c) => splitLong(c)).filter((c) => c.length >= 50);
    plans.push({
      item,
      slug,
      title: `${item.client}: ${item.site_title}`,
      chunks,
      vimeo: item.use_vimeo ? item.vimeo_urls?.[0] ?? null : null,
    });
  }
  const seen = new Set<string>();
  for (const p of plans) {
    if (seen.has(p.slug)) throw new Error(`duplicate planned slug: ${p.slug}`);
    seen.add(p.slug);
    if (p.chunks.length < (p.item.text.length > 1500 ? 2 : 1)) throw new Error(`too few chunks for ${p.slug}`);
  }
  return plans;
}

async function findExisting(p: Plan): Promise<string | null> {
  const a = await supabase.from('documents').select('id').eq('external_url', p.item.url).limit(1);
  if (a.error) throw new Error(`lookup external_url: ${a.error.message}`);
  if (a.data?.length) return `external_url match (${a.data[0].id})`;
  const b = await supabase.from('documents').select('id').eq('slug', p.slug).limit(1);
  if (b.error) throw new Error(`lookup slug: ${b.error.message}`);
  if (b.data?.length) return `slug match (${b.data[0].id})`;
  return null;
}

// ---------- dry run / insert ----------

async function run() {
  const plans = loadPlans();
  let docsPlanned = 0, chunksPlanned = 0, skipped = 0;
  const updates = 0;
  for (const p of plans) {
    const existing = await findExisting(p);
    const line = `${p.slug} | chunks=${p.chunks.length} | vimeo=${p.vimeo ? 'yes' : 'no'} | ${p.item.url}`;
    if (existing) {
      skipped++;
      console.log(`SKIP (exists: ${existing}) ${line}`);
      continue;
    }
    docsPlanned++;
    chunksPlanned += p.chunks.length;
    if (DRY) { console.log(`PLAN ${line}`); continue; }

    const { data: doc, error } = await supabase
      .from('documents')
      .insert({
        title: p.title,
        slug: p.slug,
        doc_type: 'case_study',
        client_name: p.item.client,
        summary: firstSentences(p.item.text),
        external_url: p.item.url,
        vimeo_url: p.vimeo,
        pdf_url: null,
        thumbnail_url: null,
        hero_video_url: null,
      })
      .select('id')
      .single();
    if (error || !doc) throw new Error(`document insert ${p.slug}: ${error?.message}`);

    try {
      const rows = [];
      for (let i = 0; i < p.chunks.length; i++) {
        rows.push({
          document_id: doc.id,
          content: p.chunks[i],
          chunk_index: i,
          chunk_type: 'narrative',
          embedding: await embed(`${p.item.client} ${p.item.site_title}\n\n${p.chunks[i]}`),
          metadata: { source: 'site', url: p.item.url, phase: '02' },
        });
      }
      const { error: ce } = await supabase.from('content_chunks').insert(rows);
      if (ce) throw new Error(ce.message);
    } catch (e) {
      // Roll back only the document row this run just created (no other references yet).
      await supabase.from('documents').delete().eq('id', doc.id);
      throw new Error(`chunk insert failed for ${p.slug}, rolled back its document: ${e instanceof Error ? e.message : e}`);
    }
    console.log(`INSERTED ${line}`);
  }
  console.log(`\n${DRY ? 'Would insert' : 'Inserted'} ${docsPlanned} documents, ${chunksPlanned} chunks; skipped ${skipped} existing; updates ${updates}`);
}

// ---------- verify ----------

async function verify() {
  const plans = loadPlans();
  const problems: string[] = [];
  for (const p of plans) {
    const { data: doc, error } = await supabase.from('documents').select('id, external_url, vimeo_url').eq('slug', p.slug);
    if (error) { problems.push(`lookup ${p.slug}: ${error.message}`); continue; }
    if (!doc || doc.length !== 1) { problems.push(`${p.slug}: ${doc?.length ?? 0} documents rows`); continue; }
    if (doc[0].external_url !== p.item.url) problems.push(`${p.slug}: external_url mismatch`);
    if ((doc[0].vimeo_url ?? null) !== p.vimeo) problems.push(`${p.slug}: vimeo_url mismatch`);
    const { count } = await supabase.from('content_chunks').select('id', { count: 'exact', head: true }).eq('document_id', doc[0].id);
    const min = p.item.text.length > 1500 ? 2 : 1;
    if ((count ?? 0) < min) problems.push(`${p.slug}: ${count} chunks, expected >= ${min}`);
    const q = `${p.item.client} ${p.item.site_title}`;
    const { data, error: e } = await supabase.rpc('hybrid_search', {
      query_embedding: await embed(q), query_text: q, match_count: 10,
    });
    if (e) { problems.push(`rpc ${p.slug}: ${e.message}`); continue; }
    const slugs = [...new Set((data ?? []).map((r: any) => r.slug ?? r.document_slug))] as string[];
    const rank = slugs.indexOf(p.slug);
    console.log(`probe "${q}": chunks=${count}, rank=${rank >= 0 ? rank + 1 : 'miss'} top5: ${slugs.slice(0, 5).join(' | ')}`);
    if (rank < 0 || rank >= 5) problems.push(`${p.slug}: not in top 5 for its title probe`);
  }

  const { count: summaryCount } = await supabase.from('content_chunks').select('id', { count: 'exact', head: true }).eq('metadata->>source', 'summary');
  console.log(`summary chunk count: ${summaryCount}`);
  if (summaryCount !== 43) problems.push(`summary chunk count is ${summaryCount}, expected 43`);

  const all: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('documents').select('slug').range(from, from + 999);
    if (error) { problems.push(`slug scan: ${error.message}`); break; }
    all.push(...(data ?? []).map((d) => d.slug));
    if (!data || data.length < 1000) break;
  }
  const dupes = all.filter((s, i) => all.indexOf(s) !== i);
  if (dupes.length) problems.push(`duplicate slugs: ${[...new Set(dupes)].join(', ')}`);

  if (problems.length) { console.error('VERIFY FAILED:\n' + problems.join('\n')); process.exit(1); }
  console.log('VERIFY OK');
}

(VERIFY ? verify() : run()).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
