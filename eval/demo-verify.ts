import * as dotenv from 'dotenv';
import * as path from 'node:path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import fs from 'node:fs';
import { argValue, hasFlag, loadQueriesFile } from './lib';
import { consumeChatStream } from './stream-client';

/**
 * Production demo verifier (plan 06-11, D-611/D-612).
 *
 *   npx tsx eval/demo-verify.ts --ids p2-q04,p1-q03 --round 1 [--base-url https://article-group-concierge.vercel.app]
 *   npx tsx eval/demo-verify.ts --ids p2-q04,p1-q03 --sheet      (no requests; builds CHECK.md, select-only DB read)
 *
 * Each request is { query } only (never a debug flag), full answer (no abort), 4 s apart.
 * Perf flags (rag_cache_hit, orch_cached) are recorded when present. PERF_TIMING may be off in
 * production, in which case they are null and the stability table says so; independence is then
 * established by spacing rounds more than 65 minutes apart.
 */

const DEFAULT_BASE_URL = 'https://article-group-concierge.vercel.app';
const OUT_DIR = path.resolve('.planning/phases/06-proof/06-DEMO');
const DELAY_MS = 4000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface RoundFile {
  id: string;
  query: string;
  round: number;
  base_url: string;
  started_at: string;
  http_status: number | null;
  t_teasers_ms: number | null;
  t_hero_first_ms: number | null;
  t_complete_ms: number | null;
  perf: { rag_cache_hit: number | null; orch_cached: boolean | null; instance_req: number | null } | null;
  error: string | null;
  final: any;
}

async function runRound(baseUrl: string, ids: string[], round: number) {
  const queries = loadQueriesFile().queries;
  for (const id of ids) {
    const q = queries.find((x: any) => x.id === id);
    if (!q) throw new Error(`Unknown query id ${id}`);
    const dir = path.join(OUT_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    const t0 = performance.now();
    const startedAt = new Date().toISOString();
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q.text }),
    });
    let rec: RoundFile = {
      id, query: q.text, round, base_url: baseUrl, started_at: startedAt, http_status: res.status,
      t_teasers_ms: null, t_hero_first_ms: null, t_complete_ms: null, perf: null, error: null, final: null,
    };
    if (res.ok && (res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      const cap = await consumeChatStream(res, t0);
      rec = {
        ...rec,
        t_teasers_ms: cap.t_teasers_ms,
        t_hero_first_ms: cap.t_hero_first_ms,
        t_complete_ms: cap.t_complete_ms,
        perf: cap.perf ? { rag_cache_hit: cap.perf.rag_cache_hit, orch_cached: cap.perf.orch_cached, instance_req: cap.perf.instance_req } : null,
        error: cap.error?.errorCode ?? null,
        final: cap.final,
      };
      if (cap.perf?.orch_cached === true) console.log(`  CACHED: not an independent run (${id})`);
      if (cap.perf?.rag_cache_hit === 1) console.log(`  CACHED retrieval: not an independent run (${id})`);
      if (!cap.perf) console.log(`  note: no perf flags in stream (PERF_TIMING off); rely on >65 min spacing (${id})`);
    } else {
      rec.error = `http ${res.status}`;
    }
    fs.writeFileSync(path.join(dir, `round${round}.json`), JSON.stringify(rec, null, 2));
    console.log(`${id} round ${round}: http ${rec.http_status}, complete ${rec.t_complete_ms === null ? 'n/a' : Math.round(rec.t_complete_ms)} ms, error ${rec.error ?? 'none'}`);
    await sleep(DELAY_MS);
  }
}

function layoutOf(r: RoundFile): any[] {
  return r.final?.layoutPlan?.layout ?? [];
}
const teaserSlugs = (r: RoundFile) => layoutOf(r).filter(l => l.component === 'CaseStudyTeaser').map(l => l.props.slug);
const videoUrls = (r: RoundFile) => layoutOf(r).filter(l => l.component === 'VideoPlayer').map(l => l.props.url ?? l.props.videoUrl ?? JSON.stringify(l.props));
const strategyCards = (r: RoundFile) => layoutOf(r).filter(l => l.component === 'StrategyCard');

async function buildSheets(ids: string[]) {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  for (const id of ids) {
    const dir = path.join(OUT_DIR, id);
    const rounds: RoundFile[] = fs.readdirSync(dir).filter(f => /^round\d+\.json$/.test(f)).sort()
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    if (!rounds.length) { console.log(`${id}: no rounds, skipped`); continue; }
    const r1 = rounds[0];
    const out: string[] = [`# Check sheet: ${id}`, '', `Query: ${r1.query}`, '', 'Verdict: PENDING (fill the Claims table by hand against the appendix)', ''];

    const slugsShown = new Set<string>();
    for (const r of rounds) {
      out.push(`## Round ${r.round} (${r.started_at}, http ${r.http_status}, complete ${r.t_complete_ms === null ? 'n/a' : Math.round(r.t_complete_ms)} ms)`, '');
      for (const l of layoutOf(r)) {
        const p = l.props ?? {};
        if (l.component === 'HeroBlock') out.push(`- Hero: **${p.title}** / ${p.subtitle} / ${p.challengeSummary ?? ''}`);
        else if (l.component === 'StrategyCard') out.push(`- StrategyCard: **${p.title}**: ${p.content}`);
        else if (l.component === 'CaseStudyTeaser') {
          slugsShown.add(p.slug);
          out.push(`- Teaser \`${p.slug}\`: ${p.summary} [capabilities: ${(p.capabilities ?? []).join(', ')}; industries: ${(p.industries ?? []).join(', ')}]`);
        } else if (l.component === 'VideoPlayer') out.push(`- Video: ${p.url ?? p.videoUrl ?? JSON.stringify(p)}`);
        else if (l.component === 'MetricHighlight' || /metric/i.test(l.component)) out.push(`- ${l.component}: ${JSON.stringify(p)}`);
        else out.push(`- ${l.component}: ${JSON.stringify(p)}`);
      }
      out.push(`- Narrative: ${r.final?.explanation ?? ''}`, '');
    }

    out.push('## Stability', '', '| round | started | teaser slugs | video URLs | Strategy Lead offer | rag_cache_hit | orch_cached |', '|---|---|---|---|---|---|---|');
    for (const r of rounds) {
      const text = JSON.stringify(layoutOf(r)) + (r.final?.explanation ?? '');
      const sl = /strategy lead/i.test(text) ? 'yes' : 'no';
      out.push(`| ${r.round} | ${r.started_at} | ${teaserSlugs(r).join(', ') || 'none'} | ${videoUrls(r).join(', ') || 'none'} | ${sl} | ${r.perf?.rag_cache_hit ?? 'n/a'} | ${r.perf?.orch_cached ?? 'n/a'} |`);
    }
    out.push('');

    out.push('## Claims', '', 'One row per sentence, summary, tag, metric, video and link of round 1.', '',
      '| item | source slug | supporting quote from indexed text | verdict (supported/unsupported) | stable in rounds 2-3 |', '|---|---|---|---|---|');
    for (const l of layoutOf(r1)) {
      const p = l.props ?? {};
      const slug = p.slug ?? '';
      if (l.component === 'HeroBlock') for (const s of [p.title, p.subtitle, p.challengeSummary].filter(Boolean)) out.push(`| Hero: ${s} | | | | |`);
      if (l.component === 'StrategyCard') for (const s of String(p.content ?? '').split(/(?<=[.!?])\s+/)) out.push(`| StrategyCard: ${s} | | | | |`);
      if (l.component === 'CaseStudyTeaser') {
        for (const s of String(p.summary ?? '').split(/(?<=[.!?])\s+/)) out.push(`| Teaser summary: ${s} | ${slug} | | | |`);
        for (const t of [...(p.capabilities ?? []), ...(p.industries ?? [])]) out.push(`| Tag: ${t} | ${slug} | | | |`);
      }
      if (l.component === 'VideoPlayer') out.push(`| Video: ${p.url ?? p.videoUrl ?? ''} | | | | |`);
      if (/metric/i.test(l.component)) out.push(`| ${l.component}: ${JSON.stringify(p)} | | | | |`);
    }
    for (const s of String(r1.final?.explanation ?? '').split(/(?<=[.!?])\s+/).filter(Boolean)) out.push(`| Narrative: ${s} | | | | |`);
    out.push('');

    // Appendix: full indexed text of every slug shown (select-only).
    out.push('## Appendix: indexed source text', '');
    const { data: docs, error } = await sb.from('documents').select('id, title, slug, client_name, vimeo_url, hero_video_url').eq('doc_type', 'case_study');
    if (error) throw error;
    const vids = new Set(rounds.flatMap(videoUrls));
    const wanted = (docs ?? []).filter((d: any) => slugsShown.has(d.slug) || [...vids].some(v => v && (v === d.hero_video_url || v === d.vimeo_url)));
    for (const d of wanted as any[]) {
      const { data: chunks, error: e } = await sb.from('content_chunks').select('chunk_index, content').eq('document_id', d.id).order('chunk_index');
      if (e) throw e;
      const tag = async (table: string, rel: string) => {
        const { data } = await sb.from(table).select(`${rel}(name)`).eq('document_id', d.id);
        return ((data ?? []) as any[]).map(x => x[rel]?.name).filter(Boolean).join(', ');
      };
      out.push(`### ${d.slug}`, '', `Title: ${d.title}; client: ${d.client_name}; hero_video_url: ${d.hero_video_url ?? 'none'}; vimeo_url: ${d.vimeo_url ?? 'none'}`,
        `DB capabilities: ${await tag('document_capabilities', 'capabilities')}; DB industries: ${await tag('document_industries', 'industries')}`, '');
      for (const c of chunks ?? []) out.push(`[chunk ${c.chunk_index}] ${c.content}`, '');
    }
    fs.writeFileSync(path.join(dir, 'CHECK.md'), out.join('\n'));
    console.log(`${id}: wrote CHECK.md (${rounds.length} rounds)`);
  }
}

async function main() {
  const ids = (argValue('--ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) { console.error('--ids required'); process.exit(2); }
  if (hasFlag('--sheet')) return buildSheets(ids);
  const round = Number(argValue('--round'));
  if (!Number.isInteger(round) || round < 1) { console.error('--round <n> required'); process.exit(2); }
  await runRound(argValue('--base-url') ?? DEFAULT_BASE_URL, ids, round);
}

main().catch(e => { console.error(e); process.exit(1); });
