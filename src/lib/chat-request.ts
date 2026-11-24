/**
 * Chat request helpers shared by the JSON route and the stream route.
 */
import { getCatalogue } from '@/lib/catalogue';
import { embeddingConfig, providerRoute } from '@/lib/llm-config';
import { GENERATION_MODEL } from '@/lib/orchestrator';
import { APILogger } from '@/lib/logger';
import type { OrchestratorOutput, RetrievedContext } from '@/types';
import type { PublicOrchestratorOutput } from '@/lib/stream-events';

export interface ChatRequest {
  query: string;
  filters?: {
    capabilities?: string[];
    industries?: string[];
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  debug?: boolean; // Honoured only when the server runs with EVAL_DEBUG=true
}

export function validateChatBody(
  body: unknown,
): { ok: true; query: string; body: ChatRequest } | { ok: false; status: 400; error: string } {
  const b = body as ChatRequest | null | undefined;
  if (!b || !b.query || typeof b.query !== 'string') {
    return { ok: false, status: 400, error: 'Missing or invalid query' };
  }
  const query = b.query.trim();
  if (query.length < 3) return { ok: false, status: 400, error: 'Query too short' };
  if (query.length > 2000) return { ok: false, status: 400, error: 'Query too long (max 2000 characters)' };
  return { ok: true, query, body: b };
}

/**
 * Eval debug mode: bypass caches and return retrieval alongside the response.
 * Never set EVAL_DEBUG in production - it exposes retrieved content and raw model output.
 */
export function debugEnabled(body: Pick<ChatRequest, 'debug'> | null | undefined): boolean {
  return body?.debug === true && process.env.EVAL_DEBUG === 'true';
}

export function toPublicOutput(o: OrchestratorOutput): PublicOrchestratorOutput {
  const { rawResponse, modelRawResponse, orchestratorError, usage, catalogueVersion, verifier, ...pub } = o;
  return pub;
}

// Debug payload only (EVAL_DEBUG): the catalogue text the model saw, if still the same version
async function catalogueForDebug(version: string | null | undefined) {
  if (!version) return null;
  const cat = await getCatalogue();
  if (cat && cat.version === version) return { version, text: cat.text };
  APILogger.warn('Catalogue changed between generation and debug payload', { version });
  return { version, text: null };
}

export async function buildDebugPayload(
  result: OrchestratorOutput,
  context: RetrievedContext,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return {
    rawResponse: result.rawResponse ?? null,
    modelRawResponse: result.modelRawResponse ?? null,
    orchestratorError: result.orchestratorError ?? null,
    usage: result.usage ?? null,
    verifier: result.verifier ?? null,
    catalogue: await catalogueForDebug(result.catalogueVersion),
    models: { route: providerRoute(), generation: GENERATION_MODEL, embedding: embeddingConfig().model },
    retrieval: {
      chunks: context.chunks,
      visualAssets: context.visualAssets,
      relatedMetrics: context.relatedMetrics,
      searchFunction: context.searchFunction ?? null,
    },
    ...extra,
  };
}
