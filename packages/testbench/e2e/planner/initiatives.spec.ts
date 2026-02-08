/**
 * Initiative management tests
 *
 * Tests the initiatives functionality:
 * - Listing initiatives in grid layout
 * - Status filter tabs (role="radio": All, Active, Completed, Archived)
 * - Initiative detail page
 * - Plan association
 * - Navigation and 404 handling
 */

import { test, expect } from '../fixtures/base';
import { createInitiative, createPlan, updatePlan } from '../fixtures/api';

test.describe('Initiatives List Page', () => {
  test('displays page title and subtitle', async ({ page }) => {
    await page.goto('/initiatives');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Initiatives', level: 1 })).toBeVisible();
    await expect(page.getByText('Organize and track strategic goals')).toBeVisible();
  });

  test('displays initiatives in grid', async ({ page }) => {
    const ts = Date.now();
    await createInitiative(`Q1 Goals ${ts}`, 'Strategic objectives');
    await createInitiative(`Platform ${ts}`, 'Infrastructure improvements');

    await page.goto('/initiatives');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: `Q1 Goals ${ts}` })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: `Platform ${ts}` })).toBeVisible({ timeout: 10_000 });
  });

  test('shows status filter tabs', async ({ page }) => {
    const ts = Date.now();
    await createInitiative(`Filter Test ${ts}`, 'For testing filters');

    await page.goto('/initiatives');
    await page.waitForLoadState('domcontentloaded');

    // Filter tabs use role="radio" with full accessible names
    await expect(page.getByRole('radio', { name: 'All initiatives' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('radio', { name: 'Active initiatives' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Completed initiatives' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Archived initiatives' })).toBeVisible();
  });

  test('filters initiatives by active status', async ({ page }) => {
    const ts = Date.now();
    await createInitiative(`Active Init ${ts}`, 'This is active');

    await page.goto('/initiatives');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('radio', { name: 'Active initiatives' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: `Active Init ${ts}` })).toBeVisible({ timeout: 10_000 });
  });

  test('shows empty state for filtered view with no results', async ({ page }) => {
    const ts = Date.now();
    await createInitiative(`Only Active ${ts}`, 'No completed ones');

    await page.goto('/initiatives');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('radio', { name: 'Completed initiatives' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/no.*completed.*initiatives/i).or(page.getByText(/no initiatives/i))).toBeVisible();
  });

  test('navigates to initiative detail', async ({ page }) => {
    const ts = Date.now();
    const initiative = await createInitiative(`Detail Test ${ts}`, 'Click to view');

    await page.goto('/initiatives');
    await page.waitForLoadState('domcontentloaded');

    // Initiative cards are links: a[href="/initiatives/{id}"]
    await page.locator(`a[href="/initiatives/${initiative.id}"]`).first().click();

    await expect(page).toHaveURL(`/initiatives/${initiative.id}`);
    await expect(page.getByText(`Detail Test ${ts}`)).toBeVisible();
  });

  test('shows New Initiative button', async ({ page }) => {
    await page.goto('/initiatives');
    await page.waitForLoadState('domcontentloaded');

    const newButton = page.getByRole('button', { name: /new initiative/i })
      .or(page.getByRole('button', { name: /create your first initiative/i }));
    await expect(newButton.first()).toBeVisible();
  });
});

test.describe('Initiative Detail Page', () => {
  test('displays initiative name and status', async ({ page }) => {
    const ts = Date.now();
    const initiative = await createInitiative(`Detail Init ${ts}`, 'Check display');

    await page.goto(`/initiatives/${initiative.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Name in h1 (scope to main to avoid sidebar matches)
    await expect(page.locator('main').getByRole('heading', { level: 1 }).filter({ hasText: `Detail Init ${ts}` })).toBeVisible({ timeout: 10_000 });

    // Active status badge (scope to main to avoid "ACTIVE CHANNELS" and sidebar links)
    await expect(page.locator('main').getByText('active', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('shows back to initiatives link', async ({ page }) => {
    const initiative = await createInitiative('Back Link Test', 'Nav back');

    await page.goto(`/initiatives/${initiative.id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('link', { name: /back to initiatives/i })).toBeVisible({ timeout: 10_000 });
  });

  test('shows associated plans', async ({ page }) => {
    const ts = Date.now();
    const initiative = await createInitiative(`Plans Init ${ts}`, 'Has plans');

    const plan = await createPlan(`Initiative Plan ${ts}`, 'Linked');
    await updatePlan(plan.plan_id, { initiative_id: initiative.id });

    await page.goto(`/initiatives/${initiative.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Plans section heading includes count
    await expect(page.getByText(/plans \(\d+\)/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`Initiative Plan ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('shows empty plans state', async ({ page }) => {
    const ts = Date.now();
    const initiative = await createInitiative(`Empty Plans ${ts}`, 'No plans yet');

    await page.goto(`/initiatives/${initiative.id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/no plans in this initiative/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows Create Plan button', async ({ page }) => {
    const initiative = await createInitiative('Create Plan Button Test', 'Check button');

    await page.goto(`/initiatives/${initiative.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Scope to main to avoid sidebar "Create Plan Button Test" links
    await expect(page.locator('main').getByRole('link', { name: 'Create Plan', exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('handles 404 for non-existent initiative', async ({ page }) => {
    await page.goto('/initiatives/nonexistent-initiative-12345');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/initiative not found/i)).toBeVisible({ timeout: 10_000 });
  });
});
