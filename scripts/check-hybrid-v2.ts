/**
 * Verify hybrid_search_v2 (Phase 3, RETR-01). Read-only, uses cached query embeddings (~$0).
 * Usage: npx tsx scripts/check-hybrid-v2.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Query { id: string; text: string; expected?: { case_studies?: string[] } }
interface IndexedDoc { slug: string; doc_type: string }
interface Row {
  chunk_id: string; document_id: string; slug: string; document_type: string;
  metadata: { article_class?: string } | null;
  combined_score: number; semantic_rank: number; keyword_rank: number | null;
}

const queriesFile = JSON.parse(fs.readFileSync('eval/queries.json', 'utf8')) as { queries: Query[]; indexed_documents: IndexedDoc[] };
const emb = JSON.parse(fs.readFileSync('data/.cache/query-embeddings.json', 'utf8')) as Record<string, number[]>;
const queries = queriesFile.queries;

let passed = 0;
let total = 0;
function check(ok: boolean, label: string, detail = '') {
  total++;
  if (ok) passed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ' - ' + detail : ''}`);
}
function finish(): never {
  console.log(`\ncheck-hybrid-v2: ${passed}/${total} checks passed`);
  process.exit(passed === total ? 0 : 1);
}

// Argument guard: a bad call must not masquerade as a missing function.
for (const q of queries) {
  const e = emb[q.id];
  if (!(typeof q.text === 'string' && q.text.trim().length > 0) || !(Array.isArray(e) && e.length === 1536)) {
    console.error(`FAIL bad arguments: ${q.id} (query text or cached embedding missing/invalid) - this is a script/data bug, not a missing migration`);
    process.exit(1);
  }
}

async function call(id: string, extra: Record<string, unknown> = {}) {
  const q = queries.find((x) => x.id === id)!;
  return sb.rpc('hybrid_search_v2', { query_embedding: emb[id], query_text: q.text, match_count: 60, ...extra });
}

async function main() {
  // a. v2 exists
  const first = await call('p1-q06');
  if (first.error) {
    const { code, message, hint } = first.error as { code?: string; message?: string; hint?: string };
    console.error(`rpc error: code=${code} message=${message} hint=${hint}`);
    if ((code === 'PGRST202' || code === '42883') && !(hint ?? '').includes('hybrid_search_v2(')) {
      console.error('FAIL hybrid_search_v2 not found - apply supabase/migrations/005_hybrid_search_v2.sql in the Supabase SQL Editor');
    } else {
      console.error(`FAIL hybrid_search_v2 call rejected (code ${code}) - the function exists or the call is malformed; fix the script arguments, do NOT re-apply the migration`);
    }
    process.exit(1);
  }
  check(true, 'a. hybrid_search_v2 exists');

  // b. old function untouched
  const old = await sb.rpc('hybrid_search_exact', {
    query_embedding: emb['p1-q06'], query_text: queries.find((x) => x.id === 'p1-q06')!.text,
    doc_types: null, capability_slugs: null, industry_slugs: null, topic_slugs: null,
    match_count: 20, semantic_weight: 0.7,
  });
  check(!old.error && (old.data?.length ?? 0) > 0, 'b. hybrid_search_exact still works', old.error ? old.error.message : `${old.data?.length} rows`);

  // c. row counts
  let allSixty = true;
  for (let i = 0; i < 10; i++) {
    const r = await call('p1-q06');
    if (r.error || (r.data?.length ?? 0) !== 60) { allSixty = false; console.log(`  call ${i + 1}: ${r.error?.message ?? r.data?.length} rows`); }
  }
  check(allSixty, 'c1. 10 consecutive p1-q06 calls each return exactly 60 rows');

  const { data: chunkRows, error: cErr } = await sb.from('content_chunks').select('metadata').not('embedding', 'is', null);
  if (cErr) { console.error(cErr.message); process.exit(1); }
  const eligible = (chunkRows ?? []).filter((c) => {
    const cls = (c.metadata as { article_class?: string } | null)?.article_class ?? '';
    return cls !== 'excluded' && cls !== 'company_info';
  }).length;
  const expected = Math.min(60, eligible);

  const results: Record<string, Row[]> = {};
  const badCounts: string[] = [];
  for (const q of queries) {
    const r = await call(q.id);
    if (r.error) { badCounts.push(`${q.id}: ${r.error.message}`); continue; }
    results[q.id] = r.data as Row[];
    if (results[q.id].length !== expected) badCounts.push(`${q.id}: ${results[q.id].length}`);
  }
  check(badCounts.length === 0, `c2. all ${queries.length} queries return min(60, ${eligible} eligible) = ${expected} rows`, badCounts.slice(0, 5).join('; '));

  // d. exclusions
  const all = Object.values(results).flat();
  const bad = all.filter((r) => ['excluded', 'company_info'].includes(r.metadata?.article_class ?? ''));
  check(bad.length === 0, 'd1. no excluded/company_info rows with include_company_info=false', `${bad.length} found`);
  let exclWith = 0;
  for (const id of queries.slice(0, 3).map((q) => q.id)) {
    const r = await call(id, { include_company_info: true });
    if (r.error) { exclWith++; continue; }
    exclWith += (r.data as Row[]).filter((x) => x.metadata?.article_class === 'excluded').length;
  }
  check(exclWith === 0, 'd2. no excluded rows with include_company_info=true');
  const { count: ciCount } = await sb.from('content_chunks').select('id', { count: 'exact', head: true }).eq('metadata->>article_class', 'company_info');
  console.log(`  company_info chunks in DB: ${ciCount ?? 0}${(ciCount ?? 0) === 0 ? ' - trivially true (no company_info chunks yet)' : ''}`);

  // e. CrowdStrike within first 6 case-study docs for p1-q06
  const cs = queriesFile.indexed_documents.find(
    (d) => d.doc_type === 'case_study' && d.slug.includes('crowdstrike') && d.slug.includes('marketecture'))?.slug
    ?? queries.find((x) => x.id === 'p1-q06')?.expected?.case_studies?.find((s) => s.includes('crowdstrike'));
  const seen: string[] = [];
  for (const r of results['p1-q06'] ?? []) {
    if (r.document_type !== 'case_study') continue;
    if (!seen.includes(r.slug)) seen.push(r.slug);
  }
  const pos = cs ? seen.indexOf(cs) + 1 : 0;
  check(!!cs && pos >= 1 && pos <= 6, 'e. CrowdStrike within first 6 case-study docs for p1-q06', `slug=${cs} position=${pos || 'absent'}`);

  // f. shape
  const shapeBad = all.filter((r) =>
    !(typeof r.combined_score === 'number' && r.combined_score > 0 && r.combined_score < 0.05) ||
    !Number.isInteger(r.semantic_rank) ||
    !(r.keyword_rank === null || Number.isInteger(r.keyword_rank)));
  check(shapeBad.length === 0, 'f. shape: RRF combined_score in (0, 0.05), integer ranks', `${shapeBad.length} bad rows`);

  finish();
}

main().catch((e) => { console.error(e); process.exit(1); });
