/**
 * Health Check & Performance API
 *
 * Returns system health status and performance metrics.
 * Protected by admin bearer token in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { performance } from '@/lib/performance';
import { requireAdminAuth } from '@/lib/admin-auth';
import { checkProviderHealth } from '@/lib/provider-health';
import { CONCIERGE_CONFIG } from '@/lib/concierge-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const health = performance.getHealth();
    const alerts = performance.getAlerts(5);

    return NextResponse.json({
      ...health,
      provider: await checkProviderHealth({ timeoutMs: CONCIERGE_CONFIG.health.requestTimeoutMs }),
      alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to fetch health status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
