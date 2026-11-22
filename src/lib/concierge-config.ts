/**
 * Shared concierge behaviour rules, imported by the app prompt (src/lib/orchestrator.ts)
 * and the eval rubric (eval/rubric.ts) so the two cannot drift.
 * Changing a value here changes what the live concierge is told to do.
 * Also holds the retrieval caps/RRF settings and the teaser policy (prompt and rubric text derive from it).
 */
export type StrategyLeadTrigger = 'no_context' | 'fallback' | 'pricing' | 'timeline';

export type TeaserPolicy = 'all_retrieved' | 'relevant_only';

export interface RetrievalConfig {
  maxCaseStudies: number;
  maxArticles: number;
  matchCount: number;
  rrfK: number;
  intentBoost: number;
  rerank: RerankConfig;
}

export interface RerankConfig {
  enabled: boolean;
  provider: 'cohere' | 'haiku';
  model: string;
  haikuModel: string;
  semanticPool: number;
  keywordPool: number;
  /** Used only if the case-study chunk count cannot be read; not assumed to cover the corpus. */
  matchCountFallback: number;
  timeoutMs: number;
  haikuTimeoutMs: number;
  haikuMaxDocChars: number;
  maxDocChars: number;
}

export interface ConciergeConfig {
  layout: { typicalMinComponents: number; typicalMaxComponents: number; maxComponents: number };
  followUps: { min: number; max: number };
  strategyLead: { name: string; offerOn: readonly StrategyLeadTrigger[] };
  retrieval: RetrievalConfig;
  teasers: { policy: TeaserPolicy };
}

export const CONCIERGE_CONFIG: ConciergeConfig = {
  layout: { typicalMinComponents: 4, typicalMaxComponents: 8, maxComponents: 10 },
  followUps: { min: 2, max: 3 },
  // Current app behaviour, kept in Phase 1: the Strategy Lead is offered only when retrieval returns nothing.
  // Phase 4 (GEN-06) is expected to add 'fallback', 'pricing' and 'timeline'.
  strategyLead: { name: 'Strategy Lead', offerOn: ['no_context'] },
  // intentBoost 0.003 is about +10 ranks at k=60; 0 disables the boost.
  retrieval: {
    // D-305 gap closure (2026-11-22): cap8 chosen by offline bake-off, 47/52 frozen offline; see 03-BAKEOFF.md.
    // Supersedes the D-302 cap of 6; teasers stay relevant_only.
    maxCaseStudies: 8,
    maxArticles: 2,
    matchCount: 60,
    rrfK: 60,
    intentBoost: 0.003,
    // RETR-06 (D-303): Cohere reranker via OpenRouter. Built and measured in 03-08 (44/52 vs 43/52,
    // ~0.9 s p50 latency); the user chose to keep it OFF. Re-enable here or with RERANK_ENABLED=true.
    rerank: {
      // D-305 bake-off: provider 'haiku' = listwise rerank via anthropic/claude-haiku-5.5 (OpenRouter slug verified 2026-11-22)
      enabled: false,
      provider: 'cohere',
      model: 'cohere/rerank-5-fast',
      haikuModel: 'claude-haiku-5-5',
      semanticPool: 15,
      keywordPool: 10,
      matchCountFallback: 250,
      timeoutMs: 4000,
      haikuTimeoutMs: 4000,
      haikuMaxDocChars: 1200,
      maxDocChars: 2000,
    },
  },
  teasers: { policy: 'relevant_only' },
};

export const STRATEGY_LEAD_TRIGGER_DESCRIPTIONS: Record<StrategyLeadTrigger, string> = {
  no_context:
    'retrieval returned no case studies, articles, visual assets or metrics (the concierge was shown "NO RELEVANT CONTENT FOUND")',
  fallback: 'the retrieved work is not directly relevant to what the user asked for',
  pricing: 'the user asks about price, cost, fees or budget',
  timeline: 'the user asks about timelines, speed, or how soon AG can start',
};

export function componentCountRule(): string {
  const { typicalMinComponents, typicalMaxComponents, maxComponents } = CONCIERGE_CONFIG.layout;
  return `Typical deck: ${typicalMinComponents}-${typicalMaxComponents} components, never exceed ${maxComponents}`;
}

export function followUpInstruction(): string {
  const { min, max } = CONCIERGE_CONFIG.followUps;
  return `Suggest ${min}-${max} follow-up questions the user might want to explore.`;
}

export function noContextMessage(): string {
  return `No case studies or assets matched this query. Please direct the user to contact our ${CONCIERGE_CONFIG.strategyLead.name} for a personalized consultation.`;
}

export function isNoContext(ctx: {
  chunks: readonly unknown[];
  visualAssets: readonly unknown[];
  relatedMetrics: readonly unknown[];
}): boolean {
  return ctx.chunks.length === 0 && ctx.visualAssets.length === 0 && ctx.relatedMetrics.length === 0;
}

export function teaserPromptRule(policy: TeaserPolicy = CONCIERGE_CONFIG.teasers.policy): string {
  if (policy === 'all_retrieved') {
    return 'If case studies are in context, include a CaseStudyTeaser for each one.';
  }
  return 'Include a CaseStudyTeaser only for retrieved case studies that genuinely match the request. Showing 1-3 teasers, or none with an honest note that AG has no directly matching work, is correct when that is what exists. Never pad the layout with case studies that do not fit, and never present adjacent work as a direct match.';
}

export function teaserRubricText(policy: TeaserPolicy = CONCIERGE_CONFIG.teasers.policy): string {
  if (policy === 'all_retrieved') return 'a CaseStudyTeaser for retrieved case studies';
  const { typicalMinComponents } = CONCIERGE_CONFIG.layout;
  return `a CaseStudyTeaser for each retrieved case study that matches the query (omitting retrieved case studies that do not match is correct, not a violation; fewer than ${typicalMinComponents} components because few studies match is not a violation; showing a non-matching study as if it matched is a violation)`;
}

// Admitting AG hasn't done a kind of work is assumed YES (STATE decision); Phase 4 GEN-01 turns it into its own flag.
export function noDirectMatchPrompt(policy: TeaserPolicy = CONCIERGE_CONFIG.teasers.policy): { intro: string; rule: string } {
  if (policy === 'all_retrieved') {
    return {
      intro: 'Instead of saying "We don\'t have TikTok-specific case studies", reframe positively:',
      rule: 'NEVER say: "We don\'t currently have X case studies"\nINSTEAD say: "Your challenge is really about [broader capability], and here\'s how we\'ve approached similar problems..."',
    };
  }
  return {
    intro: 'If no retrieved case study directly matches, be honest about it, then reframe positively:',
    rule: 'If AG has no directly matching work, say so plainly in one short sentence (for example: "We haven\'t published a TikTok-specific case study."). Do not dwell on it or apologise. Then say: "Your challenge is really about [broader capability], and here\'s how we\'ve approached similar problems..." Showing adjacent work is allowed but not required; never present it as a direct match.',
  };
}

export function fallbackRubricText(policy: TeaserPolicy = CONCIERGE_CONFIG.teasers.policy): string {
  if (policy === 'all_retrieved') {
    return 'the prompt tells the concierge to reframe positively and still show case studies, so showing adjacent work is allowed.';
  }
  return 'the prompt tells the concierge to say plainly that AG has no directly matching work and then reframe positively; showing adjacent work (labelled as adjacent) is allowed, not required, and an honest note with no case studies is acceptable.';
}

/** Stable string of the retrieval settings, for cache keys. */
/** RERANK_ENABLED env overrides the config default (lets offline runs measure with production disabled). */
export function rerankEnabled(): boolean {
  return process.env.RERANK_ENABLED
    ? process.env.RERANK_ENABLED === 'true'
    : CONCIERGE_CONFIG.retrieval.rerank.enabled;
}

export function retrievalConfigKey(r: RetrievalConfig = CONCIERGE_CONFIG.retrieval): string {
  return JSON.stringify({
    maxCaseStudies: r.maxCaseStudies,
    maxArticles: r.maxArticles,
    matchCount: r.matchCount,
    rrfK: r.rrfK,
    intentBoost: r.intentBoost,
    rerank: rerankEnabled() ? r.rerank : false,
  });
}
