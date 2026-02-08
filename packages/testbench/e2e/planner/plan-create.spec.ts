/**
 * Plan creation tests
 *
 * Tests the /plans/new route functionality including:
 * - Creation form display (textarea#goal, textarea#context)
 * - Field validation
 * - Successful plan creation
 * - Tab toggle (Create from goal / Import from document)
 */

import { test, expect } from '../fixtures/base';

test.describe('Plan Creation Page', () => {
  test('displays the creation form', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('domcontentloaded');

    // Page title
    await expect(page.getByRole('heading', { name: 'New Plan', level: 1 })).toBeVisible();

    // Goal textarea (textarea#goal)
    await expect(page.locator('textarea#goal')).toBeVisible();

    // Context textarea (textarea#context)
    await expect(page.locator('textarea#context')).toBeVisible();

    // Create Plan button
    await expect(page.getByRole('button', { name: /create plan/i })).toBeVisible();
  });

  test('submit button is disabled when goal is empty', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('domcontentloaded');

    const submitButton = page.getByRole('button', { name: /create plan/i });
    await expect(submitButton).toBeDisabled();
  });

  test('enables submit button when goal is provided', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('textarea#goal').fill('Test goal for validation');

    const submitButton = page.getByRole('button', { name: /create plan/i });
    await expect(submitButton).toBeEnabled();
  });

  test('creates a plan with goal only', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('textarea#goal').fill('Build user authentication system');

    await page.getByRole('button', { name: /create plan/i }).click();

    // Loading state
    await expect(page.getByText(/AI is analyzing your goal/i)).toBeVisible();

    // Wait for redirect to plan editor
    await expect(page).toHaveURL(/\/plans\/[a-z0-9-]+$/, { timeout: 30_000 });

    await expect(page.getByText('Build user authentication system')).toBeVisible();
  });

  test('creates a plan with goal and context', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('textarea#goal').fill('Improve API performance');
    await page.locator('textarea#context').fill('Current response time is 3s, target is under 1s');

    await page.getByRole('button', { name: /create plan/i }).click();

    // Wait for redirect to plan editor (AI analysis may take time)
    await expect(page).toHaveURL(/\/plans\/[a-z0-9-]+$/, { timeout: 30_000 });
    await expect(page.getByText('Improve API performance')).toBeVisible({ timeout: 10_000 });
  });

  test('can cancel plan creation', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('textarea#goal').fill('This will be cancelled');

    await page.getByRole('button', { name: /cancel/i }).click();

    await expect(page).toHaveURL('/plans');
  });

  test('shows tab toggle for goal vs import', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('domcontentloaded');

    // Tab toggle uses role="radio" with aria-label
    const fromGoalTab = page.getByRole('radio', { name: /create from goal/i });
    const fromDocumentTab = page.getByRole('radio', { name: /import from document/i });

    await expect(fromGoalTab).toBeVisible();
    await expect(fromDocumentTab).toBeVisible();

    // Default should be "Create from goal"
    await expect(fromGoalTab).toBeChecked();
  });

  test('switches between goal and import tabs', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('domcontentloaded');

    const goalTextarea = page.locator('textarea#goal');
    await expect(goalTextarea).toBeVisible();

    // Switch to import tab
    await page.getByRole('radio', { name: /import from document/i }).click();
    await expect(goalTextarea).not.toBeVisible();

    // Switch back to goal tab
    await page.getByRole('radio', { name: /create from goal/i }).click();
    await expect(goalTextarea).toBeVisible();
  });
});
