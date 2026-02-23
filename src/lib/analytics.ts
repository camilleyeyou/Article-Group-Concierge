/**
 * Analytics Tracking
 *
 * Simple analytics system to track:
 * - Query patterns and frequency
 * - Component usage statistics
 * - Performance metrics (latency, cache hits)
 * - Error rates
 *
 * Production upgrade: Send to analytics service (PostHog, Mixpanel, etc.)
 */

import { logger } from './logger';

interface QueryEvent {
  query: string;
  timestamp: number;
  responseTime?: number;
  componentsGenerated?: number;
  cacheHit?: boolean;
  error?: boolean;
}

interface ComponentUsageEvent {
  componentType: string;
  timestamp: number;
}

interface PerformanceEvent {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

class Analytics {
  private queries: QueryEvent[];
  private componentUsage: Map<string, number>;
  private performanceMetrics: PerformanceEvent[];
  private maxEvents: number;

  constructor(maxEvents: number = 1000) {
    this.queries = [];
    this.componentUsage = new Map();
    this.performanceMetrics = [];
    this.maxEvents = maxEvents;
  }

  /**
   * Track a query event
   */
  trackQuery(event: Omit<QueryEvent, 'timestamp'>): void {
    const queryEvent: QueryEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.queries.push(queryEvent);

    // Keep only recent events
    if (this.queries.length > this.maxEvents) {
      this.queries.shift();
    }

    logger.debug('Analytics: Query tracked', {
      query: event.query.slice(0, 50),
      responseTime: event.responseTime,
      cacheHit: event.cacheHit,
    });
  }

  /**
   * Track component usage
   */
  trackComponentUsage(componentType: string): void {
    const current = this.componentUsage.get(componentType) || 0;
    this.componentUsage.set(componentType, current + 1);

    logger.debug('Analytics: Component usage tracked', { componentType });
  }

  /**
   * Track performance metric
   */
  trackPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    const event: PerformanceEvent = {
      operation,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.performanceMetrics.push(event);

    // Keep only recent events
    if (this.performanceMetrics.length > this.maxEvents) {
      this.performanceMetrics.shift();
    }

    logger.debug('Analytics: Performance tracked', {
      operation,
      duration: `${duration}ms`,
    });
  }

  /**
   * Get query statistics
   */
  getQueryStats() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentQueries = this.queries.filter(q => q.timestamp > oneHourAgo);
    const dailyQueries = this.queries.filter(q => q.timestamp > oneDayAgo);

    const avgResponseTime =
      recentQueries.length > 0
        ? recentQueries
            .filter(q => q.responseTime)
            .reduce((sum, q) => sum + (q.responseTime || 0), 0) / recentQueries.length
        : 0;

    const cacheHitRate =
      recentQueries.length > 0
        ? recentQueries.filter(q => q.cacheHit).length / recentQueries.length
        : 0;

    const errorRate =
      recentQueries.length > 0
        ? recentQueries.filter(q => q.error).length / recentQueries.length
        : 0;

    return {
      totalQueries: this.queries.length,
      queriesLastHour: recentQueries.length,
      queriesLast24Hours: dailyQueries.length,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRate: Math.round(cacheHitRate * 100),
      errorRate: Math.round(errorRate * 100),
    };
  }

  /**
   * Get component usage statistics
   */
  getComponentStats() {
    const sortedComponents = Array.from(this.componentUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    return {
      totalComponents: Array.from(this.componentUsage.values()).reduce(
        (sum, count) => sum + count,
        0
      ),
      uniqueComponents: this.componentUsage.size,
      topComponents: sortedComponents.slice(0, 10),
      breakdown: Object.fromEntries(this.componentUsage),
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    if (this.performanceMetrics.length === 0) {
      return {
        operations: {},
        avgDuration: 0,
      };
    }

    // Group by operation
    const byOperation = this.performanceMetrics.reduce((acc, event) => {
      if (!acc[event.operation]) {
        acc[event.operation] = [];
      }
      acc[event.operation].push(event.duration);
      return acc;
    }, {} as Record<string, number[]>);

    // Calculate stats per operation
    const operations = Object.entries(byOperation).reduce((acc, [op, durations]) => {
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);

      acc[op] = {
        count: durations.length,
        avg: Math.round(avg),
        max,
        min,
      };
      return acc;
    }, {} as Record<string, { count: number; avg: number; max: number; min: number }>);

    const avgDuration =
      this.performanceMetrics.reduce((sum, e) => sum + e.duration, 0) /
      this.performanceMetrics.length;

    return {
      operations,
      avgDuration: Math.round(avgDuration),
    };
  }

  /**
   * Get comprehensive dashboard data
   */
  getDashboard() {
    return {
      queries: this.getQueryStats(),
      components: this.getComponentStats(),
      performance: this.getPerformanceStats(),
    };
  }

  /**
   * Timer helper for tracking operation duration
   */
  startTimer(operation: string): (metadata?: Record<string, unknown>) => void {
    const start = Date.now();
    return (metadata?: Record<string, unknown>) => {
      const duration = Date.now() - start;
      this.trackPerformance(operation, duration, metadata);
    };
  }

  /**
   * Clear all analytics data
   */
  clear(): void {
    this.queries = [];
    this.componentUsage.clear();
    this.performanceMetrics = [];
    logger.debug('Analytics data cleared');
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Convenience exports
export const trackQuery = analytics.trackQuery.bind(analytics);
export const trackComponentUsage = analytics.trackComponentUsage.bind(analytics);
export const trackPerformance = analytics.trackPerformance.bind(analytics);
export const startTimer = analytics.startTimer.bind(analytics);
