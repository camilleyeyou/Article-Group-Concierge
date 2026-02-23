/**
 * Sentry Error Monitoring Integration
 *
 * To enable Sentry:
 * 1. Install: npm install @sentry/nextjs
 * 2. Run: npx @sentry/wizard@latest -i nextjs
 * 3. Add SENTRY_DSN to .env.local
 * 4. Uncomment the imports below
 *
 * This module provides a wrapper for Sentry that:
 * - Only initializes in production
 * - Integrates with our logger
 * - Captures user context
 * - Tracks performance
 */

// Uncomment when @sentry/nextjs is installed:
// import * as Sentry from '@sentry/nextjs';

import { logger } from './logger';

interface SentryConfig {
  dsn?: string;
  environment: string;
  tracesSampleRate: number;
  enabled: boolean;
}

class SentryIntegration {
  private config: SentryConfig;
  private initialized: boolean = false;

  constructor() {
    this.config = {
      dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production',
    };
  }

  /**
   * Initialize Sentry
   * Call this in your root layout or _app.tsx
   */
  init(): void {
    if (this.initialized || !this.config.enabled || !this.config.dsn) {
      return;
    }

    try {
      // Uncomment when @sentry/nextjs is installed:
      /*
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        tracesSampleRate: this.config.tracesSampleRate,

        // Performance monitoring
        integrations: [
          new Sentry.BrowserTracing({
            tracePropagationTargets: ['localhost', /^\//],
          }),
        ],

        // Error filtering
        beforeSend(event, hint) {
          // Don't send errors in development
          if (process.env.NODE_ENV !== 'production') {
            return null;
          }

          // Filter out specific errors
          const error = hint.originalException;
          if (error && typeof error === 'object' && 'message' in error) {
            const message = (error as Error).message;

            // Ignore network errors that are user-related
            if (message.includes('Network request failed')) {
              return null;
            }

            // Ignore cancelled requests
            if (message.includes('cancelled') || message.includes('aborted')) {
              return null;
            }
          }

          return event;
        },
      });
      */

      this.initialized = true;
      logger.info('Sentry initialized', { environment: this.config.environment });
    } catch (error) {
      logger.error('Failed to initialize Sentry', error);
    }
  }

  /**
   * Capture an exception
   */
  captureException(error: Error | unknown, context?: Record<string, unknown>): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Uncomment when @sentry/nextjs is installed:
      /*
      Sentry.captureException(error, {
        contexts: {
          custom: context,
        },
      });
      */

      logger.error('Exception captured by Sentry', error, context);
    } catch (e) {
      logger.error('Failed to capture exception in Sentry', e);
    }
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Uncomment when @sentry/nextjs is installed:
      /*
      Sentry.captureMessage(message, level);
      */

      logger.info('Message captured by Sentry', { message, level });
    } catch (e) {
      logger.error('Failed to capture message in Sentry', e);
    }
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string } | null): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Uncomment when @sentry/nextjs is installed:
      /*
      Sentry.setUser(user);
      */

      logger.debug('User context set in Sentry', { userId: user?.id });
    } catch (e) {
      logger.error('Failed to set user context in Sentry', e);
    }
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, data?: Record<string, unknown>): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Uncomment when @sentry/nextjs is installed:
      /*
      Sentry.addBreadcrumb({
        message,
        data,
        timestamp: Date.now() / 1000,
      });
      */

      logger.debug('Breadcrumb added to Sentry', { message, data });
    } catch (e) {
      logger.error('Failed to add breadcrumb to Sentry', e);
    }
  }

  /**
   * Start a transaction for performance monitoring
   */
  startTransaction(name: string, op: string): SentryTransaction {
    if (!this.config.enabled) {
      return new SentryTransaction(name, op);
    }

    try {
      // Uncomment when @sentry/nextjs is installed:
      /*
      const transaction = Sentry.startTransaction({ name, op });
      return new SentryTransaction(name, op, transaction);
      */

      return new SentryTransaction(name, op);
    } catch (e) {
      logger.error('Failed to start transaction in Sentry', e);
      return new SentryTransaction(name, op);
    }
  }

  /**
   * Check if Sentry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.initialized;
  }
}

/**
 * Transaction wrapper for performance monitoring
 */
class SentryTransaction {
  private name: string;
  private op: string;
  private startTime: number;
  // private transaction?: any; // Uncomment when @sentry/nextjs is installed

  constructor(name: string, op: string /* , transaction?: any */) {
    this.name = name;
    this.op = op;
    this.startTime = Date.now();
    // this.transaction = transaction; // Uncomment when @sentry/nextjs is installed
  }

  /**
   * Finish the transaction
   */
  finish(): void {
    const duration = Date.now() - this.startTime;

    try {
      // Uncomment when @sentry/nextjs is installed:
      /*
      if (this.transaction) {
        this.transaction.finish();
      }
      */

      logger.debug('Transaction finished', {
        name: this.name,
        op: this.op,
        duration_ms: duration,
      });
    } catch (e) {
      logger.error('Failed to finish transaction', e);
    }
  }
}

// Export singleton instance
export const sentry = new SentryIntegration();

// Convenience exports
export const captureException = sentry.captureException.bind(sentry);
export const captureMessage = sentry.captureMessage.bind(sentry);
export const setUser = sentry.setUser.bind(sentry);
export const addBreadcrumb = sentry.addBreadcrumb.bind(sentry);
export const startTransaction = sentry.startTransaction.bind(sentry);
