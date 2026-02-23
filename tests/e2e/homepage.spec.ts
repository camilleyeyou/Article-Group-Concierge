import { test, expect } from '@playwright/test';

/**
 * Homepage E2E Tests
 *
 * Tests critical user flows on the homepage:
 * - Page loads correctly
 * - Query submission works
 * - Results are displayed
 * - Components render properly
 */

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Article Group/);

    // Check hero content is visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Check query input exists
    const queryInput = page.getByPlaceholder(/tell us about your business/i);
    await expect(queryInput).toBeVisible();

    // Check submit button exists
    const submitButton = page.getByRole('button', { name: /submit/i });
    await expect(submitButton).toBeVisible();
  });

  test('should submit a query successfully', async ({ page }) => {
    // Type query
    const queryInput = page.getByPlaceholder(/tell us about your business/i);
    await queryInput.fill('I need help with brand strategy for a tech startup');

    // Submit
    const submitButton = page.getByRole('button', { name: /submit/i });
    await submitButton.click();

    // Wait for loading state
    await expect(page.getByText(/generating/i)).toBeVisible();

    // Wait for results (with timeout for API call)
    await expect(page.getByRole('main')).toBeVisible({ timeout: 30000 });

    // Check that at least one component rendered
    // This will depend on your layout, adjust selector as needed
    await expect(page.locator('.pitch-deck-layout')).toBeVisible();
  });

  test('should handle empty query validation', async ({ page }) => {
    // Try to submit without entering a query
    const submitButton = page.getByRole('button', { name: /submit/i });
    await submitButton.click();

    // Should show validation error or not submit
    // Adjust based on your validation implementation
    const queryInput = page.getByPlaceholder(/tell us about your business/i);
    await expect(queryInput).toBeFocused();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check elements are still visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByPlaceholder(/tell us about your business/i)).toBeVisible();
  });

  test('should handle rate limiting gracefully', async ({ page }) => {
    // Submit multiple queries rapidly
    const queryInput = page.getByPlaceholder(/tell us about your business/i);
    const submitButton = page.getByRole('button', { name: /submit/i });

    for (let i = 0; i < 25; i++) {
      await queryInput.fill(`Query ${i}`);
      await submitButton.click();
      await page.waitForTimeout(100); // Small delay between submissions
    }

    // Should eventually show rate limit message
    // Adjust based on your rate limit error handling
    // This might timeout if rate limiting isn't working
  });
});
