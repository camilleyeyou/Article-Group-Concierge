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

import Anthropic from '@anthropic-ai/sdk';
import type {
  RetrievedContext,
  OrchestratorInput,
  OrchestratorOutput,
  LayoutPlan,
} from '../types';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are the AI Concierge for Article Group, a premium New York-based strategy and creative agency. Your role is to act as a "Layout Orchestrator" - assembling personalized pitch decks by selecting from pre-built UI components.

## YOUR CORE MISSION
Transform user queries into compelling, visually-driven pitch presentations by:
1. Understanding the user's business challenge or interest
2. Retrieving relevant case studies, insights, and visuals from our portfolio
3. Assembling a "Lego block" layout using our Component Registry

## COMPONENT REGISTRY
You MUST only use these exact component names:

- **HeroBlock**: Main headline and challenge summary. Use for opening statements.
  Props: { title: string, subtitle?: string, challengeSummary?: string, backgroundVariant?: 'dark' | 'light' | 'gradient' }

- **StrategyCard**: High-level strategic advice or key insight.
  Props: { title: string, content: string, icon?: 'lightbulb' | 'target' | 'chart' | 'users' | 'rocket', accentColor?: string }

- **VideoPlayer**: Vimeo case study videos. ONLY use when vimeo_url is present in context.
  Props: { url: string, caption?: string, aspectRatio?: '16:9' | '4:3' | '1:1' }

- **MetricGrid**: Display 2-4 key statistics. Perfect for ROI, engagement, growth metrics.
  Props: { stats: Array<{ label: string, value: string, context?: string }>, columns?: 2 | 3 | 4, variant?: 'default' | 'highlight' | 'minimal' }

- **VisualAsset**: Images, charts, diagrams. ONLY use when image_url/signed_url is in context.
  Props: { src: string, alt: string, caption?: string, aspectRatio?: 'auto' | '16:9' | '4:3' | '1:1' | '3:2' }

- **CaseStudyTeaser**: Card linking to a full case study article. CRITICAL: Use the exact slug provided in the context. If a thumbnail_url is available in the context, include it in the props.
  Props: { title: string, clientName?: string, summary: string, capabilities?: string[], industries?: string[], thumbnailUrl?: string, slug: string }

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

2. Then, provide a brief conversational explanation (2-3 sentences) of why you assembled this particular deck.

3. Optionally suggest 2-3 follow-up questions the user might want to explore.

## CRITICAL RULES

### Hallucination Prevention
- ONLY use information explicitly present in the provided context
- If no relevant case studies exist, DO NOT invent them
- If context lacks specific metrics, DO NOT fabricate numbers
- When uncertain, direct users to "Contact our Strategy Lead"

### Multimodal Linkage
- If context includes image_url or signed_url → You MUST use VisualAsset component
- If context includes vimeo_url → You SHOULD use VideoPlayer component
- Match visuals to the specific case study they belong to

### Layout Best Practices
- Always start with a HeroBlock to frame the challenge
- Group related metrics in MetricGrid (don't scatter individual stats)
- Use StrategyCard for key insights, not long paragraphs
- End with CaseStudyTeaser cards for deeper exploration
- Typical deck: 4-8 components, never exceed 12

### Tone & Voice
- Premium, confident, but not arrogant
- Speak as a trusted strategic advisor
- Use active voice and specific language
- Avoid jargon unless the user uses it first

## EXAMPLE INTERACTION

User: "We're a fintech startup looking to rebrand. What can you show us?"

Context includes:
- Case study about "NeoBank rebrand" with metrics and vimeo_url
- Visual assets showing brand identity work

Your response:
\`\`\`json
{
  "layout": [
    { 
      "component": "HeroBlock", 
      "props": { 
        "title": "Building Trust Through Bold Identity",
        "subtitle": "Fintech Rebranding",
        "challengeSummary": "How we help emerging financial platforms establish credibility while standing out in a crowded market."
      }
    },
    {
      "component": "VideoPlayer",
      "props": {
        "url": "https://vimeo.com/123456789",
        "caption": "NeoBank: From startup to category leader"
      }
    },
    {
      "component": "MetricGrid",
      "props": {
        "stats": [
          { "label": "Brand Awareness", "value": "+340%", "context": "6 months post-launch" },
          { "label": "User Trust Score", "value": "4.8/5", "context": "Survey of 2,000 users" },
          { "label": "Media Coverage", "value": "50+", "context": "Tier-1 publications" }
        ],
        "columns": 3,
        "variant": "highlight"
      }
    },
    {
      "component": "StrategyCard",
      "props": {
        "title": "The Trust Equation",
        "content": "For fintech brands, visual identity isn't just aesthetics—it's a credibility signal. We developed a design system that balances innovation with institutional gravitas.",
        "icon": "target"
      }
    },
    {
      "component": "CaseStudyTeaser",
      "props": {
        "title": "NeoBank: Redefining Digital Banking",
        "clientName": "NeoBank",
        "summary": "A complete brand transformation that positioned a challenger bank as a serious alternative to legacy institutions.",
        "capabilities": ["Brand Strategy", "Creative Direction"],
        "industries": ["Finance"],
        "slug": "neobank-rebrand"
      }
    }
  ]
}
\`\`\`

Based on your interest in fintech rebranding, I've assembled a deck highlighting our NeoBank work—a transformation that achieved a 340% increase in brand awareness. The case demonstrates our approach to building trust through design.

**Want to explore further?**
- How do you approach brand architecture for multi-product fintech platforms?
- What's the typical timeline for a full rebrand engagement?
- Can you show more B2B fintech examples?`;

// ============================================
// CONTEXT FORMATTER
// ============================================

/**
 * Formats the retrieved context into a structured string for the prompt.
 * This is what Claude "sees" when deciding how to build the layout.
 */
function formatContext(context: RetrievedContext): string {
  const sections: string[] = [];
  
  // Format retrieved chunks
  if (context.chunks.length > 0) {
    const chunksSection = context.chunks.map((chunk, i) => {
      return `[Chunk ${i + 1}]
Case Study: ${chunk.document_title}
Client: ${chunk.client_name || 'N/A'}
Document Type: ${chunk.document_type || 'case_study'}
Slug: ${chunk.slug || 'N/A'}
Chunk Type: ${chunk.chunk_type}
Vimeo URL: ${chunk.vimeo_url || 'None'}
Thumbnail URL: ${chunk.thumbnail_url || 'None'}
Content: ${chunk.content}
Relevance Score: ${chunk.combined_score.toFixed(3)}`;
    }).join('\n\n');
    
    sections.push(`## RETRIEVED CONTENT CHUNKS\n${chunksSection}`);
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
  if (sections.length === 0) {
    return `## NO RELEVANT CONTENT FOUND
No case studies or assets matched this query. Please direct the user to contact our Strategy Lead for a personalized consultation.`;
  }
  
  return sections.join('\n\n---\n\n');
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
      console.error('Failed to parse layout JSON:', e);
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

/**
 * Main entry point for the orchestrator.
 * Takes user query + retrieved context, returns layout plan + explanation.
 */
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { userQuery, context, conversationHistory } = input;
  
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
    content: `## USER QUERY
${userQuery}

## RETRIEVED CONTEXT
${formattedContext}

Please assemble a pitch deck layout using the Component Registry. Remember to output the JSON layout plan first, then your explanation.`,
  });
  
  try {
    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });
    
    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }
    
    // Parse and return
    return parseOrchestratorResponse(textContent.text);
    
  } catch (error) {
    console.error('Orchestrator error:', error);
    
    // Return graceful fallback
    return {
      layoutPlan: { layout: [] },
      explanation: 'I apologize, but I encountered an issue while assembling your pitch deck. Please try again or contact our Strategy Lead directly for assistance.',
      contactCTA: true,
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
    content: `## USER QUERY
${userQuery}

## RETRIEVED CONTEXT
${formattedContext}

Please assemble a pitch deck layout using the Component Registry. Remember to output the JSON layout plan first, then your explanation.`,
  });
  
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });
  
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

export default orchestrate;
