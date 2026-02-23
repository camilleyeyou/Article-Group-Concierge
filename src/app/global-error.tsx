'use client';

/**
 * Global Error Boundary
 *
 * Catches errors in the root layout. This is a fallback for critical errors
 * that occur before the app is fully loaded.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production, this would be sent to an error tracking service
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem',
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: 'white',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '2rem',
            textAlign: 'center',
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '1rem',
            }}>
              Application Error
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '1.5rem',
            }}>
              A critical error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={reset}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#32373c',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
