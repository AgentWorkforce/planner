import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should show dashboard at root path', async ({ page }) => {
    await page.goto('/');

    // Should be on dashboard (check for dashboard-specific content)
    const dashboardContent = page.locator('text=/Welcome to Tend|Dashboard|What would you like to work on/i');
    await expect(dashboardContent).toBeVisible({ timeout: 10_000 });

    // URL should be /
    expect(page.url()).toBe('http://localhost:3004/');
  });

  test('should navigate to settings and back', async ({ page }) => {
    await page.goto('/');

    // Navigate to settings (via URL or nav if available)
    await page.goto('/settings');

    // Should be on settings page
    const settingsHeading = page.locator('h1').filter({ hasText: 'Settings' });
    await expect(settingsHeading).toBeVisible();

    // Navigate back using browser back button
    await page.goBack();

    // Should be back on dashboard
    await expect(page).toHaveURL('http://localhost:3004/');
  });

  test('should handle direct navigation to settings', async ({ page }) => {
    await page.goto('/settings');

    // Settings page should load directly
    const settingsHeading = page.locator('h1').filter({ hasText: 'Settings' });
    await expect(settingsHeading).toBeVisible({ timeout: 10_000 });

    // URL should be /settings
    expect(page.url()).toBe('http://localhost:3004/settings');
  });

  test('should handle navigation to project detail page', async ({ page }) => {
    // Create a mock project ID
    const mockProjectId = 'test-project-123';
    await page.goto(`/projects/${mockProjectId}`);

    // Page should attempt to load (may show error if project doesn't exist)
    await page.waitForLoadState('domcontentloaded');

    // Should be at the correct URL
    expect(page.url()).toContain(`/projects/${mockProjectId}`);

    // Page should not crash (body should be visible)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle navigation to canvas/session page', async ({ page }) => {
    const mockSessionId = 'test-session-456';
    await page.goto(`/ideation/session/${mockSessionId}`);

    // Page should attempt to load
    await page.waitForLoadState('domcontentloaded');

    // Should be at the correct URL
    expect(page.url()).toContain(`/session/${mockSessionId}`);

    // Page should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('should preserve URL parameters during navigation', async ({ page }) => {
    const sessionId = 'test-session-789';
    const blockId = 'block-123';

    await page.goto(`/session/${sessionId}/canvas?block=${blockId}`);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // URL should include query parameter
    expect(page.url()).toContain(`block=${blockId}`);
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate through multiple pages
    await page.goto('/');
    await page.goto('/settings');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL('http://localhost:3004/');

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('http://localhost:3004/settings');
  });

  test('should handle keyboard navigation shortcuts if available', async ({ page }) => {
    await page.goto('/');

    // Try to open command palette with Cmd+K (Mac) or Ctrl+K (Windows/Linux)
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }

    // Command palette might open (if implemented)
    // We just check the page doesn't crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('should maintain app state during navigation', async ({ page }) => {
    await page.goto('/settings');

    // Change a setting
    const darkButton = page.locator('button').filter({ hasText: 'Dark' });
    await darkButton.click();

    // Navigate to dashboard
    await page.goto('/');

    // Navigate back to settings
    await page.goto('/settings');

    // Setting should be preserved (dark theme should still be selected)
    await expect(darkButton).toHaveClass(/accent-green|bg-accent/);
  });

  test('should handle rapid navigation without crashes', async ({ page }) => {
    // Rapidly navigate between pages
    await page.goto('/');
    await page.goto('/settings');
    await page.goto('/');
    await page.goto('/settings');
    await page.goto('/');

    // Page should still be responsive
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Should be on dashboard
    await expect(page).toHaveURL('http://localhost:3004/');
  });
});
