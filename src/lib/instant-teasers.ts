/**
 * PERF-01 instant teasers (D-501, D-502, D-504).
 * Honest from the first frame: DB text only; the model's summaries replace these when they arrive (D-502).
 * Suppression per D-504 and user answer 3; known miss p4-q03 (fallback-expected, max semantic 0.639).
 * Pure module: type-only import from ./catalogue so tests never load Supabase.
 */
import type { Catalogue } from './catalogue';
import { isAboutAG } from './intent-keywords';
import { CONCIERGE_CONFIG } from './concierge-config';
import type { InstantTeaser, SuppressReason } from './stream-events';
import type { HybridSearchResult } from '../types';

export type InstantCatalogue = Pick<Catalogue, 'tagsBySlug' | 'deliverablesBySlug'>;

export interface InstantTeaserDecision {
  teasers: InstantTeaser[];
  suppressed: SuppressReason | null;
  maxSemantic: number | null;
}

/** Deliverables line verbatim; dropped when it contains a digit (same rule as formatCatalogue). */
export function instantSummary(deliverables: string | null | undefined): string | undefined {
  if (!deliverables || /\d/.test(deliverables)) return undefined;
  return deliverables;
}

const caseStudies = (chunks: readonly HybridSearchResult[]) => chunks.filter(c => c.document_type === 'case_study');

export function maxCaseStudySemantic(chunks: readonly HybridSearchResult[]): number | null {
  const cs = caseStudies(chunks);
  if (cs.length === 0) return null;
  return Math.max(...cs.map(c => c.similarity_score));
}

export function matchesPriorWorkClaim(query: string, pattern: RegExp = CONCIERGE_CONFIG.instantTeasers.claimPattern): boolean {
  return pattern.test(query);
}

export function suppressionReason(
  query: string,
  chunks: readonly HybridSearchResult[],
  opts: { floor?: number } = {},
): SuppressReason | null {
  const max = maxCaseStudySemantic(chunks);
  if (max === null) return 'no_case_studies';
  if (isAboutAG(query)) return 'about_ag';
  if (matchesPriorWorkClaim(query)) return 'claim_pattern';
  if (max < (opts.floor ?? CONCIERGE_CONFIG.instantTeasers.semanticFloor)) return 'score_floor';
  return null;
}

export function buildInstantTeasers(
  chunks: readonly HybridSearchResult[],
  catalogue: InstantCatalogue | null,
  count: number = CONCIERGE_CONFIG.instantTeasers.count,
): InstantTeaser[] {
  const out: InstantTeaser[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    if (out.length >= count) break;
    if (c.document_type !== 'case_study' || seen.has(c.slug)) continue;
    seen.add(c.slug);
    const t: InstantTeaser = { title: c.document_title, slug: c.slug };
    if (c.client_name) t.clientName = c.client_name;
    if (c.thumbnail_url) t.thumbnailUrl = c.thumbnail_url;
    const tags = catalogue?.tagsBySlug.get(c.slug);
    if (tags?.capabilities.length) t.capabilities = tags.capabilities;
    if (tags?.industries.length) t.industries = tags.industries;
    const summary = instantSummary(catalogue?.deliverablesBySlug.get(c.slug));
    if (summary) t.summary = summary;
    out.push(t);
  }
  return out;
}

export function decideInstantTeasers(
  query: string,
  chunks: readonly HybridSearchResult[],
  catalogue: InstantCatalogue | null,
  opts: { floor?: number; count?: number } = {},
): InstantTeaserDecision {
  const maxSemantic = maxCaseStudySemantic(chunks);
  const suppressed = suppressionReason(query, chunks, { floor: opts.floor });
  if (suppressed) return { teasers: [], suppressed, maxSemantic };
  return { teasers: buildInstantTeasers(chunks, catalogue, opts.count), suppressed: null, maxSemantic };
}
