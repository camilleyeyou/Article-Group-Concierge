/**
 * D-303: free recall gate. Runs the real retrieveContext over every eval query
 * (no dev server, no generation, no grading) and applies the eval/metrics.ts recall rule.
 *   npm run eval:recall-offline [-- --json <path>]
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { retrieveContext } from '../src/lib/supabase';
import { cache, CACHE_PREFIXES, CACHE_TTL } from '../src/lib/cache';
import { isDisputed } from './labels';
import { rerankStats } from '../src/lib/rerank';
import { CONCIERGE_CONFIG, rerankEnabled } from '../src/lib/concierge-config';

interface Q {
  id: string;
  text: string;
  expected: { case_studies: string[] };
}
interface Doc { slug: string; title: string }

interface QResult {
  id: string;
  searchFunction: string | undefined;
  slugs: string[];
  caseStudyCount: number;
  articleCount: number;
  caseStudyTitles: string[];
}

const GATE = 47;

async function main() {
  const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'queries.json'), 'utf8'));
  const queries: Q[] = spec.queries;
  const docs: Doc[] = spec.indexed_documents ?? [];
  const titleOf = (slug: string) => docs.find(d => d.slug === slug)?.title ?? slug;

  for (const q of queries) {
    if (typeof q.text !== 'string' || q.text.trim() === '') {
      console.error(`query ${q.id} has no text`);
      process.exit(1);
    }
  }

  // Seed embedding cache (key must be the exact string passed to retrieveContext)
  const embPath = path.resolve(process.cwd(), 'data/.cache/query-embeddings.json');
  const emb: Record<string, number[]> = fs.existsSync(embPath)
    ? JSON.parse(fs.readFileSync(embPath, 'utf8'))
    : {};
  let seeded = 0;
  const missing: string[] = [];
  for (const q of queries) {
    if (emb[q.id]) {
      cache.set(CACHE_PREFIXES.EMBEDDING, q.text, emb[q.id], CACHE_TTL.EMBEDDING);
      seeded++;
    } else {
      missing.push(q.id);
    }
  }
  console.log(`embeddings seeded: ${seeded}, missing: ${missing.length}${missing.length ? ' (' + missing.join(', ') + ')' : ''}`);

  const passes: QResult[][] = [];
  for (const p of [1, 2]) {
    const res: QResult[] = [];
    for (const q of queries) {
      const ctx = await retrieveContext({ query: q.text, skipCache: true });
      const cs = ctx.chunks.filter(c => c.document_type === 'case_study');
      res.push({
        id: q.id,
        searchFunction: ctx.searchFunction,
        slugs: ctx.chunks.map(c => c.slug),
        caseStudyCount: cs.length,
        articleCount: ctx.chunks.filter(c => c.document_type === 'article').length,
        caseStudyTitles: cs.map(c => c.document_title),
      });
    }
    passes.push(res);
    void p;
  }

  const recall = (res: QResult[], corrected: boolean) => {
    let hit = 0;
    let total = 0;
    const misses: { id: string; missing: string[]; retrieved: string[] }[] = [];
    for (const q of queries) {
      if (q.expected.case_studies.length === 0) continue;
      const r = res.find(x => x.id === q.id)!;
      const got = new Set(r.slugs);
      const miss: string[] = [];
      for (const s of q.expected.case_studies) {
        if (corrected && isDisputed(q.id, s)) continue;
        total++;
        if (got.has(s)) hit++;
        else miss.push(s);
      }
      if (miss.length) misses.push({ id: q.id, missing: miss.map(titleOf), retrieved: r.caseStudyTitles });
    }
    return { hit, total, misses };
  };

  const pct = (h: number, t: number) => (t ? Math.round((h / t) * 100) : 0);
  const f1 = recall(passes[0], false);
  const c1 = recall(passes[0], true);
  const f2 = recall(passes[1], false);
  const identical = JSON.stringify(passes[0].map(r => [r.id, r.slugs])) === JSON.stringify(passes[1].map(r => [r.id, r.slugs]));

  const v2Count = passes[0].filter(r => r.searchFunction === 'hybrid_search_v2').length;
  const wrongFn = passes.flat().filter(r => r.searchFunction !== 'hybrid_search_v2');

  const dist: Record<number, number> = {};
  for (const r of passes[0]) dist[r.caseStudyCount] = (dist[r.caseStudyCount] ?? 0) + 1;
  const zero = queries.filter(q => q.expected.case_studies.length === 0).map(q => passes[0].find(r => r.id === q.id)!);
  const zeroMean = zero.length ? zero.reduce((a, r) => a + r.caseStudyCount, 0) / zero.length : 0;

  console.log('\nMisses (pass 1, frozen rule):');
  for (const m of f1.misses) {
    console.log(`  ${m.id}: missing [${m.missing.join('; ')}] retrieved CS [${m.retrieved.join('; ')}]`);
  }
  console.log('\ncase-study count distribution:', JSON.stringify(dist));
  console.log(`zero-expected queries: n=${zero.length}, mean case studies ${zeroMean.toFixed(2)}`);

  console.log('\n----');
  console.log(`search function: hybrid_search_v2 (${v2Count}/${queries.length})`);
  console.log(`pass 1 recall (frozen): ${f1.hit}/${f1.total} (${pct(f1.hit, f1.total)}%)   corrected: ${c1.hit}/${c1.total} (${pct(c1.hit, c1.total)}%)`);
  console.log(`pass 2 recall (frozen): ${f2.hit}/${f2.total} (${pct(f2.hit, f2.total)}%)   identical to pass 1: ${identical ? 'yes' : 'no'}`);
  if (rerankStats.length > 0) {
    const lat = rerankStats.filter(r => r.ok).map(r => r.latencyMs).sort((a, b) => a - b);
    const p50 = lat.length ? lat[Math.floor((lat.length - 1) / 2)] : 0;
    const cost = rerankStats.reduce((a, r) => a + (r.cost ?? 0), 0);
    console.log(`rerank provider: ${CONCIERGE_CONFIG.retrieval.rerank.provider}, rerank calls: ${rerankStats.length}, fallbacks (null): ${rerankStats.filter(r => !r.ok).length}, p50 ${p50} ms, max ${lat.length ? lat[lat.length - 1] : 0} ms, cost reported $${cost.toFixed(6)}`);
  }
  console.log(`GATE (D-303, frozen >= ${GATE}/52): ${f1.hit >= GATE && f2.hit >= GATE ? 'PASS' : 'FAIL'}`);

  const jsonIdx = process.argv.indexOf('--json');
  const outPath = path.resolve(process.cwd(), jsonIdx >= 0 && process.argv[jsonIdx + 1] ? process.argv[jsonIdx + 1] : 'data/.cache/recall-offline-latest.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ pass1: passes[0], pass2: passes[1] }, null, 2));

  if (wrongFn.length > 0) {
    console.error(`ERROR: ${wrongFn.length} retrievals used ${[...new Set(wrongFn.map(r => r.searchFunction))].join(', ')} instead of hybrid_search_v2; this is not measuring the v2 path.`);
    process.exit(1);
  }
  if (!identical) {
    if (rerankEnabled() && CONCIERGE_CONFIG.retrieval.rerank.provider === 'haiku') {
      const diff = passes[0].filter((r, i) => JSON.stringify(r.slugs) !== JSON.stringify(passes[1][i].slugs)).map(r => r.id);
      console.warn(`WARNING: passes differ (LLM reranker): ${diff.join(', ')}`);
    } else {
      console.error('ERROR: pass 2 differs from pass 1');
      process.exit(1);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
