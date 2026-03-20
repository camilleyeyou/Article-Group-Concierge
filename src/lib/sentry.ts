/**
 * Sentry Error Monitoring Integration
 *
 * Wraps @sentry/nextjs with convenience helpers used throughout the app.
 * The SDK is initialized via sentry.client.config.ts / sentry.server.config.ts
 * at the root of the project.
 *
 * Setup:
 * 1. npm install @sentry/nextjs  (already installed)
 * 2. Set SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN in .env.local
 * 3. The root config files handle initialization automatically
 */

import * as Sentry from '@sentry/nextjs';

export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(error, {
    contexts: context ? { custom: context } : undefined,
  });
}

export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): void {
  Sentry.captureMessage(message, level);
}

export function setUser(
  user: { id: string; email?: string; username?: string } | null
): void {
  Sentry.setUser(user);
}

export function addBreadcrumb(
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    data,
    timestamp: Date.now() / 1000,
  });
}
