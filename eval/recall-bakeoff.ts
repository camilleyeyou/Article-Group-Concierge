/**
 * D-305: offline bake-off of every recall lever (cap 6/7/8 x none/cohere/haiku) through the real
 * retrieveContext and the eval recall rule. Two passes per mode. Mutates CONCIERGE_CONFIG in-process only.
 *   npm run eval:recall-bakeoff
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
delete process.env.RERANK_ENABLED;

import { selectQueries, type EvalQuery } from './lib';
import { retrieveContext } from '../src/lib/supabase';
import { cache, CACHE_PREFIXES, CACHE_TTL } from '../src/lib/cache';
import { CONCIERGE_CONFIG } from '../src/lib/concierge-config';
import { rerankStats } from '../src/lib/rerank';
import { isDisputed } from './labels';

interface Q { id: string; text: string; expected: { case_studies: string[] } }
interface Doc { slug: string; title: string }
interface QRun { id: string; csSlugs: string[]; artSlugs: string[]; csChars: number[]; ms: number }

type Mode = 'none' | 'cohere' | 'haiku';
const MODES: Mode[] = ['none', 'cohere', 'haiku'];
const CAPS = [6, 7, 8];
const GATE = 47;
const SONNET_IN = 0.000002;

const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor((s.length - 1) * p)] : 0;
};

async function main() {
  const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'queries.json'), 'utf8'));
  const queries: Q[] = selectQueries(spec.queries as EvalQuery[]) as unknown as Q[];
  console.log(`Held-out queries excluded (D-602): ${spec.queries.length - queries.length}`);
  const docs: Doc[] = spec.indexed_documents ?? [];
  const titleOf = (slug: string) => docs.find(d => d.slug === slug)?.title ?? slug;

  const embPath = path.resolve(process.cwd(), 'data/.cache/query-embeddings.json');
  const emb: Record<string, number[]> = fs.existsSync(embPath) ? JSON.parse(fs.readFileSync(embPath, 'utf8')) : {};
  let seeded = 0;
  for (const q of queries) {
    if (emb[q.id]) {
      cache.set(CACHE_PREFIXES.EMBEDDING, q.text, emb[q.id], CACHE_TTL.EMBEDDING);
      seeded++;
    }
  }
  console.log(`embeddings seeded: ${seeded}/${queries.length}`);

  const R = CONCIERGE_CONFIG.retrieval;
  const orig = { cap: R.maxCaseStudies, enabled: R.rerank.enabled, provider: R.rerank.provider };

  const runs: Record<Mode, QRun[][]> = { none: [], cohere: [], haiku: [] };
  const stats: Record<Mode, { calls: number; fallbacks: number; p50: number; max: number; cost: number }> = {
    none: { calls: 0, fallbacks: 0, p50: 0, max: 0, cost: 0 },
    cohere: { calls: 0, fallbacks: 0, p50: 0, max: 0, cost: 0 },
    haiku: { calls: 0, fallbacks: 0, p50: 0, max: 0, cost: 0 },
  };

  for (const mode of MODES) {
    R.maxCaseStudies = 8;
    R.rerank.enabled = mode !== 'none';
    if (mode !== 'none') R.rerank.provider = mode;
    rerankStats.length = 0;
    for (let p = 0; p < 2; p++) {
      const res: QRun[] = [];
      for (const q of queries) {
        const t0 = Date.now();
        let ctx = await retrieveContext({ query: q.text, skipCache: true });
        for (let a = 0; a < 3 && ctx.searchFunction !== 'hybrid_search_v2'; a++) {
          console.warn(`retry ${q.id}: searchFunction=${ctx.searchFunction}`);
          ctx = await retrieveContext({ query: q.text, skipCache: true });
        }
        if (ctx.searchFunction !== 'hybrid_search_v2') throw new Error(`${q.id}: not on hybrid_search_v2`);
        const ms = Date.now() - t0;
        const cs = ctx.chunks.filter(c => c.document_type === 'case_study');
        res.push({
          id: q.id,
          csSlugs: cs.map(c => c.slug),
          artSlugs: ctx.chunks.filter(c => c.document_type === 'article').map(c => c.slug),
          csChars: cs.map(c => c.content.length),
          ms,
        });
      }
      runs[mode].push(res);
      console.log(`mode ${mode} pass ${p + 1} done`);
    }
    const ok = rerankStats.filter(r => r.ok).map(r => r.latencyMs);
    stats[mode] = {
      calls: rerankStats.length,
      fallbacks: rerankStats.filter(r => !r.ok).length,
      p50: pct(ok, 0.5),
      max: ok.length ? Math.max(...ok) : 0,
      cost: rerankStats.reduce((a, r) => a + (r.cost ?? 0), 0),
    };
  }
  R.maxCaseStudies = orig.cap;
  R.rerank.enabled = orig.enabled;
  R.rerank.provider = orig.provider;

  const score = (res: QRun[], k: number, corrected: boolean) => {
    let hit = 0, total = 0;
    const misses: { id: string; missing: string[] }[] = [];
    for (const q of queries) {
      if (q.expected.case_studies.length === 0) continue;
      const r = res.find(x => x.id === q.id)!;
      const got = new Set([...r.csSlugs.slice(0, k), ...r.artSlugs]);
      const miss: string[] = [];
      for (const s of q.expected.case_studies) {
        if (corrected && isDisputed(q.id, s)) continue;
        total++;
        if (got.has(s)) hit++;
        else miss.push(titleOf(s));
      }
      if (miss.length) misses.push({ id: q.id, missing: miss });
    }
    return { hit, total, misses };
  };

  // added generation cost of cap 7/8 vs cap 6, mean over queries (pass 1, same mode)
  const addedGen = (mode: Mode, k: number) => {
    if (k === 6) return 0;
    const res = runs[mode][0];
    const chars = res.map(r => r.csChars.slice(6, k).reduce((a, b) => a + b, 0));
    return (chars.reduce((a, b) => a + b, 0) / res.length / 4) * SONNET_IN;
  };

  interface Row {
    id: string; mode: Mode; k: number;
    f1: number; f2: number; c1: number; c2: number; ft: number; ct: number;
    p50: number; max: number; costPerQuery: number; addedGenPerQuery: number; fallbacks: number;
    qualifies: boolean; misses: { id: string; missing: string[] }[];
  }
  const rows: Row[] = [];
  for (const mode of MODES) {
    for (const k of CAPS) {
      const id = mode === 'none' ? `cap${k}` : `${mode}-cap${k}`;
      const a = score(runs[mode][0], k, false), b = score(runs[mode][1], k, false);
      const ca = score(runs[mode][0], k, true), cb = score(runs[mode][1], k, true);
      const s = stats[mode];
      rows.push({
        id, mode, k, f1: a.hit, f2: b.hit, c1: ca.hit, c2: cb.hit, ft: a.total, ct: ca.total,
        p50: s.p50, max: s.max, costPerQuery: s.calls ? s.cost / (queries.length * 2) : 0,
        addedGenPerQuery: addedGen(mode, k), fallbacks: s.fallbacks,
        qualifies: a.hit >= GATE && b.hit >= GATE, misses: a.misses,
      });
    }
  }

  console.log('\nCandidate | Frozen p1 | Frozen p2 | Corrected p1 | Corrected p2 | Latency p50/max ms | Rerank $/q | Added gen $/q | Fallbacks | Qualifies');
  for (const r of rows) {
    console.log(`${r.id} | ${r.f1}/${r.ft} | ${r.f2}/${r.ft} | ${r.c1}/${r.ct} | ${r.c2}/${r.ct} | ${r.p50}/${r.max} | $${r.costPerQuery.toFixed(6)} | $${r.addedGenPerQuery.toFixed(6)} | ${r.fallbacks} | ${r.qualifies ? 'yes' : 'no'}`);
  }
  console.log('\nMisses (pass 1, frozen):');
  for (const r of rows) {
    console.log(`  ${r.id}: ${r.misses.map(m => `${m.id} [${m.missing.join('; ')}]`).join(' | ') || 'none'}`);
  }

  // Controls
  const cap6 = rows.find(r => r.id === 'cap6')!, coh6 = rows.find(r => r.id === 'cohere-cap6')!;
  const bad: string[] = [];
  if (cap6.f1 !== 43) bad.push(`cap6 p1 ${cap6.f1}/52 expected 43`);
  if (coh6.f1 !== 44) bad.push(`cohere-cap6 p1 ${coh6.f1}/52 expected 44`);
  console.log(bad.length ? `CONTROLS: MISMATCH (${bad.join('; ')})` : 'CONTROLS: OK');

  // Winner per D-305
  const q = rows.filter(r => r.qualifies);
  let winner: Row | undefined;
  const none = q.filter(r => r.mode === 'none').sort((a, b) => a.k - b.k);
  if (none.length) winner = none[0];
  else {
    const byProv = (m: Mode) => q.filter(r => r.mode === m).sort((a, b) => a.k - b.k)[0];
    const c = byProv('cohere'), h = byProv('haiku');
    if (c && h) {
      if (Math.abs(c.p50 - h.p50) <= 200) winner = h.costPerQuery < c.costPerQuery ? h : c;
      else winner = h.p50 < c.p50 ? h : c;
    } else winner = c ?? h;
  }
  console.log(winner ? `BAKEOFF WINNER: ${winner.id}` : 'BAKEOFF: NO CANDIDATE');
  const totalSpend = rows.length ? stats.cohere.cost + stats.haiku.cost : 0;
  console.log(`rerank spend reported: $${totalSpend.toFixed(4)} (cohere $${stats.cohere.cost.toFixed(4)}, haiku $${stats.haiku.cost.toFixed(4)})`);

  fs.mkdirSync(path.resolve(process.cwd(), 'data/.cache'), { recursive: true });
  fs.writeFileSync(path.resolve(process.cwd(), 'data/.cache/recall-bakeoff-latest.json'), JSON.stringify({ rows, stats, runs }, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
