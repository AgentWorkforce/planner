/**
 * Plan listing and filtering tests
 *
 * Tests the /plans route functionality including:
 * - Plans list rendering
 * - Status filter tabs (role="radio" - "All plans", "Draft plans", etc.)
 * - Search functionality (placeholder: "Search plans...")
 * - View mode toggle (Table/Card)
 * - Navigation to plan editor
 */

import { test, expect } from '../fixtures/base';
import { createPlan } from '../fixtures/api';

test.describe('Plans List Page', () => {
  test('displays plans in the list', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`Auth System ${ts}`, 'Add OAuth2 support');
    await createPlan(`Homepage Perf ${ts}`, 'Target sub-2s load time');

    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(`Auth System ${ts}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`Homepage Perf ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('filters plans by draft status', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`Draft plan ${ts}`, 'This is a draft');

    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    // Filter tabs have accessible names like "Draft plans", "All plans", etc.
    // Playwright substring matches: 'Draft' matches "Draft plans"
    await page.getByRole('radio', { name: 'Draft' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(`Draft plan ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('All filter shows all plans', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`Plan one ${ts}`, 'First plan');
    await createPlan(`Plan two ${ts}`, 'Second plan');

    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('radio', { name: 'All' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(`Plan one ${ts}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`Plan two ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('searches plans by goal text', async ({ page }) => {
    const ts = Date.now();
    const uniqueTerm = `UniqueAPI${ts}`;
    await createPlan(`Build ${uniqueTerm}`, 'For order management');

    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    // Ensure the plan is visible first
    await expect(page.getByText(`Build ${uniqueTerm}`)).toBeVisible({ timeout: 10_000 });

    // Search input: textbox with accessible name "Search plans..."
    const searchInput = page.getByRole('textbox', { name: 'Search plans' });
    await searchInput.fill(uniqueTerm);
    await page.waitForTimeout(1000);

    await expect(page.getByText(`Build ${uniqueTerm}`)).toBeVisible();
  });

  test('shows no matching plans for empty search results', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`Test plan ${ts}`, 'Some context');

    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByRole('textbox', { name: 'Search plans' });
    await searchInput.fill(`nonexistent_query_xyz_${ts}`);
    await page.waitForTimeout(1000);

    await expect(page.getByText('No matching plans')).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to plan editor when clicking a plan', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Navigate test ${ts}`, 'Click me');

    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    await page.locator(`a[href="/plans/${plan.plan_id}"]`).first().click();

    await expect(page).toHaveURL(`/plans/${plan.plan_id}`);
    await expect(page.getByText(`Navigate test ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('toggles between table and card view modes', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`View mode test ${ts}`, 'For toggle testing');

    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    // View mode radios: "Table view", "Card view", "Sectioned table view"
    const cardView = page.getByRole('radio', { name: 'Card view' });
    const tableView = page.getByRole('radio', { name: 'Table view', exact: true });

    await expect(cardView).toBeVisible({ timeout: 10_000 });

    await cardView.click();
    await page.waitForTimeout(300);
    await expect(cardView).toBeChecked();

    await tableView.click();
    await page.waitForTimeout(300);
    await expect(tableView).toBeChecked();
  });

  test('shows New Plan link in toolbar', async ({ page }) => {
    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    // Main content has a link to /plans/new
    await expect(page.locator('main a[href="/plans/new"]')).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to new plan page', async ({ page }) => {
    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('main a[href="/plans/new"]').click();
    await expect(page).toHaveURL('/plans/new');
  });
});
