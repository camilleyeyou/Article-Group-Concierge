/**
 * Article Group AI Concierge - Case-study catalogue (RETR-04)
 *
 * A deterministic list of every retrievable case study, sent as a cached
 * system-prompt prefix so the model knows what the portfolio contains.
 * It carries no goals, outcomes or metrics: facts come from retrieved context only.
 */

import { createHash } from 'node:crypto';
import { supabase } from './supabase';
import { RAGLogger } from './logger';

export interface CatalogueRow {
  slug: string;
  title: string;
  client: string | null;
  capabilities: string[];
  industries: string[];
  hasVideo: boolean;
  deliverables: string | null;
}

export interface CatalogueTags {
  capabilities: string[];
  industries: string[];
}

/** tagsBySlug feeds GEN-03 server-side teaser tags (DB links, D-07 strict tagging). */
export interface Catalogue {
  text: string;
  version: string;
  tagsBySlug: Map<string, CatalogueTags>;
  /** Raw DB deliverables line per slug (PERF-01 instant teasers apply the digit filter themselves). */
  deliverablesBySlug: Map<string, string | null>;
}

const sortEn = (a: string, b: string) => a.localeCompare(b, 'en');

export function tagsBySlug(rows: CatalogueRow[]): Map<string, CatalogueTags> {
  const m = new Map<string, CatalogueTags>();
  for (const r of rows) {
    m.set(r.slug, { capabilities: [...r.capabilities].sort(sortEn), industries: [...r.industries].sort(sortEn) });
  }
  return m;
}

export function deliverablesBySlug(rows: CatalogueRow[]): Map<string, string | null> {
  return new Map(rows.map(r => [r.slug, r.deliverables] as [string, string | null]));
}

export const CATALOGUE_RULE = `## AG PORTFOLIO CATALOGUE
Every case study in Article Group's indexed portfolio, sorted by slug. Use it to know what work exists: never say AG lacks a kind of work that a study listed here shows. It is NOT evidence of outcomes, results or metrics. Facts about a study, any outcome or metric, and every CaseStudyTeaser must come only from the RETRIEVED CONTEXT in the user message. If a catalogue study fits the request but was not retrieved, you may name it as related work, but don't describe its results or make a teaser for it.`;

/** First "Solution included ..." sentence, or null. */
export function extractDeliverables(text: string): string | null {
  const m = text.match(/Solution included[^.]*\./i);
  return m ? m[0].trim() : null;
}

export function formatCatalogue(rows: CatalogueRow[]): string {
  const sorted = [...rows].sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
  const lines = sorted.map(r => {
    const caps = [...r.capabilities].sort((a, b) => a.localeCompare(b, 'en'));
    const inds = [...r.industries].sort((a, b) => a.localeCompare(b, 'en'));
    const deliv = r.deliverables && !/\d/.test(r.deliverables) ? r.deliverables : null;
    return `- ${r.title} | client: ${r.client ?? 'n/a'} | slug: ${r.slug} | capabilities: ${caps.join(', ') || 'n/a'} | industries: ${inds.join(', ') || 'n/a'} | video: ${r.hasVideo ? 'yes' : 'no'}${deliv ? ` | deliverables: ${deliv}` : ''}`;
  });
  return `${CATALOGUE_RULE}\n\n${rows.length} case studies:\n${lines.join('\n')}\n`;
}

export function catalogueVersion(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

const TTL_MS = 60 * 60 * 1000;
let memo: { value: Catalogue; loadedAt: number } | null = null;

/** Timings of the last cold load (PERF-01 measurement only). */
export const lastCatalogueLoad: { docs?: number; chunks?: number; chunkPages?: number; caps?: number; inds?: number; total?: number } = {};
export const catalogueIsCold = () => !(memo && Date.now() - memo.loadedAt < TTL_MS);

async function loadRows(): Promise<CatalogueRow[]> {
  const tStart = performance.now();
  const since = () => Math.round(performance.now() - tStart);
  // The four reads are independent: run them concurrently (the chunk pages stay sequential
  // within their own chain because each page's size decides whether another follows).
  const docsQ = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, slug, client_name, vimeo_url')
      .eq('doc_type', 'case_study')
      .order('slug');
    if (error) throw error;
    lastCatalogueLoad.docs = since();
    return data;
  };

  // Only embedded (retrievable) chunks; page past the 1000-row API default
  const chunksQ = async () => {
    const out: any[] = [];
    let pages = 0;
    for (let from = 0; ; from += 1000) {
      pages++;
      const { data, error: cErr } = await supabase
        .from('content_chunks')
        .select('document_id, chunk_index, content')
        .not('embedding', 'is', null)
        .order('document_id')
        .order('chunk_index')
        .range(from, from + 999);
      if (cErr) throw cErr;
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    lastCatalogueLoad.chunks = since();
    lastCatalogueLoad.chunkPages = pages;
    return out;
  };

  const dcsQ = async () => {
    const { data, error } = await supabase
      .from('document_capabilities')
      .select('document_id, capabilities(name)')
      .order('document_id');
    if (error) throw error;
    lastCatalogueLoad.caps = since();
    return data;
  };

  const disQ = async () => {
    const { data, error } = await supabase
      .from('document_industries')
      .select('document_id, industries(name)')
      .order('document_id');
    if (error) throw error;
    lastCatalogueLoad.inds = since();
    return data;
  };

  const [docs, chunks, dcs, dis] = await Promise.all([docsQ(), chunksQ(), dcsQ(), disQ()]);

  lastCatalogueLoad.total = since();
  const byDoc = new Map<string, string[]>();
  const embedded = new Set<string>();
  for (const c of chunks) {
    embedded.add(c.document_id);
    const arr = byDoc.get(c.document_id) ?? [];
    arr.push(c.content ?? '');
    byDoc.set(c.document_id, arr);
  }
  const names = (rows: any[] | null, key: string) => {
    const m = new Map<string, string[]>();
    for (const r of rows ?? []) {
      const n = r[key]?.name;
      if (!n) continue;
      const arr = m.get(r.document_id) ?? [];
      arr.push(n);
      m.set(r.document_id, arr);
    }
    return m;
  };
  const caps = names(dcs as any[], 'capabilities');
  const inds = names(dis as any[], 'industries');

  return ((docs ?? []) as any[])
    .filter(d => embedded.has(d.id))
    .map(d => ({
      slug: d.slug,
      title: d.title,
      client: d.client_name ?? null,
      capabilities: caps.get(d.id) ?? [],
      industries: inds.get(d.id) ?? [],
      hasVideo: Boolean(d.vimeo_url),
      deliverables: extractDeliverables((byDoc.get(d.id) ?? []).join(' ')),
    }));
}

/** Memoised (1h). Never throws: returns the last good value or null. */
export async function getCatalogue(): Promise<Catalogue | null> {
  if (memo && Date.now() - memo.loadedAt < TTL_MS) return memo.value;
  try {
    const rows = await loadRows();
    const text = formatCatalogue(rows);
    memo = { value: { text, version: catalogueVersion(text), tagsBySlug: tagsBySlug(rows), deliverablesBySlug: deliverablesBySlug(rows) }, loadedAt: Date.now() };
    return memo.value;
  } catch (e) {
    RAGLogger.error('Catalogue load failed', e);
    return memo?.value ?? null;
  }
}
