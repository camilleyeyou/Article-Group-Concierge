/**
 * In-Memory Cache with TTL
 *
 * Simple caching layer to reduce API calls for:
 * - Query embeddings (OpenAI)
 * - RAG search results (Supabase)
 * - Orchestrator responses (Claude)
 *
 * Expected cost savings: 50-80% on repeated queries
 */

import { logger } from './logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.cleanupInterval = null;

    // Run cleanup every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Generate a cache key from any input
   */
  private generateKey(prefix: string, input: unknown): string {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    return `${prefix}:${inputStr}`;
  }

  /**
   * Get value from cache
   */
  get<T>(prefix: string, key: unknown): T | null {
    const cacheKey = this.generateKey(prefix, key);
    const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    logger.debug('Cache hit', { prefix, cacheKey: cacheKey.slice(0, 50) });
    return entry.value;
  }

  /**
   * Set value in cache with TTL in seconds
   */
  set<T>(prefix: string, key: unknown, value: T, ttlSeconds: number): void {
    const cacheKey = this.generateKey(prefix, key);

    // If cache is full, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    logger.debug('Cache set', {
      prefix,
      cacheKey: cacheKey.slice(0, 50),
      ttl: ttlSeconds,
    });
  }

  /**
   * Delete specific entry
   */
  delete(prefix: string, key: unknown): void {
    const cacheKey = this.generateKey(prefix, key);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all entries with a specific prefix
   */
  clearPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${prefix}:`)) {
        this.cache.delete(key);
      }
    }
    logger.debug('Cache prefix cleared', { prefix });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Cache cleared');
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup completed', { removed });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
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
export const cache = new InMemoryCache();

// Cache prefixes for different types of data
export const CACHE_PREFIXES = {
  EMBEDDING: 'emb',           // Query embeddings (24 hour TTL)
  RAG_SEARCH: 'rag',          // RAG search results (1 hour TTL)
  ORCHESTRATOR: 'orch',       // Orchestrator responses (30 min TTL)
  VISUAL_ASSETS: 'visual',    // Visual asset searches (1 hour TTL)
  METRICS: 'metrics',         // Document metrics (24 hour TTL)
  TAXONOMY: 'taxonomy',       // Capabilities/industries/topics (24 hour TTL)
} as const;

// TTL configurations (in seconds)
export const CACHE_TTL = {
  EMBEDDING: 24 * 60 * 60,      // 24 hours - embeddings don't change
  RAG_SEARCH: 60 * 60,          // 1 hour - case studies rarely updated
  ORCHESTRATOR: 30 * 60,        // 30 minutes - responses should be fresh
  VISUAL_ASSETS: 60 * 60,       // 1 hour
  METRICS: 24 * 60 * 60,        // 24 hours - metrics rarely change
  TAXONOMY: 24 * 60 * 60,       // 24 hours - taxonomy rarely changes
} as const;
