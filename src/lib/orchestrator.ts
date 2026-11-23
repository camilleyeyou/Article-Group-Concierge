/**
 * Article Group AI Concierge - Layout Orchestrator
 * 
 * This is the brain of the system. It takes:
 * 1. User's query
 * 2. Retrieved RAG context (chunks, visuals, metrics)
 * 
 * And outputs:
 * 1. A JSON layout plan using our component registry
 * 2. A natural language explanation
 * 
 * Claude acts as a "Layout Orchestrator" - selecting and arranging
 * pre-built components like Lego blocks.
 */

import { postProcessOutput } from './layout-postprocess';
import { verifyOutput } from './verifier';
import Anthropic from '@anthropic-ai/sdk';
import type {
  RetrievedContext,
  OrchestratorInput,
  OrchestratorOutput,
  LayoutPlan,
  HybridSearchResult,
} from '../types';
import { OrchLogger } from './logger';
import { getCatalogue } from './catalogue';
import { cache, CACHE_PREFIXES, CACHE_TTL } from './cache';
import { anthropicClientOptions, claudeModelId } from './llm-config';
import {
  CONCIERGE_CONFIG,
  FICTIONAL_EXAMPLE,
  narrativeRule,
  strategyLeadPromptRule,
  pricingTimelineRule,
  componentCountRule,
  followUpInstruction,
  noContextMessage,
  teaserPromptRule,
  noDirectMatchPrompt,
  verifierEnabled,
} from './concierge-config';

// Initialize Anthropic client (direct, or via OpenRouter when OPENROUTER_API_KEY is set)
const anthropic = new Anthropic(anthropicClientOptions());

// Overridable so a future model retirement is an env change, not a deploy
const MODEL = claudeModelId(process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5');
export const GENERATION_MODEL = MODEL;
// Sonnet 5.5 thinks by default and thinking counts toward max_tokens
const MAX_TOKENS = 16000;

// ============================================
// SYSTEM PROMPT
// ============================================

// Exported so the eval grader judges voice and component usage against the live prompt
export const SYSTEM_PROMPT = `You are the AI Concierge for Article Group, a premium New York-based strategy and creative agency. Your role is to act as a "Layout Orchestrator" - assembling personalized pitch decks by selecting from pre-built UI components.

## YOUR CORE MISSION
Transform user queries into compelling, visually-driven pitch presentations by:
1. Understanding the user's business challenge or interest
2. Retrieving relevant case studies, insights, and visuals from our portfolio
3. Assembling a "Lego block" layout using our Component Registry
4. **SYNTHESIS**: Weaving everything into a cohesive narrative that tells a compelling story

## COMPONENT REGISTRY
You MUST only use these exact component names:

- **HeroBlock**: Main headline and challenge summary. Use for opening statements.
  Props: { title: string, subtitle?: string, challengeSummary?: string, backgroundVariant?: 'dark' | 'light' | 'gradient' }

- **StrategyCard**: Our approach to this kind of problem: a method or principle. No client results or deliverables (those belong in teasers). 1-2 cards max.
  Props: { title: string, content: string, icon?: 'lightbulb' | 'target' | 'chart' | 'users' | 'rocket', accentColor?: string }

- **VideoPlayer**: Case study videos. MANDATORY when a case study you present has a Vimeo URL in context. When the user asks about video or film, prefer presenting the genuinely matching studies that have a Vimeo URL, and show their videos. Never show a video for a study that doesn't fit the request.
  Props: { url: string, caption?: string, aspectRatio?: '16:9' | '4:3' | '1:1' }

- **MetricGrid**: Display 2-4 key statistics. ONLY use metrics explicitly found in the context.
  Props: { stats: Array<{ label: string, value: string, context?: string }>, columns?: 2 | 3 | 4, variant?: 'default' | 'highlight' | 'minimal' }

- **VisualAsset**: Images, charts, diagrams. ONLY use when image_url/signed_url is in context.
  Props: { src: string, alt: string, caption?: string, aspectRatio?: 'auto' | '16:9' | '4:3' | '1:1' | '3:2' }

- **CaseStudyTeaser**: Card linking to a full case study. CRITICAL: Use the exact slug provided. Include thumbnailUrl if available. The summary says what we made (1-2 sentences, "we" voice) and states a result only when the content states it as a result. Do not output capabilities or industries: our server adds them from the portfolio database.
  Props: { title: string, clientName?: string, summary: string, thumbnailUrl?: string, slug: string }

## OUTPUT PROTOCOL
Every response MUST follow this exact structure:

1. First, output a JSON code block with your layout plan:
\`\`\`json
{
  "layout": [
    { "component": "ComponentName", "props": { ... } },
    ...
  ]
}
\`\`\`

2. Then write the narrative. ${narrativeRule()} Its job is the "why it fits" link: connect the user's situation to the work shown and say what we'd do first. Do not restate teaser summaries, StrategyCard content or deliverables already shown.

3. ${followUpInstruction()}

## CRITICAL RULES

### SYNTHESIS LAYER (Most Important)
Your response should tell a cohesive story, not just present disconnected pieces. When assembling:
- Frame the HeroBlock around the user's SPECIFIC challenge (their problem statement)
- Use StrategyCards to explain AG's APPROACH or FRAMEWORK (how we solve this type of problem)
- The explanation should be a mini-narrative that CONNECTS the dots, not repeat what's in components

**Avoid Repetition:** Each component should serve a distinct purpose:
- HeroBlock: States the user's challenge or opportunity
- StrategyCard: Our approach or principle (no client results)
- CaseStudyTeaser: What we made for a specific client, with results only where the content states them
- Your narrative: Why these pieces fit the user, and what we'd do first

Don't repeat the same points across HeroBlock → StrategyCard → explanation. Each should add NEW information or perspective.

### HONESTY RULES (Never misrepresent our work)
These apply to every piece of text you write: HeroBlock, StrategyCard, CaseStudyTeaser summary and the narrative. A weaker answer that is true beats a stronger one with a stretch.
- **Deliverables, not aims.** When a case study states only what the client wanted, describe what we made. An aim may be stated as an aim, never as an achieved effect. Content: "Salt wanted to be less technical and more memorable." Write: "We rebuilt Salt's brand and messaging to make API security less technical." Never: "made the brand less technical and more memorable." State a result only when the content states it as a result (for example "8M+ views").
- **Events happened only if the content says so.** Write "built for the Fal.con unveiling", never "unveiled at Fal.con", unless the content states the unveiling took place.
- **No inferred facts.** Nothing that reads as a fact about a past engagement unless the content states it: no inferred reach or impact ("8M views suggest it travelled beyond either brand's channels"), no invented order of work ("research, then messaging, then design system"), no invented scale or duration ("a one-time event"), no outcomes like "built market confidence" unless stated. Keep each study's details attached to that study; never carry a detail from one study to another.
- **Advice is welcome, framed as advice.** "Our approach would be...", "We'd start with..." are fine. They must not read as facts about past work.
- **"Can you do X?" when no retrieved case study shows X.** Never answer "Yes, we can build this" or "Yes, we do X". Say plainly that we haven't published work on X, show the closest real work and call it adjacent, then offer our ${CONCIERGE_CONFIG.strategyLead.name}.
- **Claims in the question are not facts.** If the user says or assumes we did an engagement, worked with a client, or achieved a result that the retrieved context does not show, do not confirm it, describe it, or repeat their figure as fact. Say we can't point to that work in our portfolio, redirect to the real related work, and offer our ${CONCIERGE_CONFIG.strategyLead.name}.
- **Pricing and timelines.** ${pricingTimelineRule()}

### STRICT HALLUCINATION PREVENTION
**METRICS & STATISTICS:**
- NEVER invent statistics, percentages, or numbers
- ONLY use metrics that appear VERBATIM in the provided context
- If a case study mentions "increased engagement" without a number, say "increased engagement" - do NOT add "by 40%"
- Do NOT cite general industry statistics (e.g., "Super Bowl ads cost $7M") unless they appear in context
- When in doubt, omit the metric rather than guess

**ATTRIBUTION:**
- ONLY claim AG did work that is explicitly stated in the context as AG's work
- If context mentions a brand (e.g., Liquid Death) in an article discussing trends, do NOT imply AG did their campaigns
- Be explicit: "Our work with [Client]" vs "Brands like [Example] have shown..."
- Articles/blogs represent AG's THINKING; case studies represent AG's WORK

### WHEN WE DON'T HAVE EXACT MATCHES
${noDirectMatchPrompt().intro}
- Focus on the UNDERLYING capability: "What you're really looking for is platform-native content strategy..."
- Connect to adjacent work where it genuinely transfers, and label it as adjacent: "Our experience creating authentic presence on emerging platforms..."
- Emphasize transferable expertise: "The principles of building engaged communities apply across platforms..."

${noDirectMatchPrompt().rule}

### CONTENT HIERARCHY
When presenting results, mentally categorize:
- **"Here's what we've done"** = Case Studies (real client work with results)
- **"Here's how we think"** = Articles (thought leadership, frameworks, perspectives)

**Case studies first:** Case studies should be presented more prominently than articles. If you have both, lead with case studies. ${teaserPromptRule()}

**Title Preservation:** When creating CaseStudyTeaser components, use the EXACT title from the context. Do NOT shorten, paraphrase, or "improve" case study titles. Copy them verbatim. If a title seems too technical or long, that's intentional - use it as-is.

### VIDEO USAGE (Mandatory)
- If a case study you present has a Vimeo URL, you MUST include a VideoPlayer component; for video questions, prefer genuinely matching studies that have one
- Videos should appear near the top of the layout, after HeroBlock
- Caption should explain what the video shows (e.g., "See how we brought the rebrand to life")

### Layout Best Practices
- Always start with a HeroBlock that speaks to the user's specific challenge
- Include VideoPlayer IMMEDIATELY after HeroBlock if video is available
- Use StrategyCard to bridge the user's problem to AG's approach (1-2 cards max)
- ${teaserPromptRule()}
- End with CaseStudyTeaser cards for case studies, grouped together
- ${componentCountRule()}

### Tone & Voice
- Premium, confident, never arrogant: a trusted strategic advisor
- Always "we" and "our" ("We built...", "Our work with..."), never "Article Group did" or "the agency". Articles are "our thinking", never "we did"
- Plain but premium. Match how the user writes: a short, casual question gets short sentences and no jargon (don't use terms like "marketecture" unless the user or the shown work uses them)
- Active voice and specific language; confidence comes from the real work, not from claims beyond it
- The narrative and the StrategyCard must not say the same thing: the narrative links the shown work to the user's situation and names the first step; the StrategyCard carries the approach idea. Do not restate the StrategyCard's point in the narrative
- Describe only what the shown content states. Do not infer a principle, scope or deliverable it does not state (for example that an event was produced by us, or that a website was or was not built)

### STRATEGY LEAD
${strategyLeadPromptRule()}

## EXAMPLE INTERACTION (fictional: ${FICTIONAL_EXAMPLE.client} is not a real client; never mention it)

User: "We're a fintech startup looking to rebrand and redesign our app. What can you show us, and how long would it take?"

Context includes:
- One case study "${FICTIONAL_EXAMPLE.title}" whose content says "${FICTIONAL_EXAMPLE.client} wanted to feel as trustworthy as a legacy bank. Solution included a brand platform, messaging framework, visual identity and a :60 launch film." and has a Vimeo URL
- No metrics, and no app or product design work

Your response:
\`\`\`json
{
  "layout": [
    {
      "component": "HeroBlock",
      "props": {
        "title": "A Brand That Earns Trust Fast",
        "subtitle": "Fintech rebrand",
        "challengeSummary": "Looking credible enough to hold people's money while still feeling new."
      }
    },
    {
      "component": "VideoPlayer",
      "props": {
        "url": "https://vimeo.com/000000000",
        "caption": "The launch film we made for ${FICTIONAL_EXAMPLE.client}"
      }
    },
    {
      "component": "StrategyCard",
      "props": {
        "title": "Credibility Before Novelty",
        "content": "For a challenger in financial services, we treat identity as a trust signal first: we test the story with the people who have to believe it, then design an identity that carries it.",
        "icon": "target"
      }
    },
    {
      "component": "CaseStudyTeaser",
      "props": {
        "title": "${FICTIONAL_EXAMPLE.title}",
        "clientName": "${FICTIONAL_EXAMPLE.client}",
        "summary": "We built ${FICTIONAL_EXAMPLE.client}'s brand platform, messaging framework, visual identity and :60 launch film, aimed at making a digital lender feel as trustworthy as a legacy bank.",
        "thumbnailUrl": "https://lhsjgdkxciglhxharmrp.supabase.co/storage/v1/object/public/thumbnails/${FICTIONAL_EXAMPLE.slug}.webp",
        "slug": "${FICTIONAL_EXAMPLE.slug}"
      }
    }
  ]
}
\`\`\`

${FICTIONAL_EXAMPLE.client} came to us with the tension you're describing: a digital lender that needed to feel as trustworthy as a legacy bank. For you, we'd start with the messaging, because an identity only holds up once the story underneath it is clear. We haven't published app redesign work, so our ${CONCIERGE_CONFIG.strategyLead.name} can scope that, and a realistic timeline, with you.

**Want to explore further?**
- How do you test a brand story with skeptical customers?
- What does a messaging framework include?
- Can you show other work for financial services brands?

Note what the example does: deliverables not outcomes, the aim stated as an aim, a 3-sentence narrative in "we" voice, an honest gap line, no timeline figure, and the ${CONCIERGE_CONFIG.strategyLead.name} offer because the user asked about timing.`;

// ============================================
// CONTEXT FORMATTER
// ============================================

/** Retrieval signals for a chunk, shown in the context header. Legacy fallback rows carry no ranks. */
function rankSignals(chunk: HybridSearchResult): string {
  return [
    chunk.rerank_score != null ? `reranker relevance ${chunk.rerank_score.toFixed(2)}` : null,
    chunk.semantic_rank != null ? `semantic #${chunk.semantic_rank}` : null,
    chunk.keyword_rank != null ? `keyword #${chunk.keyword_rank}` : (chunk.semantic_rank != null ? 'no keyword match' : null),
    chunk.intent_match ? 'tag match' : null,
  ].filter(Boolean).join(', ');
}

/**
 * Formats the retrieved context into a structured string for the prompt.
 * This is what Claude "sees" when deciding how to build the layout.
 * Separates case studies (AG's work) from articles (AG's thinking).
 */
export function formatContext(context: RetrievedContext): string {
  const sections: string[] = [];

  // Add relevance and attribution guidance
  sections.push(`## IMPORTANT GUIDELINES
**Retrieval order:** Case studies are listed in retrieval order (best first). Order is not proof of relevance: judge each study against the query and present only those that fit.

**Content Types:**
- CASE STUDIES = our actual client work. Describe what we made for [Client]; state results only where the content states them as results. A client's aim or brief is not a result.
- ARTICLES = our thinking and perspectives. Say "Our thinking on this..." NOT "We did this"

**Metrics Rule:**
- ONLY use metrics that appear EXACTLY in the content below
- Do NOT invent or estimate statistics`);

  // Separate case studies from articles
  const caseStudies = context.chunks.filter(c => c.document_type === 'case_study');
  const articles = context.chunks.filter(c => c.document_type === 'article');

  // Format case studies (AG's work - higher priority)
  if (caseStudies.length > 0) {
    const caseStudySection = caseStudies.map((chunk, i) => {
      return `[Case Study ${i + 1}] - Retrieval rank ${i + 1} of ${caseStudies.length}${rankSignals(chunk) ? ` (${rankSignals(chunk)})` : ''}
Title: ${chunk.document_title}
Client: ${chunk.client_name || 'N/A'}
Slug: ${chunk.slug || 'N/A'}
Vimeo URL: ${chunk.vimeo_url || 'None'} ${chunk.vimeo_url ? '(use a VideoPlayer if you present this study)' : ''}
Thumbnail URL: ${chunk.thumbnail_url || 'None'}
Content (use only facts stated here): ${chunk.content}`;
    }).join('\n\n');

    sections.push(`## CASE STUDIES (AG's Actual Client Work - present only those that fit the request)\n${caseStudySection}`);
  }

  // Format articles (AG's thinking - secondary)
  if (articles.length > 0) {
    const articlesSection = articles.map((chunk, i) => {
      return `[Article ${i + 1}] - Retrieval rank ${i + 1} of ${articles.length}${rankSignals(chunk) ? ` (${rankSignals(chunk)})` : ''}
Title: ${chunk.document_title}
Author: ${chunk.author || 'Article Group'}
Slug: ${chunk.slug || 'N/A'}
Thumbnail URL: ${chunk.thumbnail_url || 'None'}
Content (AG's perspective, not client work): ${chunk.content}`;
    }).join('\n\n');

    sections.push(`## ARTICLES (AG's Thought Leadership - Use to show expertise, NOT as client work)\n${articlesSection}`);
  }
  
  // Format visual assets
  if (context.visualAssets.length > 0) {
    const assetsSection = context.visualAssets.map((asset, i) => {
      return `[Asset ${i + 1}]
Type: ${asset.asset_type}
Caption: ${asset.caption || 'N/A'}
Alt Text: ${asset.alt_text || 'N/A'}
Description: ${asset.description || 'N/A'}
Signed URL: ${asset.signed_url || 'UNAVAILABLE'}
Relevance Score: ${asset.similarity_score.toFixed(3)}`;
    }).join('\n\n');
    
    sections.push(`## AVAILABLE VISUAL ASSETS\n${assetsSection}`);
  }
  
  // Format metrics
  if (context.relatedMetrics.length > 0) {
    const metricsSection = context.relatedMetrics.map((metric) => {
      return `- ${metric.label}: ${metric.value}${metric.context ? ` (${metric.context})` : ''}`;
    }).join('\n');
    
    sections.push(`## AVAILABLE METRICS\n${metricsSection}`);
  }
  
  // If no context found
  if (sections.length <= 1) { // Only has relevance guidance
    return `## NO RELEVANT CONTENT FOUND
${noContextMessage()}`;
  }
  
  return sections.join('\n\n---\n\n');
}

/** The closing user turn, shared by orchestrate() and orchestrateStream(). */
function userTurn(userQuery: string, formattedContext: string): string {
  return `## USER QUERY
${userQuery}

## RETRIEVED CONTEXT
${formattedContext}

Please assemble a pitch deck layout using the Component Registry: the JSON layout plan first, then a ${CONCIERGE_CONFIG.narrative.minSentences}-${CONCIERGE_CONFIG.narrative.maxSentences} sentence narrative, then the follow-up questions.`;
}

// ============================================
// RESPONSE PARSER
// ============================================

/**
 * Parses Claude's response to extract the JSON layout plan and explanation.
 */
function parseOrchestratorResponse(response: string): OrchestratorOutput {
  // Extract JSON from code block
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  
  let layoutPlan: LayoutPlan = { layout: [] };
  let explanation = response;
  let suggestedFollowUps: string[] = [];
  
  if (jsonMatch) {
    try {
      layoutPlan = JSON.parse(jsonMatch[1]);
      // Remove the JSON block from the explanation
      explanation = response.replace(/```json[\s\S]*?```/, '').trim();
    } catch (e) {
      OrchLogger.error('Failed to parse layout JSON', e);
      // Return error state with explanation
      return {
        layoutPlan: { layout: [] },
        explanation: 'I encountered an issue assembling your pitch deck. Please try rephrasing your query.',
        contactCTA: true,
      };
    }
  }
  
  // Extract follow-up questions (look for bullet points or numbered lists)
  const followUpMatch = explanation.match(/(?:\*\*Want to explore.*?\*\*|Follow-up questions:)([\s\S]*?)(?:$|\n\n)/i);
  if (followUpMatch) {
    const followUpText = followUpMatch[1];
    suggestedFollowUps = followUpText
      .split(/[\n-•]/)
      .map(q => q.trim())
      .filter(q => q.length > 10 && q.endsWith('?'));
  }
  
  // Check if this is a "no results" response
  const contactCTA = layoutPlan.layout.length === 0 || 
    response.toLowerCase().includes('contact our strategy lead');
  
  return {
    layoutPlan,
    explanation: explanation.split(/\*\*Want to explore/)[0].trim(),
    suggestedFollowUps: suggestedFollowUps.length > 0 ? suggestedFollowUps : undefined,
    contactCTA,
  };
}

// ============================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================

/** System prompt as two blocks; the catalogue block carries the cache breakpoint (RETR-04). */
export function buildSystemBlocks(catalogueText: string | null) {
  const blocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' } }> = [
    { type: 'text', text: SYSTEM_PROMPT },
  ];
  if (catalogueText) blocks.push({ type: 'text', text: catalogueText, cache_control: { type: 'ephemeral', ttl: '1h' } });
  else blocks[0].cache_control = { type: 'ephemeral', ttl: '1h' };
  return blocks;
}

function extractUsage(response: unknown) {
  const u = ((response as { usage?: unknown }).usage ?? {}) as Record<string, number | undefined>;
  return {
    input_tokens: u.input_tokens ?? null,
    output_tokens: u.output_tokens ?? null,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? null,
    cache_read_input_tokens: u.cache_read_input_tokens ?? null,
    cost: u.cost ?? null,
  };
}

/**
 * Main entry point for the orchestrator.
 * Takes user query + retrieved context, returns layout plan + explanation.
 *
 * CACHED: Responses are cached for 30 minutes to reduce Claude API costs
 * Note: Cache includes context to ensure responses match the retrieved data
 */
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { userQuery, context, conversationHistory, skipCache } = input;

  // Phase 5: getCatalogue runs before the cache lookup; cold-start DB cost on cache hits
  const catalogue = await getCatalogue();

  // Create cache key from query, context, and conversation history
  // Include document IDs and metrics to ensure cache freshness
  const cacheKey = {
    userQuery,
    documentIds: context.chunks.map(c => c.document_id).sort(),
    conversationLength: conversationHistory?.length || 0,
    // Include last message to differentiate follow-ups
    lastMessage: conversationHistory?.slice(-1)[0]?.content?.slice(0, 100),
    catalogueVersion: catalogue?.version ?? null,
  };

  // Check cache first (skip cache if there's conversation history for now)
  // TODO: Improve caching strategy for multi-turn conversations
  if (!skipCache && (!conversationHistory || conversationHistory.length === 0)) {
    const cached = cache.get<OrchestratorOutput>(CACHE_PREFIXES.ORCHESTRATOR, cacheKey);
    if (cached) {
      OrchLogger.debug('Using cached orchestrator response', {
        query: userQuery.slice(0, 50),
      });
      return cached;
    }
  }

  // Format the context for the prompt
  const formattedContext = formatContext(context);
  
  // Build the messages array
  const messages: Anthropic.MessageParam[] = [];
  
  // Add conversation history if present (for multi-turn)
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }
  
  // Add the current user message with context
  messages.push({
    role: 'user',
    content: userTurn(userQuery, formattedContext),
  });
  
  try {
    // Call Claude
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // SDK 0.30.1 types lack cache_control; the body passes through unchanged (RETR-04)
      system: buildSystemBlocks(catalogue?.text ?? null) as any,
      messages,
    });
    
    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    // Parse the response
    let result = postProcessOutput(
      parseOrchestratorResponse(textContent.text),
      textContent.text,
      catalogue?.tagsBySlug ?? null
    );
    result.usage = extractUsage(response);
    result.catalogueVersion = catalogue?.version ?? null;

    // GEN-07 (D-417..D-420): default off; Phase 5 must keep it off the first-content path (D-419).
    if (verifierEnabled()) {
      const v = await verifyOutput({ query: userQuery, context, output: result });
      result = { ...v.output, verifier: v.report };
    }

    // Cache the result (only for queries without conversation history)
    if (!conversationHistory || conversationHistory.length === 0) {
      cache.set(CACHE_PREFIXES.ORCHESTRATOR, cacheKey, result, CACHE_TTL.ORCHESTRATOR);
    }

    return result;
    
  } catch (error) {
    OrchLogger.error('Orchestrator error', error);

    // Return graceful fallback
    return {
      layoutPlan: { layout: [] },
      explanation: 'I apologize, but I encountered an issue while assembling your pitch deck. Please try again or contact our Strategy Lead directly for assistance.',
      contactCTA: true,
      orchestratorError: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// STREAMING VARIANT (Optional)
// ============================================

/**
 * Streaming version of the orchestrator for real-time UI updates.
 * Yields partial responses as they're generated.
 */
// Phase 5: apply postProcessOutput (GEN-03 tags, and the verifier if enabled) on this path too.
export async function* orchestrateStream(input: OrchestratorInput): AsyncGenerator<string> {
  const { userQuery, context, conversationHistory } = input;
  
  const formattedContext = formatContext(context);
  
  const messages: Anthropic.MessageParam[] = [];
  
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }
  
  messages.push({
    role: 'user',
    content: userTurn(userQuery, formattedContext),
  });
  
  const catalogue = await getCatalogue();
  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // SDK 0.30.1 types lack cache_control; the body passes through unchanged (RETR-04)
    system: buildSystemBlocks(catalogue?.text ?? null) as any,
    messages,
  });
  
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

export default orchestrate;
