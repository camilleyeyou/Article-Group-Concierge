# E2E Testing with Playwright

End-to-end testing for critical user flows and API endpoints.

## Installation

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install
```

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run tests in headed mode (see browser)
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e tests/e2e/homepage.spec.ts

# Run tests in specific browser
npm run test:e2e -- --project=chromium

# Run tests in UI mode (interactive)
npm run test:e2e -- --ui

# Debug tests
npm run test:e2e -- --debug
```

## Test Structure

```
tests/e2e/
├── homepage.spec.ts     # Homepage functionality tests
├── case-study.spec.ts   # Case study page tests
└── api.spec.ts          # API endpoint tests
```

## Test Coverage

### Homepage Tests (`homepage.spec.ts`)
- ✅ Page loads successfully
- ✅ Query submission works
- ✅ Results are displayed
- ✅ Empty query validation
- ✅ Mobile responsiveness
- ✅ Rate limiting handling

### Case Study Tests (`case-study.spec.ts`)
- ✅ Page loads with content
- ✅ PDF viewer displays
- ✅ Related articles shown
- ✅ Navigation works
- ✅ 404 handling
- ✅ Tablet responsiveness

### API Tests (`api.spec.ts`)
- ✅ Health check endpoint
- ✅ Analytics endpoint
- ✅ Chat API (valid queries)
- ✅ Chat API (validation)
- ✅ Rate limiting
- ✅ Performance benchmarks

## Configuration

See `playwright.config.ts` for:
- Browser configurations (Chrome, Firefox, Safari)
- Mobile device testing
- Test timeouts
- Retry settings
- Screenshot/video capture

## CI/CD Integration

Playwright tests can run in GitHub Actions:

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run tests
  run: npm run test:e2e
  env:
    CI: true
```

## Best Practices

1. **Keep tests independent** - Each test should work in isolation
2. **Use meaningful selectors** - Prefer role/label selectors over CSS
3. **Add timeouts for async operations** - APIs, loading states
4. **Test critical paths first** - Focus on user-facing features
5. **Run tests locally before committing** - Catch issues early
6. **Update tests when UI changes** - Keep tests in sync with code

## Debugging

```bash
# Generate trace files
npm run test:e2e -- --trace on

# View trace (after test completes)
npx playwright show-trace trace.zip

# Open Playwright Inspector
npm run test:e2e -- --debug
```

## Viewing Reports

After tests complete:

```bash
# Open HTML report
npx playwright show-report
```

## Adding New Tests

1. Create a new `.spec.ts` file in `tests/e2e/`
2. Import test utilities: `import { test, expect } from '@playwright/test';`
3. Write test cases with descriptive names
4. Use page objects for complex interactions
5. Add assertions to verify expected behavior

Example:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/your-page');
    await expect(page.getByRole('button')).toBeVisible();
  });
});
```
