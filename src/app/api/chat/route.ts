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

export async function POST(request: NextRequest): Promise<NextResponse<OrchestratorOutput | { error: string }>> {
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
    console.log(`Processing query: "${query.slice(0, 50)}..."`);
    
    const context = await retrieveContext({
      query,
      capabilitySlugs: body.filters?.capabilities,
      industrySlugs: body.filters?.industries,
      maxChunks: 10,
      maxAssets: 5,
    });
    
    console.log(`Retrieved ${context.chunks.length} chunks, ${context.visualAssets.length} assets`);
    
    // Step 2: Run orchestrator
    const result = await orchestrate({
      userQuery: query,
      context,
      conversationHistory: body.conversationHistory,
    });
    
    console.log(`Generated layout with ${result.layoutPlan.layout.length} components`);
    
    // Return the result
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Chat API error:', error);
    
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
