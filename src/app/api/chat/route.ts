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

interface ClassifiedError {
  httpStatus: number;
  errorCode: NonNullable<OrchestratorOutput['errorCode']>;
  explanation: string;
  retryable: boolean;
  contactCTA: boolean;
}

function classifyError(error: unknown): ClassifiedError {
  const err = error as { code?: string; status?: number; message?: string } | undefined;
  const code = err?.code;
  const message = err?.message || '';

  if (code === 'embeddings_quota_exceeded') {
    return {
      httpStatus: 503,
      errorCode: 'embeddings_unavailable',
      explanation:
        "Our search service is temporarily unavailable due to a billing issue on our embeddings provider. We've been notified — please try again shortly, or contact our Strategy Lead if it's urgent.",
      retryable: false,
      contactCTA: true,
    };
  }
  if (code === 'embeddings_rate_limited') {
    return {
      httpStatus: 503,
      errorCode: 'upstream_rate_limit',
      explanation:
        "We're getting a high volume of requests right now. Please wait a moment and try again.",
      retryable: true,
      contactCTA: false,
    };
  }
  if (code === 'embeddings_failed') {
    return {
      httpStatus: 503,
      errorCode: 'embeddings_unavailable',
      explanation:
        "Our search service hit a temporary snag. Please try again in a moment.",
      retryable: true,
      contactCTA: false,
    };
  }

  // Supabase / Postgres errors typically have a `code` field like 'PGRST...' or a `details` field
  if (
    message.toLowerCase().includes('supabase') ||
    /pgrst|postgrest|database/i.test(message)
  ) {
    return {
      httpStatus: 503,
      errorCode: 'database_unavailable',
      explanation:
        "We couldn't reach our portfolio database just now. Please try again — if the issue persists, our Strategy Lead can help.",
      retryable: true,
      contactCTA: true,
    };
  }

  return {
    httpStatus: 500,
    errorCode: 'internal_error',
    explanation:
      "I apologize, but I encountered an unexpected issue. Please try again, or contact our Strategy Lead if it persists.",
    retryable: true,
    contactCTA: true,
  };
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', service: 'article-group-concierge' });
}
