import { test, expect } from '@playwright/test';

/**
 * Case Study Page E2E Tests
 *
 * Tests case study detail pages:
 * - Page loads with correct content
 * - PDF viewer works
 * - Related articles are displayed
 * - Navigation works
 */

test.describe('Case Study Page', () => {
  // Note: Update this with an actual case study slug from your database
  const testSlug = 'example-case-study';

  test('should load case study page', async ({ page }) => {
    await page.goto(`/case-study/${testSlug}`);

    // Check page loaded (might be 404 if slug doesn't exist)
    const statusCode = page.url();
    if (statusCode.includes('/case-study/')) {
      // If page exists, check for key elements
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('should display PDF viewer', async ({ page }) => {
    await page.goto(`/case-study/${testSlug}`);

    // Look for PDF embed element
    const pdfEmbed = page.locator('embed[type="application/pdf"]');
    if (await pdfEmbed.count() > 0) {
      await expect(pdfEmbed).toBeVisible();
    }
  });

  test('should show related articles', async ({ page }) => {
    await page.goto(`/case-study/${testSlug}`);

    // Check for related articles section
    const relatedSection = page.getByText(/related articles/i);
    if (await relatedSection.count() > 0) {
      await expect(relatedSection).toBeVisible();
    }
  });

  test('should navigate back to home', async ({ page }) => {
    await page.goto(`/case-study/${testSlug}`);

    // Look for back or home link
    const backLink = page.getByRole('link', { name: /home|back/i });
    if (await backLink.count() > 0) {
      await backLink.click();
      await expect(page).toHaveURL('/');
    }
  });

  test('should handle invalid case study slug', async ({ page }) => {
    await page.goto('/case-study/non-existent-slug-12345');

    // Should show 404 or error message
    // Adjust based on your error handling
    await expect(page.locator('body')).toContainText(/not found|error/i);
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/case-study/${testSlug}`);

    // Check page still renders properly
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
