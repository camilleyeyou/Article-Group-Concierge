/**
 * Performance Monitoring
 *
 * Real-time performance tracking for:
 * - API response times
 * - RAG retrieval latency
 * - Cache hit rates
 * - Error rates
 * - Resource utilization
 *
 * Provides alerts when metrics degrade beyond thresholds
 */

import { analytics } from './analytics';
import { logger } from './logger';
import { cache } from './cache';

interface PerformanceThresholds {
  apiResponseTime: number; // ms
  ragRetrievalTime: number; // ms
  orchestratorTime: number; // ms
  cacheHitRate: number; // percentage
  errorRate: number; // percentage
}

interface PerformanceMetrics {
  timestamp: number;
  apiResponseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  ragRetrievalTime: {
    avg: number;
    p95: number;
  };
  orchestratorTime: {
    avg: number;
    p95: number;
  };
  cacheHitRate: number;
  errorRate: number;
  requestsPerMinute: number;
}

interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

class PerformanceMonitor {
  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[];
  private measurements: Map<string, number[]>;
  private lastCleanup: number;

  constructor() {
    this.thresholds = {
      apiResponseTime: 5000, // 5 seconds
      ragRetrievalTime: 2000, // 2 seconds
      orchestratorTime: 10000, // 10 seconds
      cacheHitRate: 30, // 30% minimum
      errorRate: 5, // 5% maximum
    };

    this.alerts = [];
    this.measurements = new Map();
    this.lastCleanup = Date.now();

    // Cleanup old measurements every 5 minutes
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Record a measurement
   */
  record(metric: string, value: number): void {
    if (!this.measurements.has(metric)) {
      this.measurements.set(metric, []);
    }

    const values = this.measurements.get(metric)!;
    values.push(value);

    // Keep only last 1000 measurements per metric
    if (values.length > 1000) {
      values.shift();
    }

    // Track in analytics
    analytics.trackPerformance(metric, value);

    // Check thresholds
    this.checkThresholds(metric, value);
  }

  /**
   * Check if metrics exceed thresholds
   */
  private checkThresholds(metric: string, value: number): void {
    let threshold: number | undefined;
    let type: 'warning' | 'critical' = 'warning';

    // Map metric names to thresholds
    if (metric.includes('api_response')) {
      threshold = this.thresholds.apiResponseTime;
    } else if (metric.includes('rag_retrieval')) {
      threshold = this.thresholds.ragRetrievalTime;
    } else if (metric.includes('orchestrator')) {
      threshold = this.thresholds.orchestratorTime;
    }

    if (threshold && value > threshold) {
      // Critical if 2x threshold
      if (value > threshold * 2) {
        type = 'critical';
      }

      this.addAlert({
        type,
        metric,
        message: `${metric} exceeded threshold: ${value}ms > ${threshold}ms`,
        value,
        threshold,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Add a performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // Log alert
    const alertContext = {
      type: alert.type,
      metric: alert.metric,
      message: alert.message,
      value: alert.value,
      threshold: alert.threshold,
      timestamp: alert.timestamp,
    };

    if (alert.type === 'critical') {
      logger.error('Performance alert (critical)', undefined, alertContext);
    } else {
      logger.warn('Performance alert (warning)', alertContext);
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const apiTimes = this.measurements.get('api_response_time') || [];
    const ragTimes = this.measurements.get('rag_retrieval_time') || [];
    const orchTimes = this.measurements.get('orchestrator_time') || [];

    // Get analytics data
    const analyticsData = analytics.getDashboard();

    return {
      timestamp: Date.now(),
      apiResponseTime: {
        avg: apiTimes.length > 0
          ? apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length
          : 0,
        p50: this.percentile(apiTimes, 50),
        p95: this.percentile(apiTimes, 95),
        p99: this.percentile(apiTimes, 99),
      },
      ragRetrievalTime: {
        avg: ragTimes.length > 0
          ? ragTimes.reduce((a, b) => a + b, 0) / ragTimes.length
          : 0,
        p95: this.percentile(ragTimes, 95),
      },
      orchestratorTime: {
        avg: orchTimes.length > 0
          ? orchTimes.reduce((a, b) => a + b, 0) / orchTimes.length
          : 0,
        p95: this.percentile(orchTimes, 95),
      },
      cacheHitRate: analyticsData.queries.cacheHitRate || 0,
      errorRate: analyticsData.queries.errorRate || 0,
      requestsPerMinute: analyticsData.queries.queriesLastHour / 60 || 0,
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-limit).reverse();
  }

  /**
   * Get health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    metrics: PerformanceMetrics;
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check API response time
    if (metrics.apiResponseTime.p95 > this.thresholds.apiResponseTime * 2) {
      issues.push(`API response time critical: ${Math.round(metrics.apiResponseTime.p95)}ms`);
      status = 'critical';
    } else if (metrics.apiResponseTime.p95 > this.thresholds.apiResponseTime) {
      issues.push(`API response time degraded: ${Math.round(metrics.apiResponseTime.p95)}ms`);
      if (status === 'healthy') status = 'degraded';
    }

    // Check error rate
    if (metrics.errorRate > this.thresholds.errorRate * 2) {
      issues.push(`Error rate critical: ${metrics.errorRate.toFixed(1)}%`);
      status = 'critical';
    } else if (metrics.errorRate > this.thresholds.errorRate) {
      issues.push(`Error rate elevated: ${metrics.errorRate.toFixed(1)}%`);
      if (status === 'healthy') status = 'degraded';
    }

    // Check cache hit rate
    if (metrics.cacheHitRate < this.thresholds.cacheHitRate) {
      issues.push(`Cache hit rate low: ${metrics.cacheHitRate.toFixed(1)}%`);
      if (status === 'healthy') status = 'degraded';
    }

    return {
      status,
      issues,
      metrics,
    };
  }

  /**
   * Cleanup old measurements
   */
  private cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const [metric, values] of this.measurements.entries()) {
      // Keep only last hour of data
      if (values.length > 0) {
        this.measurements.set(metric, values.slice(-360)); // ~1 per 10 seconds for an hour
      }
    }

    // Clean old alerts
    this.alerts = this.alerts.filter(a => a.timestamp > oneHourAgo);

    this.lastCleanup = Date.now();
    logger.debug('Performance monitoring cleanup completed');
  }

  /**
   * Update thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Performance thresholds updated', { ...this.thresholds });
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.measurements.clear();
    this.alerts = [];
    logger.debug('Performance monitoring data cleared');
  }
}

// Export singleton instance
export const performance = new PerformanceMonitor();

// Convenience exports
export const recordPerformance = performance.record.bind(performance);
export const getPerformanceMetrics = performance.getMetrics.bind(performance);
export const getPerformanceHealth = performance.getHealth.bind(performance);
