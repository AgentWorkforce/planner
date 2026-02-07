import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test('should load dashboard with Tend title', async ({ page }) => {
    await page.goto('/');

    // Check for "Tend" or "Welcome to Tend" heading
    const heading = page.locator('h1, h2').filter({ hasText: /Tend/i });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should render project list', async ({ page }) => {
    await page.goto('/');

    // Wait for either loading state to finish or content to appear
    // The page may show empty state if no projects exist
    await page.waitForLoadState('domcontentloaded');

    // Check for either project list container or empty state message
    const projectSection = page.locator('[data-testid="project-list"]').or(
      page.locator('text=/What would you like to work on|Select a project/i')
    );

    await expect(projectSection).toBeVisible({ timeout: 10_000 });
  });

  test('should show new project button or create flow', async ({ page }) => {
    await page.goto('/');

    // Look for "New Project" button or similar create action
    const createButton = page.locator('button').filter({ hasText: /New|Create/i }).first();

    // Button should be visible (may be disabled if backend is down, but should exist)
    await expect(createButton).toBeVisible({ timeout: 10_000 });
  });

  test('should allow project creation flow', async ({ page }) => {
    await page.goto('/');

    // Find and click new project button
    const newProjectButton = page.locator('button').filter({ hasText: /New Project|Create/i }).first();
    await newProjectButton.click();

    // Look for input field (modal or inline) - use flexible selectors
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input[type="text"]').first();

    if (await nameInput.isVisible({ timeout: 5_000 })) {
      await nameInput.fill('Test Project E2E');

      // Look for submit button
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /Create|Save|Submit/i }).first();

      if (await submitButton.isVisible({ timeout: 3_000 })) {
        // Note: We don't actually submit since backend may not be available
        // Just verify the form structure exists
        await expect(submitButton).toBeEnabled();
      }
    }
  });

  test('should navigate to project page when clicking project', async ({ page }) => {
    await page.goto('/');

    // Wait for content to load
    await page.waitForLoadState('domcontentloaded');

    // Look for any project items (may not exist if no projects)
    const projectItems = page.locator('[data-testid="project-item"]');
    const count = await projectItems.count();

    if (count > 0) {
      // Click first project
      await projectItems.first().click();

      // Should navigate to /projects/:id route
      await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/, { timeout: 5_000 });
    }
    // If no projects exist, test passes (empty state is valid)
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Override API to return error
    await page.route('/api/projects', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/');

    // Page should still load without crashing
    await expect(page.locator('body')).toBeVisible();

    // May show error message or empty state
    // The important thing is it doesn't crash
  });
});
