/**
 * Embed and insert the held company_info / excluded article chunks (Phase 3).
 *
 * Usage: npx tsx scripts/insert-held-chunks.ts [--dry-run] | --insert --yes | --verify
 * Default is --dry-run (no writes, no embedding calls). --insert needs hybrid_search_v2 live (D-18).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const HELD_FILE = path.join(process.cwd(), 'data', 'held-article-chunks.json');
const LOG_FILE = path.join(process.cwd(), 'data', '.cache', 'held-insert-log.json');

interface HeldDoc {
  filename: string; document_id: string; title: string; slug: string; class: 'company_info' | 'excluded';
  chunks: { chunk_index: number; content: string; metadata?: Record<string, unknown> }[];
}
const held = (JSON.parse(fs.readFileSync(HELD_FILE, 'utf8')) as { documents: HeldDoc[] }).documents;

async function countChunks(documentId: string): Promise<number> {
  const { count, error } = await sb.from('content_chunks').select('id', { count: 'exact', head: true }).eq('document_id', documentId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function dryRun() {
  let chunks = 0;
  let chars = 0;
  for (const d of held) {
    const { data } = await sb.from('documents').select('id').eq('id', d.document_id).maybeSingle();
    const existing = await countChunks(d.document_id);
    console.log(`${d.filename.slice(0, 70)} | class=${d.class} | chunks=${d.chunks.length} | document exists=${!!data} | current chunks in DB=${existing}`);
    chunks += d.chunks.length;
    chars += d.chunks.reduce((s, c) => s + c.content.length, 0);
  }
  const tokens = Math.ceil(chars / 4);
  console.log(`\nDRY RUN: ${held.length} docs, ${chunks} chunks, ~${tokens} tokens, est. embedding cost ~$${((tokens / 1e6) * 0.02).toFixed(4)}`);
  console.log('Nothing inserted. Use --insert --yes after hybrid_search_v2 is live in production.');
}

async function insert() {
  const queries = JSON.parse(fs.readFileSync('eval/queries.json', 'utf8')).queries as { id: string; text: string }[];
  const emb = JSON.parse(fs.readFileSync('data/.cache/query-embeddings.json', 'utf8')) as Record<string, number[]>;
  const q = queries[0];
  const probe = await sb.rpc('hybrid_search_v2', { query_embedding: emb[q.id], query_text: q.text, match_count: 1 });
  if (probe.error) {
    console.error(`v2 must be live before held docs are inserted (D-18): ${probe.error.message}`);
    process.exit(1);
  }
  const { generateEmbedding } = await import('../src/lib/supabase');
  const run = { at: new Date().toISOString(), inserted: [] as { filename: string; document_id: string; chunks: number }[] };
  for (const d of held) {
    if ((await countChunks(d.document_id)) > 0) { console.log(`  skip (has chunks) ${d.filename.slice(0, 60)}`); continue; }
    const rows = [];
    for (const c of d.chunks) {
      const embedding = await generateEmbedding(c.content);
      rows.push({
        document_id: d.document_id, content: c.content, chunk_index: c.chunk_index, chunk_type: 'text', embedding,
        metadata: { ...(c.metadata ?? {}), article_class: d.class, phase: '03' },
      });
    }
    const { error } = await sb.from('content_chunks').insert(rows);
    if (error) throw new Error(`insert ${d.filename}: ${error.message}`);
    run.inserted.push({ filename: d.filename, document_id: d.document_id, chunks: rows.length });
    console.log(`  inserted ${rows.length} ${d.filename.slice(0, 60)}`);
  }
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  const log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : { runs: [] };
  log.runs.push(run);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  console.log(`\nInserted ${run.inserted.reduce((s, i) => s + i.chunks, 0)} chunks across ${run.inserted.length} docs`);
}

async function verify() {
  let bad = 0;
  for (const d of held) {
    const n = await countChunks(d.document_id);
    const ok = n === d.chunks.length;
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : 'BAD'} ${d.filename.slice(0, 60)}: expected ${d.chunks.length}, actual ${n}`);
  }
  process.exit(bad ? 1 : 0);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--verify')) return verify();
  if (argv.includes('--insert')) {
    if (!argv.includes('--yes')) { console.error('Refusing to insert without --insert --yes'); process.exit(1); }
    return insert();
  }
  return dryRun();
}

main().catch((e) => { console.error(e); process.exit(1); });
