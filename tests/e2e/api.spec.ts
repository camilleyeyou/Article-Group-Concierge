import { test, expect } from '@playwright/test';

/**
 * API E2E Tests
 *
 * Tests critical API endpoints:
 * - Health check
 * - Analytics
 * - Chat API
 */

test.describe('API Endpoints', () => {
  test('GET /api/health should return health status', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('metrics');
    expect(data).toHaveProperty('timestamp');

    // Check health status is valid
    expect(['healthy', 'degraded', 'critical']).toContain(data.status);
  });

  test('GET /api/analytics should return analytics data', async ({ request }) => {
    const response = await request.get('/api/analytics');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('analytics');
    expect(data).toHaveProperty('cache');
    expect(data).toHaveProperty('timestamp');

    // Check analytics structure
    expect(data.analytics).toHaveProperty('queries');
    expect(data.analytics).toHaveProperty('components');
    expect(data.analytics).toHaveProperty('performance');
  });

  test('POST /api/chat should accept valid query', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: {
        query: 'I need help with brand strategy for a tech startup',
      },
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('layoutPlan');
    expect(data).toHaveProperty('explanation');

    // Check layout plan structure
    expect(data.layoutPlan).toHaveProperty('layout');
    expect(Array.isArray(data.layoutPlan.layout)).toBeTruthy();
  });

  test('POST /api/chat should reject empty query', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: {
        query: '',
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('POST /api/chat should handle rate limiting', async ({ request }) => {
    // Send multiple requests rapidly to trigger rate limit
    const requests = [];
    for (let i = 0; i < 25; i++) {
      requests.push(
        request.post('/api/chat', {
          data: { query: `Test query ${i}` },
        })
      );
    }

    const responses = await Promise.all(requests);

    // At least one should be rate limited (429)
    const rateLimitedResponses = responses.filter((r) => r.status() === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);

    // Check rate limit response format
    if (rateLimitedResponses.length > 0) {
      const data = await rateLimitedResponses[0].json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('retryAfter');
    }
  });

  test('POST /api/chat should handle long query', async ({ request }) => {
    const longQuery = 'a'.repeat(2500); // Over 2000 char limit

    const response = await request.post('/api/chat', {
      data: { query: longQuery },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('too long');
  });

  test('GET /api/analytics should respond quickly', async ({ request }) => {
    const start = Date.now();
    const response = await request.get('/api/analytics');
    const duration = Date.now() - start;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(1000); // Should respond in < 1 second
  });
});
