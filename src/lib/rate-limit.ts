/**
 * Rate Limiting
 *
 * Simple in-memory rate limiter to prevent API abuse.
 * Tracks requests per IP address with sliding window.
 *
 * Production upgrade: Use Redis or Upstash for distributed rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { APILogger } from './logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.requests = new Map();
    this.cleanupInterval = null;

    // Cleanup expired entries every minute
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  /**
   * Get client identifier from request
   * Uses IP address, but can be extended to use API keys
   */
  private getClientId(request: NextRequest): string {
    // Try to get real IP from headers (for proxied requests)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || realIp || 'unknown';
    return ip;
  }

  /**
   * Check if request should be rate limited
   * Returns null if allowed, or NextResponse with 429 status if rate limited
   */
  check(
    request: NextRequest,
    options: {
      maxRequests: number;
      windowMs: number;
      message?: string;
    }
  ): NextResponse | null {
    const clientId = this.getClientId(request);
    const now = Date.now();
    const entry = this.requests.get(clientId);

    // No previous requests or window expired
    if (!entry || now > entry.resetAt) {
      this.requests.set(clientId, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return null;
    }

    // Increment request count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > options.maxRequests) {
      const resetIn = Math.ceil((entry.resetAt - now) / 1000);

      APILogger.warn('Rate limit exceeded', {
        clientId,
        count: entry.count,
        limit: options.maxRequests,
        resetIn,
      });

      return NextResponse.json(
        {
          error: options.message || 'Too many requests',
          retryAfter: resetIn,
        },
        {
          status: 429,
          headers: {
            'Retry-After': resetIn.toString(),
            'X-RateLimit-Limit': options.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(entry.resetAt / 1000).toString(),
          },
        }
      );
    }

    return null;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [clientId, entry] of this.requests.entries()) {
      if (now > entry.resetAt) {
        this.requests.delete(clientId);
        removed++;
      }
    }

    if (removed > 0) {
      APILogger.debug('Rate limiter cleanup completed', { removed });
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      activeClients: this.requests.size,
    };
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.requests.clear();
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Preset configurations for different endpoints
export const RATE_LIMITS = {
  // Chat API: 20 requests per minute
  CHAT: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    message: 'Too many chat requests. Please wait a moment before trying again.',
  },
  // General API: 60 requests per minute
  API: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    message: 'Too many requests. Please slow down.',
  },
  // Strict limit for expensive operations: 5 per minute
  STRICT: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    message: 'Rate limit exceeded. Please wait before trying again.',
  },
} as const;

/**
 * Convenience middleware wrapper
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options = RATE_LIMITS.API
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResponse = rateLimiter.check(request, options);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Proceed with handler
    return handler(request);
  };
}
