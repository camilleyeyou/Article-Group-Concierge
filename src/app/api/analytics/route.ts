/**
 * Analytics Dashboard API
 *
 * Returns analytics data for monitoring system health and usage.
 * Protected by admin bearer token in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analytics } from '@/lib/analytics';
import { cache } from '@/lib/cache';
import { rateLimiter } from '@/lib/rate-limit';
import { requireAdminAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

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
