/**
 * Shared concierge behaviour rules, imported by the app prompt (src/lib/orchestrator.ts)
 * and the eval rubric (eval/rubric.ts) so the two cannot drift.
 * Changing a value here changes what the live concierge is told to do.
 */
export type StrategyLeadTrigger = 'no_context' | 'fallback' | 'pricing' | 'timeline';

export interface ConciergeConfig {
  layout: { typicalMinComponents: number; typicalMaxComponents: number; maxComponents: number };
  followUps: { min: number; max: number };
  strategyLead: { name: string; offerOn: readonly StrategyLeadTrigger[] };
}

export const CONCIERGE_CONFIG: ConciergeConfig = {
  layout: { typicalMinComponents: 4, typicalMaxComponents: 8, maxComponents: 10 },
  followUps: { min: 2, max: 3 },
  // Current app behaviour, kept in Phase 1: the Strategy Lead is offered only when retrieval returns nothing.
  // Phase 4 (GEN-06) is expected to add 'fallback', 'pricing' and 'timeline'.
  strategyLead: { name: 'Strategy Lead', offerOn: ['no_context'] },
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
