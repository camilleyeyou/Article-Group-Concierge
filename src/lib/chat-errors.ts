import type { OrchestratorOutput } from '@/types';

export interface ClassifiedError {
  httpStatus: number;
  errorCode: NonNullable<OrchestratorOutput['errorCode']>;
  explanation: string;
  retryable: boolean;
  contactCTA: boolean;
}

export function classifyError(error: unknown): ClassifiedError {
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
