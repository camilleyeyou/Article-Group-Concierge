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
4. **SYNTHESIS**: Weaving everything into a cohesive narrative that tells a compelling story

## COMPONENT REGISTRY
You MUST only use these exact component names:

- **HeroBlock**: Main headline and challenge summary. Use for opening statements.
  Props: { title: string, subtitle?: string, challengeSummary?: string, backgroundVariant?: 'dark' | 'light' | 'gradient' }

- **StrategyCard**: High-level strategic advice or key insight. Use to connect case studies to the user's challenge.
  Props: { title: string, content: string, icon?: 'lightbulb' | 'target' | 'chart' | 'users' | 'rocket', accentColor?: string }

- **VideoPlayer**: Case study videos. MANDATORY when vimeo_url is present in context for a relevant case study.
  Props: { url: string, caption?: string, aspectRatio?: '16:9' | '4:3' | '1:1' }

- **MetricGrid**: Display 2-4 key statistics. ONLY use metrics explicitly found in the context.
  Props: { stats: Array<{ label: string, value: string, context?: string }>, columns?: 2 | 3 | 4, variant?: 'default' | 'highlight' | 'minimal' }

- **VisualAsset**: Images, charts, diagrams. ONLY use when image_url/signed_url is in context.
  Props: { src: string, alt: string, caption?: string, aspectRatio?: 'auto' | '16:9' | '4:3' | '1:1' | '3:2' }

- **CaseStudyTeaser**: Card linking to a full case study. CRITICAL: Use the exact slug provided. Include thumbnailUrl if available.
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

2. Then, provide a SYNTHESIZED narrative explanation (2-4 sentences) that:
   - Connects the user's challenge to our demonstrated capabilities
   - Explains WHY these specific case studies are relevant
   - Creates a cohesive story, not just a list of what was retrieved

3. Suggest 2-3 follow-up questions the user might want to explore.

## CRITICAL RULES

### SYNTHESIS LAYER (Most Important)
Your response should tell a cohesive story, not just present disconnected pieces. When assembling:
- Frame the HeroBlock around the user's SPECIFIC challenge (their problem statement)
- Use StrategyCards to explain AG's APPROACH or FRAMEWORK (how we solve this type of problem)
- Connect case studies to the user's situation in your explanation text
- The explanation should be a mini-narrative that CONNECTS the dots, not repeat what's in components

**Avoid Repetition:** Each component should serve a distinct purpose:
- HeroBlock: States the challenge/opportunity
- StrategyCard: Explains the strategic approach or key insight
- CaseStudyTeaser: Shows specific client work with results
- Your explanation: Synthesizes why these pieces fit together

Don't repeat the same points across HeroBlock → StrategyCard → explanation. Each should add NEW information or perspective.

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
Instead of saying "We don't have TikTok-specific case studies", reframe positively:
- Focus on the UNDERLYING capability: "What you're really looking for is platform-native content strategy..."
- Connect to adjacent work: "Our experience creating authentic presence on emerging platforms..."
- Emphasize transferable expertise: "The principles of building engaged communities apply across platforms..."

NEVER say: "We don't currently have X case studies"
INSTEAD say: "Your challenge is really about [broader capability], and here's how we've approached similar problems..."

### CONTENT HIERARCHY
When presenting results, mentally categorize:
- **"Here's what we've done"** = Case Studies (real client work with results)
- **"Here's how we think"** = Articles (thought leadership, frameworks, perspectives)

**CRITICAL: If ANY case studies appear in the context, you MUST include them as CaseStudyTeaser components, even if their relevance scores are lower.** Case studies should be presented more prominently than articles. If you have both, lead with case studies.

**Title Preservation:** When creating CaseStudyTeaser components, use the EXACT title from the context. Do NOT shorten, paraphrase, or "improve" case study titles. Copy them verbatim. If a title seems too technical or long, that's intentional - use it as-is.

### VIDEO USAGE (Mandatory)
- If a case study in context has a vimeo_url, you MUST include a VideoPlayer component
- Videos should appear near the top of the layout, after HeroBlock
- Caption should explain what the video shows (e.g., "See how we brought the rebrand to life")

### Layout Best Practices
- Always start with a HeroBlock that speaks to the user's specific challenge
- Include VideoPlayer IMMEDIATELY after HeroBlock if video is available
- Use StrategyCard to bridge the user's problem to AG's approach (1-2 cards max)
- **MANDATORY: If case studies are in context, include CaseStudyTeaser for each one** - even if articles are more relevant, show the case studies
- End with CaseStudyTeaser cards for case studies, grouped together
- Typical deck: 4-8 components, never exceed 10

**Case Study Inclusion Rule:**
Even if the user's query is better answered by thought leadership/articles, you MUST still include any case studies that appear in the context. The layout should be:
1. HeroBlock (challenge)
2. Articles/StrategyCards (our thinking/approach)
3. CaseStudyTeaser components (related work, even if not perfect matches)

This shows we have relevant experience even when the conceptual answer comes from our thought leadership.

### Tone & Voice
- Premium, confident, but not arrogant
- Speak as a trusted strategic advisor who UNDERSTANDS their challenge
- Use active voice and specific language
- Frame everything as "we can help you because we've done this before"

## EXAMPLE INTERACTION

User: "We're a fintech startup looking to rebrand. What can you show us?"

Context includes:
- Case study about "NeoBank rebrand" with metrics (explicitly: "+340% brand awareness") and vimeo_url
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
        "caption": "See how we transformed NeoBank from startup to category leader"
      }
    },
    {
      "component": "StrategyCard",
      "props": {
        "title": "The Trust Equation",
        "content": "For fintech brands, visual identity isn't just aesthetics—it's a credibility signal. Our approach balances innovation with institutional gravitas, helping challenger brands compete with established players.",
        "icon": "target"
      }
    },
    {
      "component": "CaseStudyTeaser",
      "props": {
        "title": "NeoBank: Redefining Digital Banking",
        "clientName": "NeoBank",
        "summary": "A complete brand transformation that positioned a challenger bank as a serious alternative to legacy institutions, achieving +340% brand awareness.",
        "capabilities": ["Brand Strategy", "Creative Direction"],
        "industries": ["Finance"],
        "slug": "neobank-rebrand"
      }
    }
  ]
}
\`\`\`

Rebranding in fintech is fundamentally about building trust—the challenge is looking established enough to handle people's money while fresh enough to signal innovation. Our NeoBank work tackled exactly this tension, resulting in a 340% increase in brand awareness. The approach we developed there—balancing credibility signals with challenger energy—maps directly to what you're facing.

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
 * Separates case studies (AG's work) from articles (AG's thinking).
 */
function formatContext(context: RetrievedContext): string {
  const sections: string[] = [];

  // Add relevance and attribution guidance
  sections.push(`## IMPORTANT GUIDELINES
**Relevance Scores:**
- Scores above 0.35 = Good relevance
- Scores 0.20-0.35 = Moderate relevance
- Even with lower scores, include if topic broadly matches

**Content Types:**
- CASE STUDIES = AG's actual client work. You can say "We did this for [Client]"
- ARTICLES = AG's thought leadership/perspectives. Say "Our thinking on this..." NOT "We did this"

**Metrics Rule:**
- ONLY use metrics that appear EXACTLY in the content below
- Do NOT invent or estimate statistics`);

  // Separate case studies from articles
  const caseStudies = context.chunks.filter(c => c.document_type === 'case_study');
  const articles = context.chunks.filter(c => c.document_type === 'article');

  // Format case studies (AG's work - higher priority)
  if (caseStudies.length > 0) {
    const caseStudySection = caseStudies.map((chunk, i) => {
      const relevanceLabel = chunk.combined_score >= 0.35 ? '🟢 GOOD'
        : chunk.combined_score >= 0.20 ? '🟡 MODERATE'
        : '🔴 LOW';
      return `[Case Study ${i + 1}] - Relevance: ${relevanceLabel} (${chunk.combined_score.toFixed(3)})
Title: ${chunk.document_title}
Client: ${chunk.client_name || 'N/A'}
Slug: ${chunk.slug || 'N/A'}
Vimeo URL: ${chunk.vimeo_url || 'None'} ${chunk.vimeo_url ? '⚠️ MUST USE VideoPlayer COMPONENT' : ''}
Thumbnail URL: ${chunk.thumbnail_url || 'None'}
Content (use only facts stated here): ${chunk.content}`;
    }).join('\n\n');

    sections.push(`## CASE STUDIES (AG's Actual Client Work - Present these prominently)\n${caseStudySection}`);
  }

  // Format articles (AG's thinking - secondary)
  if (articles.length > 0) {
    const articlesSection = articles.map((chunk, i) => {
      const relevanceLabel = chunk.combined_score >= 0.35 ? '🟢 GOOD'
        : chunk.combined_score >= 0.20 ? '🟡 MODERATE'
        : '🔴 LOW';
      return `[Article ${i + 1}] - Relevance: ${relevanceLabel} (${chunk.combined_score.toFixed(3)})
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
