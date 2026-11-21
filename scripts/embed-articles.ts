/**
 * Embed AG articles into content_chunks (Phase 2, DATA-01).
 *
 * Usage: npx tsx scripts/embed-articles.ts --prepare | --simulate | --insert --yes [--only a.pdf,b.pdf] | --verify
 *
 * - Matches each PDF to its EXISTING documents row by source_file_path. Never inserts documents.
 * - company_info / excluded docs are prepared but held (data/held-article-chunks.json), never inserted (D-18).
 * - Idempotent: a doc with chunks already in the DB is skipped.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { embeddingConfig } from '../src/lib/llm-config';

const ROOT = process.cwd();
const ARTICLES_DIR = path.join(ROOT, 'content', 'Articles');
const CACHE_DIR = path.join(ROOT, 'data', '.cache');
const CLASSES_FILE = path.join(ROOT, 'data', 'article-classes.json');
const HELD_FILE = path.join(ROOT, 'data', 'held-article-chunks.json');
const CHUNKS_CACHE = path.join(CACHE_DIR, 'article-chunks.json');
const QUERY_CACHE = path.join(CACHE_DIR, 'query-embeddings.json');
const IMPACT_FILE = path.join(CACHE_DIR, 'article-impact.json');
const INSERT_LOG = path.join(CACHE_DIR, 'article-insert-log.json');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const embedding = embeddingConfig();

if (!supabaseUrl || !supabaseKey || !embedding.apiKey) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and an embeddings key. Check .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

type ArticleClass = 'thought_leadership' | 'newsletter' | 'company_info' | 'excluded';
const HELD: ArticleClass[] = ['company_info', 'excluded'];

interface PreparedDoc {
  filename: string;
  document_id: string;
  title: string;
  slug: string;
  class: ArticleClass;
  already_chunked: boolean;
  chunks: { chunk_index: number; content: string; embedding: number[] }[];
}

// ---------- helpers (copied from ingest-articles.ts; importing it would run its main()) ----------

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

function extractPdfText(pdfPath: string): string {
  const py = `
import sys, json
try:
    import fitz
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed. Run: pip3 install pymupdf"}))
    sys.exit(1)
try:
    doc = fitz.open(sys.argv[1])
    text = ""
    for page in doc:
        text += page.get_text() + "\\n\\n"
    doc.close()
    print(json.dumps({"text": text}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = path.join(CACHE_DIR, '.temp-extract.py');
  fs.writeFileSync(tmp, py);
  const out = execSync(`python3 "${tmp}" "${pdfPath}"`, { encoding: 'utf-8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  const parsed = JSON.parse(out.trim());
  if (parsed.error) throw new Error(parsed.error);
  return parsed.text || '';
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\d+\s*$/gm, '')
    .replace(/Proprietary\s*\+?\s*Confidential/gi, '')
    .replace(/©\s*\d{4}/g, '')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

const NAV_LABELS = new Set([
  'Menu', 'Agency', 'Work', 'Ideas', 'Staff musings', 'Agency updates', 'Resources', 'Careers', 'Contact', 'Privacy policy',
]);

function stripNav(text: string): string {
  // Original text still has the (c) year line before cleanText removes the symbol; handle both forms.
  return text
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      if (NAV_LABELS.has(t)) return false;
      if (/^©\s*\d{4}\s+Article Group$/.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
      // Pathological sentence with no boundary: hard-split on whitespace.
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

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

async function countChunks(documentId: string): Promise<number> {
  const { count, error } = await supabase.from('content_chunks').select('id', { count: 'exact', head: true }).eq('document_id', documentId);
  if (error) throw new Error(`count chunks: ${error.message}`);
  return count ?? 0;
}

// ---------- prepare ----------

async function prepare() {
  const classes = readJson<{ classes: Record<string, ArticleClass> }>(CLASSES_FILE).classes;
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.pdf')).sort();
  const errors: string[] = [];
  const prepared: PreparedDoc[] = [];
  let totalChars = 0;

  for (const filename of files) {
    const cls = classes[filename];
    if (!cls) { errors.push(`${filename}: not in article-classes.json`); continue; }
    const { data: rows, error } = await supabase
      .from('documents')
      .select('id, title, slug')
      .eq('doc_type', 'article')
      .eq('source_file_path', filename);
    if (error) throw new Error(`documents lookup: ${error.message}`);
    if (!rows || rows.length !== 1) { errors.push(`${filename}: ${rows?.length ?? 0} documents rows matched`); continue; }
    const doc = rows[0];
    const existing = await countChunks(doc.id);
    if (existing > 0) {
      prepared.push({ filename, document_id: doc.id, title: doc.title, slug: doc.slug, class: cls, already_chunked: true, chunks: [] });
      console.log(`  skip (already chunked: ${existing}) ${filename}`);
      continue;
    }
    const raw = extractPdfText(path.join(ARTICLES_DIR, filename));
    // strip nav/footer lines before and after cleanText (cleanText removes the copyright symbol)
    const text = cleanText(stripNav(raw.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).join('\n')));
    const pieces = chunkContent(text, 1500).flatMap((c) => splitLong(c)).filter((c) => c.length >= 50);
    const chunks: PreparedDoc['chunks'] = [];
    for (let i = 0; i < pieces.length; i++) {
      const input = `${doc.title}\n\n${pieces[i]}`;
      totalChars += input.length;
      chunks.push({ chunk_index: i, content: pieces[i], embedding: await embed(input) });
    }
    prepared.push({ filename, document_id: doc.id, title: doc.title, slug: doc.slug, class: cls, already_chunked: false, chunks });
    console.log(`  ${chunks.length} chunks [${cls}] ${filename.slice(0, 70)}`);
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CHUNKS_CACHE, JSON.stringify(prepared));
  const held = prepared.filter((d) => HELD.includes(d.class));
  fs.writeFileSync(
    HELD_FILE,
    JSON.stringify(
      {
        note: 'Held per D-18 until hybrid_search_v2 can filter company_info/excluded (Phase 3)',
        documents: held.map((d) => ({
          filename: d.filename, document_id: d.document_id, title: d.title, slug: d.slug, class: d.class,
          chunks: d.chunks.map((c) => ({
            chunk_index: c.chunk_index, content: c.content,
            metadata: { source: 'article', article_class: d.class, phase: '02' },
          })),
        })),
      },
      null, 2,
    ) + '\n',
  );
  const total = prepared.reduce((n, d) => n + d.chunks.length, 0);
  console.log(`\nDocs: ${prepared.length}, total chunks: ${total}, embedding input chars: ${totalChars}`);
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
}

// ---------- simulate ----------

interface SimChunk { document_id: string; doc_type: string; slug: string; embedding: number[] }

function simulateOne(corpus: SimChunk[], q: number[]) {
  const scored = corpus.map((c) => ({ c, s: cosine(q, c.embedding) })).sort((a, b) => b.s - a.s).slice(0, 60);
  let top = scored.slice(0, 20).map((x) => ({ ...x, s: 0.7 * x.s }));
  const passed = top.filter((x) => x.s >= 0.15);
  top = passed.length ? passed : top.slice(0, 10);
  const best = new Map<string, (typeof top)[number]>();
  for (const x of top) { const k = x.c.document_id; if (!best.has(k) || best.get(k)!.s < x.s) best.set(k, x); }
  const docs = [...best.values()].sort((a, b) => b.s - a.s);
  let cs = docs.filter((d) => d.c.doc_type === 'case_study').slice(0, 4);
  if (!cs.length) {
    cs = scored.filter((x) => x.c.doc_type === 'case_study').slice(0, 2).map((x) => ({ ...x, s: 0.7 * x.s }));
  }
  const arts = docs.filter((d) => d.c.doc_type === 'article').slice(0, 2);
  const csInTop20 = new Set(top.filter((x) => x.c.doc_type === 'case_study').map((x) => x.c.document_id)).size;
  return { caseStudies: cs.map((d) => d.c.slug), articles: arts.map((d) => d.c.slug), csInTop20, top20Articles: top.filter((x) => x.c.doc_type === 'article').map((x) => x.c.slug) };
}

async function simulate() {
  const prepared = readJson<PreparedDoc[]>(CHUNKS_CACHE);
  const queries = readJson<{ queries: { id: string; text: string; expected: { case_studies: string[] } }[] }>(path.join(ROOT, 'eval', 'queries.json')).queries;
  const qCache: Record<string, number[]> = fs.existsSync(QUERY_CACHE) ? readJson(QUERY_CACHE) : {};
  for (const q of queries) if (!qCache[q.id]) qCache[q.id] = await embed(q.text);
  fs.writeFileSync(QUERY_CACHE, JSON.stringify(qCache));

  // existing chunks joined to documents
  const existing: SimChunk[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from('content_chunks')
      .select('document_id, embedding, documents!inner(doc_type, slug)')
      .range(from, from + 499);
    if (error) throw new Error(`load chunks: ${error.message}`);
    if (!data || !data.length) break;
    for (const r of data as any[]) {
      const emb = typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding;
      const d = Array.isArray(r.documents) ? r.documents[0] : r.documents;
      existing.push({ document_id: r.document_id, doc_type: d.doc_type, slug: d.slug, embedding: emb });
    }
    if (data.length < 500) break;
  }
  const added: SimChunk[] = [];
  for (const d of prepared) {
    if (d.already_chunked || HELD.includes(d.class)) continue;
    for (const c of d.chunks) added.push({ document_id: d.document_id, doc_type: 'article', slug: d.slug, embedding: c.embedding });
  }
  const after = existing.concat(added);

  let expectedTotal = 0, hitBefore = 0, hitAfter = 0, csBefore = 0, csAfter = 0, withArticle = 0, lowCs = 0;
  const displaced: { id: string; slug: string; displacedBy: string[] }[] = [];
  for (const q of queries) {
    const exp = q.expected.case_studies;
    expectedTotal += exp.length;
    const b = simulateOne(existing, qCache[q.id]);
    const a = simulateOne(after, qCache[q.id]);
    csBefore += b.caseStudies.length; csAfter += a.caseStudies.length;
    if (a.articles.length) withArticle++;
    if (a.csInTop20 < 4) lowCs++;
    for (const s of exp) {
      const inB = b.caseStudies.includes(s), inA = a.caseStudies.includes(s);
      if (inB) hitBefore++;
      if (inA) hitAfter++;
      if (inB && !inA) displaced.push({ id: q.id, slug: s, displacedBy: [...new Set(a.top20Articles)] });
    }
  }
  const n = queries.length;
  const result = {
    existingChunks: existing.length, addedChunks: added.length, queries: n, expectedTotal,
    recallBefore: hitBefore, recallAfter: hitAfter,
    meanCaseStudiesBefore: csBefore / n, meanCaseStudiesAfter: csAfter / n,
    queriesWithArticleAfter: withArticle, queriesLowCaseStudiesAfter: lowCs, displaced,
  };
  fs.writeFileSync(IMPACT_FILE, JSON.stringify(result, null, 2));
  const pct = (x: number) => `${((100 * x) / expectedTotal).toFixed(1)}%`;
  console.log(`## Simulated impact (approximate, semantic-only)
- existing chunks: ${existing.length}, added: ${added.length}
- recall before: ${hitBefore}/${expectedTotal} (${pct(hitBefore)})
- recall after: ${hitAfter}/${expectedTotal} (${pct(hitAfter)})
- mean case studies selected: ${(csBefore / n).toFixed(2)} -> ${(csAfter / n).toFixed(2)}
- queries with >= 1 article after: ${withArticle}/${n}
- queries with < 4 distinct case studies in top 20 after: ${lowCs}/${n}
- displaced (selected before, not after): ${displaced.length}`);
  for (const d of displaced) console.log(`  - ${d.id}: ${d.slug} (articles in top 20: ${d.displacedBy.join(', ')})`);
}

// ---------- insert ----------

async function insert(argv: string[]) {
  if (!argv.includes('--yes')) { console.error('Refusing to insert without --yes'); process.exit(1); }
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
  const prepared = readJson<PreparedDoc[]>(CHUNKS_CACHE);
  const run = { at: new Date().toISOString(), only, inserted: [] as { filename: string; document_id: string; chunks: number }[] };
  let total = 0;
  for (const d of prepared) {
    if (HELD.includes(d.class)) continue;
    if (only && !only.includes(d.filename)) continue;
    if (d.chunks.length === 0) continue;
    if ((await countChunks(d.document_id)) > 0) { console.log(`  skip (has chunks) ${d.filename.slice(0, 60)}`); continue; }
    const rows = d.chunks.map((c) => ({
      document_id: d.document_id,
      content: c.content,
      chunk_index: c.chunk_index,
      chunk_type: 'text',
      embedding: c.embedding,
      metadata: { source: 'article', article_class: d.class, phase: '02' },
    }));
    const { error } = await supabase.from('content_chunks').insert(rows);
    if (error) throw new Error(`insert ${d.filename}: ${error.message}`);
    run.inserted.push({ filename: d.filename, document_id: d.document_id, chunks: rows.length });
    total += rows.length;
    console.log(`  inserted ${rows.length} ${d.filename.slice(0, 60)}`);
  }
  const log = fs.existsSync(INSERT_LOG) ? readJson<{ runs: unknown[] }>(INSERT_LOG) : { runs: [] };
  log.runs.push(run);
  fs.writeFileSync(INSERT_LOG, JSON.stringify(log, null, 2));
  console.log(`\nInserted ${total} chunks across ${run.inserted.length} docs`);
}

// ---------- verify ----------

async function verify() {
  const prepared = readJson<PreparedDoc[]>(CHUNKS_CACHE);
  const problems: string[] = [];
  const log = fs.existsSync(INSERT_LOG) ? readJson<{ runs: { only: string[] | null; inserted: { filename: string }[] }[] }>(INSERT_LOG) : { runs: [] };
  const latest = log.runs[log.runs.length - 1];
  const subset = latest?.only ? new Set(log.runs.flatMap((r) => r.inserted.map((i) => i.filename))) : null;

  for (const d of prepared) {
    const n = await countChunks(d.document_id);
    if (HELD.includes(d.class)) { if (n !== 0) problems.push(`held doc has ${n} chunks: ${d.filename}`); continue; }
    if (subset && !subset.has(d.filename)) continue;
    if (n < 1) problems.push(`no chunks: ${d.filename}`);
  }

  const ids = prepared.map((d) => d.document_id);
  const { data: artChunks, error } = await supabase.from('content_chunks').select('document_id, chunk_index').in('document_id', ids);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  for (const c of artChunks ?? []) {
    const k = `${c.document_id}:${c.chunk_index}`;
    if (seen.has(k)) problems.push(`duplicate ${k}`);
    seen.add(k);
  }

  const { count: summaryCount } = await supabase.from('content_chunks').select('id', { count: 'exact', head: true }).eq('metadata->>source', 'summary');
  if (summaryCount !== 43) problems.push(`summary chunk count is ${summaryCount}, expected 43`);

  const probes: [string, string][] = [
    ['how to write a good creative brief', 'creative-brief-best-practices'],
    ['Barbie movie marketing', 'article-group-newsletter-issue-3'],
    ['empathy map for understanding your audience', 'empathy-map'],
  ];
  const slugOf = (r: any) => r.slug ?? r.document_slug;
  for (const [text, prefix] of probes) {
    const target = prepared.find((d) => d.slug.startsWith(prefix));
    if (subset && target && !subset.has(target.filename)) { console.log(`probe skipped (not inserted): ${text}`); continue; }
    const qe = await embed(text);
    const { data, error: e } = await supabase.rpc('hybrid_search', {
      query_embedding: qe, query_text: text, doc_types: ['article'], match_count: 10,
    });
    if (e) { problems.push(`rpc: ${e.message}`); continue; }
    const top5 = (data ?? []).slice(0, 5).map(slugOf);
    console.log(`probe "${text}" top5: ${top5.join(' | ')}`);
    if (!top5.some((s: string) => s?.startsWith(prefix))) problems.push(`probe miss: ${text} (expected ${prefix}*)`);
  }
  const text = 'creative brief best practices and problem framing';
  const { data, error: e2 } = await supabase.rpc('hybrid_search', {
    query_embedding: await embed(text), query_text: text, doc_types: null, match_count: 20,
  });
  if (e2) problems.push(`rpc unfiltered: ${e2.message}`);
  else {
    const arts = (data ?? []).filter((r: any) => r.document_type === 'article' || r.doc_type === 'article');
    console.log(`unfiltered top slugs: ${(data ?? []).slice(0, 5).map(slugOf).join(' | ')} (articles: ${arts.length})`);
    if (!arts.length) problems.push('unfiltered probe returned no article rows');
  }

  if (problems.length) { console.error('VERIFY FAILED:\n' + problems.join('\n')); process.exit(1); }
  console.log('VERIFY OK');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--prepare')) return prepare();
  if (argv.includes('--simulate')) return simulate();
  if (argv.includes('--insert')) return insert(argv);
  if (argv.includes('--verify')) return verify();
  console.error('Usage: --prepare | --simulate | --insert --yes [--only files] | --verify');
  process.exit(1);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
