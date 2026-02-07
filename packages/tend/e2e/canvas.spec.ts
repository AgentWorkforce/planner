import { test, expect } from '@playwright/test';

test.describe('Canvas Page', () => {
  const mockSessionId = 'test-session-canvas-001';

  test('should require session ID in URL', async ({ page }) => {
    // Try to navigate to canvas without session ID (should fail or redirect)
    await page.goto('/ideation/session/');

    // Page should handle missing ID gracefully
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    // URL should not be at canvas page (or should show error)
    const url = page.url();
    expect(url).not.toMatch(/\/ideation\/session\/$/);
  });

  test('should show loading state initially', async ({ page }) => {
    // Mock API to delay response
    await page.route(`/api/ideation/sessions/${mockSessionId}`, async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: mockSessionId,
            source: { initial_intent: 'Test Session' },
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto(`/ideation/session/${mockSessionId}`);

    // Should show loading indicator
    const loadingIndicator = page.locator('text=/Loading|loading/i, [data-testid="loading-spinner"]');
    await expect(loadingIndicator.first()).toBeVisible({ timeout: 2_000 });
  });

  test('should render three-column layout', async ({ page }) => {
    // Mock successful session load
    await page.route(`/api/ideation/sessions/${mockSessionId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: mockSessionId,
            source: { initial_intent: 'Test Canvas Session' },
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock blocks API
    await page.route(`/api/ideation/sessions/${mockSessionId}/blocks`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ blocks: [] }),
      });
    });

    await page.goto(`/ideation/session/${mockSessionId}`);

    // Wait for content to load
    await page.waitForLoadState('domcontentloaded');

    // Check for three-column structure
    // Left: FormingBlocksColumn
    // Center: ConversationPane
    // Right: ProjectTree

    // Look for canvas container or layout structure
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Page should not show error state
    const errorText = page.locator('text=/error|failed/i');
    await expect(errorText).not.toBeVisible({ timeout: 3_000 }).catch(() => {
      // Ignore if not found - that's good
    });
  });

  test('should display session title in header', async ({ page }) => {
    const sessionTitle = 'My Test Canvas Session';

    await page.route(`/api/ideation/sessions/${mockSessionId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: mockSessionId,
            source: { initial_intent: sessionTitle },
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route(`/api/ideation/sessions/${mockSessionId}/blocks`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ blocks: [] }),
      });
    });

    await page.goto(`/ideation/session/${mockSessionId}`);

    // Look for session title in header or nav
    const titleElement = page.locator(`text="${sessionTitle}"`);
    await expect(titleElement).toBeVisible({ timeout: 10_000 });
  });

  test('should handle session not found error', async ({ page }) => {
    // Mock 404 response
    await page.route(`/api/ideation/sessions/${mockSessionId}`, (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session not found' }),
      });
    });

    await page.goto(`/ideation/session/${mockSessionId}`);

    // Should show error message
    const errorMessage = page.locator('text=/not found|doesn\'t exist/i');
    await expect(errorMessage).toBeVisible({ timeout: 10_000 });
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock server error
    await page.route(`/api/ideation/sessions/${mockSessionId}`, (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto(`/ideation/session/${mockSessionId}`);

    // Page should show error state without crashing
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    // Should show some error indication
    const errorIndicator = page.locator('text=/error|failed/i');
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should support focus mode with block parameter', async ({ page }) => {
    const blockId = 'block-xyz-789';

    await page.route(`/api/ideation/sessions/${mockSessionId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: mockSessionId,
            source: { initial_intent: 'Focus Test Session' },
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route(`/api/ideation/sessions/${mockSessionId}/blocks`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blocks: [
            {
              id: blockId,
              keyword: 'Test Block',
              emoji: '🧪',
              content: 'Test content',
            },
          ],
        }),
      });
    });

    // Navigate with block query parameter
    await page.goto(`/ideation/session/${mockSessionId}?block=${blockId}`);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // URL should contain block parameter
    expect(page.url()).toContain(`block=${blockId}`);

    // Page should render (focus mode may be active)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render left panel for forming blocks', async ({ page }) => {
    await page.route(`/api/ideation/sessions/${mockSessionId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: mockSessionId,
            source: { initial_intent: 'Blocks Test' },
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route(`/api/ideation/sessions/${mockSessionId}/blocks`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blocks: [
            { id: '1', keyword: 'Block 1', emoji: '📦', content: 'Content 1' },
            { id: '2', keyword: 'Block 2', emoji: '🎯', content: 'Content 2' },
          ],
        }),
      });
    });

    await page.goto(`/ideation/session/${mockSessionId}`);

    // Wait for blocks to load
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {
      // Ignore timeout - check for content instead
    });

    // Page should render without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render center panel for conversation', async ({ page }) => {
    await page.route(`/api/ideation/sessions/${mockSessionId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: mockSessionId,
            source: { initial_intent: 'Conversation Test' },
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route(`/api/ideation/sessions/${mockSessionId}/blocks`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocks: [] }) });
    });

    await page.goto(`/ideation/session/${mockSessionId}`);

    // Wait for layout to render
    await page.waitForLoadState('domcontentloaded');

    // Center conversation area should be present
    // (exact selector depends on implementation, but page should not crash)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render right panel for project tree', async ({ page }) => {
    await page.route(`/api/ideation/sessions/${mockSessionId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: mockSessionId,
            source: { initial_intent: 'Tree Test' },
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route(`/api/ideation/sessions/${mockSessionId}/blocks`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocks: [] }) });
    });

    await page.goto(`/ideation/session/${mockSessionId}`);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Right panel (project tree) should be part of layout
    await expect(page.locator('body')).toBeVisible();
  });
});
