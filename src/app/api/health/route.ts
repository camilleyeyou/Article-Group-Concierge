/**
 * Health Check & Performance API
 *
 * Returns system health status and performance metrics
 * Useful for monitoring and alerting
 */

import { NextResponse } from 'next/server';
import { performance } from '@/lib/performance';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = performance.getHealth();
    const alerts = performance.getAlerts(5);

    return NextResponse.json({
      ...health,
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
