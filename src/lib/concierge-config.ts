/**
 * Shared concierge behaviour rules, imported by the app prompt (src/lib/orchestrator.ts)
 * and the eval rubric (eval/rubric.ts) so the two cannot drift.
 * Changing a value here changes what the live concierge is told to do.
 * Also holds the retrieval caps/RRF settings and the teaser policy (prompt and rubric text derive from it).
 */
export type StrategyLeadTrigger = 'no_context' | 'fallback' | 'pricing' | 'timeline' | 'invention_bait';

export type KeywordTrigger = 'pricing' | 'timeline';

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

export interface VerifierConfig {
  enabled: boolean;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  maxDocChars: number;
}

export interface InstantTeaserConfig {
  count: number;
  semanticFloor: number;
  claimPattern: RegExp;
}

export type GenerationMode = 'default' | 'between_tools' | 'adaptive_effort';
export type GenerationEffort = 'low' | 'medium' | 'high';
export interface GenerationConfig {
  mode: GenerationMode;
  effort: GenerationEffort | null;
}

export interface HeroPassConfig {
  enabled: boolean;
  effort: GenerationEffort;
  maxTokens: number;
}

export interface HealthConfig {
  warnBelowUsd: number;
  startupTimeoutMs: number;
  requestTimeoutMs: number;
}

export interface ConciergeConfig {
  layout: { typicalMinComponents: number; typicalMaxComponents: number; maxComponents: number };
  followUps: { min: number; max: number };
  strategyLead: {
    name: string;
    offerOn: readonly StrategyLeadTrigger[];
    keywords: Record<KeywordTrigger, readonly string[]>;
  };
  retrieval: RetrievalConfig;
  teasers: { policy: TeaserPolicy };
  narrative: { minSentences: number; maxSentences: number };
  honesty: { admitNoDirectWork: boolean };
  video: { queryKeywords: readonly string[] };
  videos: { unplayableUrls: readonly string[] };
  verifier: VerifierConfig;
  instantTeasers: InstantTeaserConfig;
  generation: GenerationConfig;
  heroPass: HeroPassConfig;
  health: HealthConfig;
}

export const CONCIERGE_CONFIG: ConciergeConfig = {
  layout: { typicalMinComponents: 4, typicalMaxComponents: 8, maxComponents: 10 },
  followUps: { min: 2, max: 3 },
  // D-411 (Phase 4, GEN-06): offered on these triggers; prompt and rubric text derive from this list.
  strategyLead: {
    name: 'Strategy Lead',
    offerOn: ['no_context', 'fallback', 'pricing', 'timeline', 'invention_bait'],
    keywords: {
      pricing: ['price', 'prices', 'pricing', 'cost', 'costs', 'charge', 'charges', 'fee', 'fees', 'budget', 'budgets', 'rate card', 'quote', 'quotes', 'how much', 'afford'],
      timeline: ['timeline', 'timelines', 'timeframe', 'turnaround', 'how long', 'how fast', 'how soon', 'how quickly', 'weeks', 'lead time'],
    },
  },
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
  // D-407
  narrative: { minSentences: 2, maxSentences: 4 },
  // GEN-01 config flag (STATE decision "assumed yes")
  honesty: { admitNoDirectWork: true },
  video: { queryKeywords: ['video', 'videos', 'film', 'films', 'filmed', 'documentary', 'animation', 'animated', 'motion'] },
  // Private/deleted on Vimeo: player.vimeo.com 403, oEmbed 404 as of 2026-11-24. Hidden in code; DB rows unchanged.
  videos: { unplayableUrls: ['https://vimeo.com/1030871091', 'https://vimeo.com/877614456'] },
  // D-417/D-420 (GEN-07): Haiku 5.5 claim-check via OpenRouter. Default OFF; ships enabled only after user approval. VERIFIER_ENABLED env overrides.
  verifier: { enabled: false, model: 'claude-haiku-5-5', timeoutMs: 6000, maxTokens: 2000, maxDocChars: 2000 },
  // D-501/D-504 (Phase 5): floor 0.40 + claim pattern + isAboutAG + zero case studies (user answer 3). Phase 4 calibration: 0.40 suppresses 19/21 fallback, 5/5 bait, 4/29 direct; 0.45: 20/21, 5/5, 8/29.
  instantTeasers: {
    count: 3,
    semanticFloor: 0.40,
    claimPattern:
      /\b(?:I heard|I understand|I was told|told me|said)\b[\s\S]{0,60}?\b(?:you did|ran|handled|built|made|worked|launched|created|designed|led|produced|delivered)\b/i,
  },
  // PERF-02 (user answer 1): thinking mode knob shared by orchestrate() and orchestrateStream(); 'default' sends no params (Phase 4 behaviour). Chosen by eval/stream-timing.ts, gated by the D-513 eval; revert to 'default' on regression. Model stays Sonnet 5.5. 05-08: adaptive_effort:low won in eval/results/stream-timing-2026-11-23T18-20-20 (median t_hero_first 1438 ms vs 12299 ms default).
  // 05-09: REVERTED to default. adaptive_effort:low failed 4 D-513 gates in run 2026-11-23T19-00-37 (unsupported-claim responses 16 vs <= 6, voice 4.02 vs >= 4.28, capability_not_shown 1 vs 0, teasers_zero_expected_mean 1.80 vs <= 1.7). The revert is unmeasured: no eval was re-run (budget).
  generation: { mode: 'default', effort: null },
  // PERF-02 hero pass (perf-02-hero-speed debug): a second, low-effort Sonnet 5.5 call writes ONLY the HeroBlock (aborted after hero_done)
  // while the default-thinking call writes the rest. The fast hero is what the user sees and what `final` carries, so no flash and no mismatch.
  // Sonnet 5 has adaptive-only thinking (budget_tokens and reasoning.max_tokens ignored, OpenRouter docs), so a capped budget does not exist;
  // low effort emits no thinking (05-TIMING.md). HERO_PASS_ENABLED=false turns it off.
  heroPass: { enabled: true, effort: 'low', maxTokens: 700 },
  // D-517: warn below $5 (about one eval run); fail at <= $0, bad/missing key or non-OpenRouter route. eval/preflight's EVAL_MIN_CREDIT_USD is a per-run minimum and stays separate.
  health: { warnBelowUsd: 5, startupTimeoutMs: 3000, requestTimeoutMs: 5000 },
};

// D-421: the prompt's worked example is fictional; the rubric treats these names as invention markers.
export const FICTIONAL_EXAMPLE = {
  client: 'Larkspur Bank',
  slug: 'larkspur-bank-brand-platform',
  title: 'Larkspur Bank: A Brand Platform for a Digital Lender',
} as const;

export const STRATEGY_LEAD_TRIGGER_DESCRIPTIONS: Record<StrategyLeadTrigger, string> = {
  no_context:
    'retrieval returned no case studies, articles, visual assets or metrics (the concierge was shown "NO RELEVANT CONTENT FOUND")',
  fallback: 'the retrieved work is not directly relevant to what the user asked for',
  pricing: 'the user asks about price, cost, fees or budget',
  timeline: 'the user asks about timelines, speed, or how soon AG can start',
  invention_bait:
    'the user asserts or presupposes that AG did a specific engagement, worked with a specific client, or achieved a specific result that the retrieved context does not show',
};

export function narrativeRule(): string {
  const { minSentences, maxSentences } = CONCIERGE_CONFIG.narrative;
  return `Write the narrative in ${minSentences}-${maxSentences} sentences, never more than ${maxSentences}. Count every sentence before the follow-up questions, including any honest gap line and the Strategy Lead offer.`;
}

export function strategyLeadPromptRule(): string {
  const { name, offerOn } = CONCIERGE_CONFIG.strategyLead;
  return `Offer a conversation with our ${name} in ONE closing sentence of the narrative, using the name "${name}" (for example: "Our ${name} can scope this with you."), when ${offerOn.map(t => STRATEGY_LEAD_TRIGGER_DESCRIPTIONS[t]).join('; or when ')}. On a good direct match where none of these applies, do not mention the ${name}: the follow-up questions are the next step.`;
}

export function pricingTimelineRule(): string {
  const { name } = CONCIERGE_CONFIG.strategyLead;
  return `When the user asks about price, cost, fees, budget, timelines or speed: never give figures (no amounts of money, no numbers of days, weeks or months, no dates). Say it depends on scope, name what drives it only if the retrieved content supports that, and offer our ${name}.`;
}

function escapeRe(w: string): string {
  return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordMatcher(words: readonly string[]): RegExp {
  const alts = words.map(w => w.split(/\s+/).map(escapeRe).join('\\s+'));
  return new RegExp('\\b(' + alts.join('|') + ')\\b', 'i');
}

export function keywordTriggers(query: string): KeywordTrigger[] {
  const out: KeywordTrigger[] = [];
  for (const t of ['pricing', 'timeline'] as const) {
    if (wordMatcher(CONCIERGE_CONFIG.strategyLead.keywords[t]).test(query)) out.push(t);
  }
  return out;
}

export function isVideoQuery(query: string): boolean {
  return wordMatcher(CONCIERGE_CONFIG.video.queryKeywords).test(query);
}

/** VERIFIER_ENABLED env overrides the config default. */
export function verifierEnabled(): boolean {
  return process.env.VERIFIER_ENABLED
    ? process.env.VERIFIER_ENABLED === 'true'
    : CONCIERGE_CONFIG.verifier.enabled;
}

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

// GEN-01: admitting AG hasn't done a kind of work is the honesty.admitNoDirectWork flag (default true).
export function noDirectMatchPrompt(
  policy: TeaserPolicy = CONCIERGE_CONFIG.teasers.policy,
  admit: boolean = CONCIERGE_CONFIG.honesty.admitNoDirectWork,
): { intro: string; rule: string } {
  if (policy === 'all_retrieved') {
    return {
      intro: 'Instead of saying "We don\'t have TikTok-specific case studies", reframe positively:',
      rule: 'NEVER say: "We don\'t currently have X case studies"\nINSTEAD say: "Your challenge is really about [broader capability], and here\'s how we\'ve approached similar problems..."',
    };
  }
  if (!admit) {
    return {
      intro: 'If no retrieved case study directly matches, be honest about it, then reframe positively:',
      rule: 'If AG has no directly matching work, say: "Your challenge is really about [broader capability], and here\'s how we\'ve approached similar problems..." Showing adjacent work is allowed but not required; never present it as a direct match.',
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

const GENERATION_MODES: readonly GenerationMode[] = ['default', 'between_tools', 'adaptive_effort'];
const GENERATION_EFFORTS: readonly GenerationEffort[] = ['low', 'medium', 'high'];

/** GENERATION_MODE / GENERATION_EFFORT env override the config; invalid values are ignored. */
export function generationConfig(): GenerationConfig {
  const base = CONCIERGE_CONFIG.generation;
  const m = process.env.GENERATION_MODE as GenerationMode | undefined;
  const e = process.env.GENERATION_EFFORT as GenerationEffort | undefined;
  return {
    mode: m && GENERATION_MODES.includes(m) ? m : base.mode,
    effort: e && GENERATION_EFFORTS.includes(e) ? e : base.effort,
  };
}

/** Extra model-request params for the thinking mode. 'default' sends nothing (byte-identical to Phase 4). */
export function generationParams(g: GenerationConfig = generationConfig()): Record<string, unknown> {
  if (g.mode === 'between_tools') {
    const out: Record<string, unknown> = { thinking: { type: 'between_tools' } };
    if (g.effort) out.output_config = { effort: g.effort };
    return out;
  }
  if (g.mode === 'adaptive_effort') {
    return { output_config: { effort: g.effort ?? 'medium' } };
  }
  return {};
}

/** HERO_PASS_ENABLED env overrides the config default. */
export function heroPassEnabled(): boolean {
  return process.env.HERO_PASS_ENABLED
    ? process.env.HERO_PASS_ENABLED === 'true'
    : CONCIERGE_CONFIG.heroPass.enabled;
}

/** Appended to the user turn of the hero pass only. The honesty clauses mirror the HONESTY RULES for the one block this pass writes. */
export function heroPassInstruction(): string {
  return `

FAST OPENING PASS: output ONLY the opening \`\`\`json block with a layout array that holds just the HeroBlock, then stop. Do not write any other component, the narrative or the follow-up questions; another pass writes them.
The HeroBlock states the user's challenge or opportunity in their own terms, as a headline about THEM. It must hold under the HONESTY RULES, and it is written before the rest of the answer, so it makes no claim about us at all:
- Title and subtitle name the topic or the user's situation. They never describe our experience, clients, industries, seniority, scale or results (no "X work", "X experience", "our work with", "senior-level partnership", "Fortune 100"). Bad: "Senior-level work for global retailers". Good: "Choosing comparable work for a global retailer".
- Anything the user says or assumes about us ("X experience", "the campaign you did") is their question, not a fact. Keep it out of the title and subtitle, and never put a client, brand or project name the user attributes to us there. In the challengeSummary it may appear only as what they are asking about ("You're asking about...").
- Do not add facts the user did not give (company size or status, deadlines, audience traits, budget).`;
}

export function generationConfigKey(g: GenerationConfig = generationConfig()): string {
  return JSON.stringify({ mode: g.mode, effort: g.effort });
}

const VIMEO_ID_PATTERNS = [
  /vimeo\.com\/(\d+)/,
  /player\.vimeo\.com\/video\/(\d+)/,
  /vimeo\.com\/channels\/[\w-]+\/(\d+)/,
  /vimeo\.com\/groups\/[\w-]+\/videos\/(\d+)/,
];

export function vimeoIdOf(url: string): string | null {
  for (const p of VIMEO_ID_PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const normalizeVideoUrl = (url: string): string =>
  url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[?#]/)[0].replace(/\/+$/, '');

export function isPlayableVideoUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false;
  const bad = CONCIERGE_CONFIG.videos.unplayableUrls;
  const id = vimeoIdOf(url);
  if (id) return !bad.some(b => vimeoIdOf(b) === id);
  const n = normalizeVideoUrl(url);
  return !bad.some(b => normalizeVideoUrl(b) === n);
}
