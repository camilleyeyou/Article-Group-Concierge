'use client';

/**
 * Next.js Error Boundary
 *
 * This file is automatically used by Next.js as an error boundary
 * for the app directory. It catches errors in server and client components.
 */

import { useEffect } from 'react';
import { UILogger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error
    UILogger.error('App-level error caught', error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-3 mb-4">
          <svg
            className="w-8 h-8 text-red-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl font-medium text-gray-900">Something went wrong</h2>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          We encountered an unexpected error while loading this page. This has been logged and
          we'll look into it.
        </p>

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 px-4 py-2.5 bg-[#32373c] text-white rounded hover:bg-[#1a1a1a] transition-colors text-sm font-medium"
          >
            Try again
          </button>
          <a
            href="/"
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-sm font-medium text-center"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
