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
import { classifyError } from '@/lib/chat-errors';
import { validateChatBody, debugEnabled, toPublicOutput, buildDebugPayload } from '@/lib/chat-request';
import type { OrchestratorOutput } from '@/types';
import { APILogger } from '@/lib/logger';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { analytics } from '@/lib/analytics';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60s for complex queries

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check rate limit
  const rateLimitResponse = rateLimiter.check(request, RATE_LIMITS.CHAT);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Start timer for analytics
  const requestTimer = analytics.startTimer('chat_request');

  try {
    const parsed = validateChatBody(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { body, query } = parsed;

    // Eval debug mode: bypass caches and return retrieval alongside the response.
    // Debug gate lives in debugEnabled() only.
    const debug = debugEnabled(body);

    // Step 1: Retrieve relevant context
    APILogger.info('Processing query', { query: query.slice(0, 50) + '...' });

    const context = await retrieveContext({
      query,
      capabilitySlugs: body.filters?.capabilities,
      industrySlugs: body.filters?.industries,
      maxChunks: 10,
      maxAssets: 5,
      skipCache: debug,
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
      skipCache: debug,
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
    const publicResult = toPublicOutput(result);
    if (!debug) {
      return NextResponse.json(publicResult);
    }
    return NextResponse.json({
      ...publicResult,
      debug: await buildDebugPayload(result, context),
    });

  } catch (error) {
    APILogger.error('Chat API error', error);

    // Track error
    requestTimer({ success: false, error: true });
    analytics.trackQuery({
      query: 'unknown',
      error: true,
    });

    const classified = classifyError(error);
    return NextResponse.json(
      {
        layoutPlan: { layout: [] },
        explanation: classified.explanation,
        contactCTA: classified.contactCTA,
        errorCode: classified.errorCode,
        retryable: classified.retryable,
      } as OrchestratorOutput,
      { status: classified.httpStatus }
    );
  }
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', service: 'article-group-concierge' });
}
