/**
 * Analytics Dashboard API
 *
 * Returns analytics data for monitoring system health and usage
 * In production, this should be protected with authentication
 */

import { NextResponse } from 'next/server';
import { analytics } from '@/lib/analytics';
import { cache } from '@/lib/cache';
import { rateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dashboard = analytics.getDashboard();
    const cacheStats = cache.getStats();
    const rateLimiterStats = rateLimiter.getStats();

    return NextResponse.json({
      analytics: dashboard,
      cache: cacheStats,
      rateLimiter: rateLimiterStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
