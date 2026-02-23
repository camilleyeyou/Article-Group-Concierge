/**
 * Article Group AI Concierge - Chat API Route
 * 
 * POST /api/chat
 * 
 * Handles user queries by:
 * 1. Retrieving relevant context from Supabase
 * 2. Passing to the orchestrator (Claude)
 * 3. Returning the layout plan + explanation
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrieveContext } from '@/lib/supabase';
import { orchestrate } from '@/lib/orchestrator';
import type { OrchestratorOutput } from '@/types';
import { APILogger } from '@/lib/logger';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { analytics } from '@/lib/analytics';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60s for complex queries

interface ChatRequest {
  query: string;
  filters?: {
    capabilities?: string[];
    industries?: string[];
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check rate limit
  const rateLimitResponse = rateLimiter.check(request, RATE_LIMITS.CHAT);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Start timer for analytics
  const requestTimer = analytics.startTimer('chat_request');

  try {
    const body: ChatRequest = await request.json();

    // Validate request
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query' },
        { status: 400 }
      );
    }

    const query = body.query.trim();
    if (query.length < 3) {
      return NextResponse.json(
        { error: 'Query too short' },
        { status: 400 }
      );
    }

    if (query.length > 2000) {
      return NextResponse.json(
        { error: 'Query too long (max 2000 characters)' },
        { status: 400 }
      );
    }
    
    // Step 1: Retrieve relevant context
    APILogger.info('Processing query', { query: query.slice(0, 50) + '...' });

    const context = await retrieveContext({
      query,
      capabilitySlugs: body.filters?.capabilities,
      industrySlugs: body.filters?.industries,
      maxChunks: 10,
      maxAssets: 5,
    });

    APILogger.info('Retrieved context', {
      chunks: context.chunks.length,
      assets: context.visualAssets.length,
    });
    
    // Step 2: Run orchestrator
    const result = await orchestrate({
      userQuery: query,
      context,
      conversationHistory: body.conversationHistory,
    });

    APILogger.info('Generated layout', {
      components: result.layoutPlan.layout.length,
    });

    // Track successful query
    requestTimer({ success: true, components: result.layoutPlan.layout.length });
    analytics.trackQuery({
      query,
      componentsGenerated: result.layoutPlan.layout.length,
      cacheHit: false, // TODO: Detect cache hits
      error: false,
    });

    // Track component usage
    result.layoutPlan.layout.forEach(item => {
      analytics.trackComponentUsage(item.component);
    });

    // Return the result
    return NextResponse.json(result);
    
  } catch (error) {
    APILogger.error('Chat API error', error);

    // Track error
    requestTimer({ success: false, error: true });
    analytics.trackQuery({
      query: 'unknown',
      error: true,
    });

    return NextResponse.json(
      { 
        error: 'An error occurred processing your request',
        layoutPlan: { layout: [] },
        explanation: 'I apologize, but I encountered an issue. Please try again or contact our Strategy Lead.',
        contactCTA: true,
      } as OrchestratorOutput,
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', service: 'article-group-concierge' });
}
