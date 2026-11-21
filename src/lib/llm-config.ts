/**
 * Article Group AI Concierge - LLM Provider Config
 *
 * Routes embeddings and Claude calls either directly (OpenAI + Anthropic keys)
 * or through OpenRouter when OPENROUTER_API_KEY is set, so one account can
 * cover everything.
 *
 * Everything here reads env at call time: the ingestion scripts load dotenv
 * after their imports run.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api';

export function usingOpenRouter(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export type ProviderRoute = 'openrouter' | 'direct';

/** Which provider route model calls take right now (env is read at call time). */
export function providerRoute(): ProviderRoute {
  return usingOpenRouter() ? 'openrouter' : 'direct';
}

/**
 * Embedding endpoint settings. The model must stay text-embedding-3-small
 * (1536 dims) on both paths, or new query vectors won't match the stored index.
 */
export function embeddingConfig(): { baseURL: string; apiKey: string | undefined; model: string } {
  if (usingOpenRouter()) {
    return {
      baseURL: `${OPENROUTER_BASE}/v1`,
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'openai/text-embedding-3-small',
    };
  }
  return {
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
  };
}

/** Options for `new Anthropic(...)`. OpenRouter serves the Messages API at /api/v1/messages. */
export function anthropicClientOptions(): { baseURL?: string; apiKey?: string | null; authToken?: string | null } {
  if (usingOpenRouter()) {
    return { baseURL: OPENROUTER_BASE, apiKey: null, authToken: process.env.OPENROUTER_API_KEY };
  }
  return { apiKey: process.env.ANTHROPIC_API_KEY };
}

/**
 * Maps an Anthropic model id to the provider's id:
 * 'claude-sonnet-5-5' -> 'anthropic/claude-sonnet-5.5' on OpenRouter.
 * Ids that already contain a '/' are passed through unchanged.
 */
export function claudeModelId(id: string): string {
  if (!usingOpenRouter() || id.includes('/')) return id;
  return `anthropic/${id.replace(/-(\d+)-(\d+)$/, '-$1.$2')}`;
}
