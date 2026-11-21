/**
 * The grader's rubric, output schema and prompt builder, shared by every grader
 * (Opus primary, second-opinion grader) so they all see the identical task.
 *
 * The grader sees what the concierge saw: the query and the retrieved context.
 * It does not see the persona, the expected block or the query type.
 * Rules that also live in the app prompt (component count, Strategy Lead) are
 * rendered from src/lib/concierge-config.ts so the two cannot drift.
 */

import { SYSTEM_PROMPT as CONCIERGE_PROMPT } from '../src/lib/orchestrator';
import { CONCIERGE_CONFIG, STRATEGY_LEAD_TRIGGER_DESCRIPTIONS, componentCountRule } from '../src/lib/concierge-config';
import {
  CLAIM_KINDS,
  CRITERIA,
  type AutomatedChecks,
  type ClaimKind,
  type Criterion,
  type CriterionScore,
  type RunRecord,
} from './lib';

export const HARNESS_VERSION = 2; // 1 = baseline harness at a5b2722

export function strategyLeadRubricText(): string {
  const L = CONCIERGE_CONFIG.strategyLead;
  const enabled = L.offerOn.map(t => STRATEGY_LEAD_TRIGGER_DESCRIPTIONS[t]).join('; or when ');
  return `Offering a conversation with the ${L.name} is REQUIRED only when ${enabled}. The AUTOMATED CHECKS field strategy_lead_expected tells you whether the no-context case applies. In every other case the ${L.name} offer is optional: do not lower any score because it is missing.`;
}

const { layout, followUps, strategyLead } = CONCIERGE_CONFIG;

export const RUBRIC = `You are a strict, fair evaluator of the Article Group AI Concierge: a RAG chatbot that answers prospective clients by retrieving AG case studies (client work) and articles (AG's thinking) and assembling a JSON "pitch deck" layout plus a short narrative. You see what the concierge saw: the user's query and the retrieved context. Nothing is known about the user beyond the query.

Below is the concierge's own system prompt. Use it as the reference for the component registry, its rules, and the intended brand voice. Its NeoBank example is FICTIONAL - if a response mentions NeoBank or "+340% brand awareness", that is an invention.

<concierge_system_prompt>
${CONCIERGE_PROMPT}
</concierge_system_prompt>

Score each criterion from 1 (bad) to 5 (excellent) with a one-line reason that cites the specific evidence.

## grounded
Every factual claim about AG and its work must be supported by the RETRIEVED CONTEXT: client names, case study titles, deliverables, outcomes, metrics, awards, and claims of having done a kind of work. General strategic advice and opinion are not factual claims. Brands mentioned inside ARTICLES are not AG clients - presenting them as AG work is unsupported. A response that confirms or describes a client/project/result the user asked about that is not in context is an invention.
5 = everything supported. 4 = minor stretch in paraphrase, no invented specifics. 3 = one unsupported specific detail (e.g. a deliverable) but no invented client, case study, metric or outcome. 2 = an invented metric, client, case study, outcome, or non-AG work attributed to AG. 1 = several inventions or largely fabricated.
List every unsupported claim in \`claims\`, each as {claim, kind}, choosing the single best-fitting kind:
- goal_as_result: a goal, aim, brief or intended outcome stated in the context is presented as an achieved result (context: 'Salt wanted to keep its leadership position'; response: 'Salt held its position').
- capability_not_shown: the response says or implies AG offers or has done a kind of work (a service, deliverable type, channel, industry or platform build) that no retrieved CASE STUDY shows. Articles show AG's thinking, not proof of capability.
- generated_tags: a CaseStudyTeaser \`capabilities\` or \`industries\` value that the retrieved content for that case study does not state.
- other: any other unsupported claim (invented client, case study, metric, deliverable, audience detail or outcome, or confirming an engagement the user asserted that is not in the context).
Empty list if none.
Numbers: values that express the same quantity in a different format are supported ('8M+' = 'over 8 million' = '8,000,000'; '40%' = '40 percent'; '3x' = 'three times'). List a number only when the quantity itself differs from, or is absent from, the context.

## components
Valid JSON layout block; only registry component names; required props present; slugs, thumbnailUrl, VideoPlayer url and VisualAsset src taken from context; CaseStudyTeaser titles verbatim; follows the prompt's mandatory rules (HeroBlock first, VideoPlayer when a retrieved case study has a Vimeo URL, a CaseStudyTeaser for retrieved case studies). Component count follows the prompt's rule "${componentCountRule()}": more than ${layout.maxComponents} is a rule violation; a count outside ${layout.typicalMinComponents}-${layout.typicalMaxComponents} that does not exceed ${layout.maxComponents} is at most a minor issue. The AUTOMATED CHECKS section lists deterministic findings - trust them, but judge severity yourself (e.g. a slightly reworded title is minor; a made-up slug or image URL is serious).

## fallback (honest reframing standard)
First decide context_relevant: does the retrieved context contain work genuinely relevant to what this user needs?
- If relevant: 5 when the response uses it directly without needless hedging or deflection; lower if it deflects or under-uses relevant work.
- If NOT relevant (or only loosely adjacent): the prompt tells the concierge to reframe positively and still show case studies, so showing adjacent work is allowed. What matters is honesty. 5 = it is clear the work shown is adjacent/transferable rather than a direct match, it does not imply AG has done this specific kind of work, and it offers a sensible next step (see the Strategy Lead rule under cta for when the Strategy Lead is required). 3 = vague but not misleading. 1-2 = presents unrelated work as directly relevant, implies experience AG does not have, or invents to fill the gap.
When the user asserts that AG did a specific engagement or achieved a specific result that is not in the retrieved context (invention bait): a good answer does not confirm it and redirects to real work.
Also set would_strict_pass_fallback: true only if the response explicitly says it lacks directly relevant work/case studies for this request (or context was relevant and no fallback was needed).

## cta
The response ends with a sensible next step that fits the QUERY: specific follow-up questions (the prompt asks for ${followUps.min}-${followUps.max}).
Strategy Lead rule (shared app config): ${strategyLeadRubricText()}
5 = specific, useful follow-ups fitted to the query, plus the ${strategyLead.name} offer when the rule requires it. 3 = generic follow-ups, or the ${strategyLead.name} offer missing where the rule requires it. 1 = no next step.

## voice
Matches the concierge prompt's tone: premium, confident but not arrogant, a trusted strategic advisor, active and specific language, a synthesized 2-4 sentence narrative rather than a list, no repetition across HeroBlock / StrategyCard / explanation. Adapts register to how the query is written (e.g. plain language for a casually worded, non-specialist query) without losing the brand voice.`;

const scoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'reason'],
  properties: {
    score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    reason: { type: 'string' },
  },
};

export const GRADER_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['context_relevant', 'would_strict_pass_fallback', 'claims', ...CRITERIA],
  properties: {
    context_relevant: { type: 'boolean' },
    would_strict_pass_fallback: { type: 'boolean' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['claim', 'kind'],
        properties: { claim: { type: 'string' }, kind: { type: 'string', enum: [...CLAIM_KINDS] } },
      },
    },
    ...Object.fromEntries(CRITERIA.map(c => [c, scoreSchema])),
  },
};

export type GraderOutput = Record<Criterion, CriterionScore> & {
  context_relevant: boolean;
  would_strict_pass_fallback: boolean;
  claims: Array<{ claim: string; kind: ClaimKind }>;
};

export function formatGraderContext(record: RunRecord): string {
  const retrieval = record.retrieval;
  if (!retrieval) return '(no retrieval captured)';

  const chunks = retrieval.chunks.map(
    (c, i) => `[${i + 1}] ${c.document_type === 'case_study' ? 'CASE STUDY' : 'ARTICLE'} (score ${c.combined_score.toFixed(3)})
Title: ${c.document_title}
Client: ${c.client_name ?? 'N/A'}
Slug: ${c.slug}
Vimeo URL: ${c.vimeo_url ?? 'None'}
Thumbnail URL: ${c.thumbnail_url ?? 'None'}
Content: ${c.content}`,
  );
  // Signed URL tokens are long and irrelevant to grading; the storage path identifies the asset
  const assets = retrieval.visualAssets.map(
    (a, i) => `[Asset ${i + 1}] path: ${a.bucket_name}/${a.storage_path} | caption: ${a.caption ?? 'N/A'} | alt: ${a.alt_text ?? 'N/A'} | description: ${a.description ?? 'N/A'} | score ${a.similarity_score.toFixed(3)}`,
  );
  const metrics = retrieval.relatedMetrics.map(m => `- ${m.label}: ${m.value}${m.context ? ` (${m.context})` : ''}`);

  return [
    `### Chunks (${chunks.length})\n${chunks.join('\n\n') || '(none)'}`,
    `### Visual assets (${assets.length})\n${assets.join('\n') || '(none)'}`,
    `### Metrics (${metrics.length})\n${metrics.join('\n') || '(none)'}`,
  ].join('\n\n');
}

export function formatChecks(checks: AutomatedChecks): string {
  return Object.entries(checks)
    .map(([key, value]) =>
      Array.isArray(value) ? `- ${key}: ${value.length ? value.join(' | ') : 'none'}` : `- ${key}: ${value}`,
    )
    .join('\n');
}

export function buildGraderPrompt(record: RunRecord, checks: AutomatedChecks): string {
  const response =
    record.raw_response ?? `(raw text unavailable - parsed output)\n${JSON.stringify(record.response, null, 2)}`;

  return `## QUERY
${record.query}

## RETRIEVED CONTEXT (the only source of truth for grounding)
${formatGraderContext(record)}

## AUTOMATED CHECKS
${formatChecks(checks)}

## CONCIERGE RESPONSE (raw model output)
${response}`;
}
