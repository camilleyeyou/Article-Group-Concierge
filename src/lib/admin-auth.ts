/**
 * Admin API Authentication
 *
 * Protects internal endpoints (/api/health, /api/analytics) with a
 * bearer token check. The token is set via ADMIN_API_TOKEN env var.
 *
 * Usage in a route handler:
 *   const authError = requireAdminAuth(request);
 *   if (authError) return authError;
 */

import { NextRequest, NextResponse } from 'next/server';

export function requireAdminAuth(request: NextRequest): NextResponse | null {
  const token = process.env.ADMIN_API_TOKEN;

  // In development, allow unauthenticated access
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  // If no token is configured, block all access in production
  if (!token) {
    return NextResponse.json(
      { error: 'Admin endpoint not configured' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${token}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null;
}
