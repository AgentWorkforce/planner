/**
 * Forge UI - Run Dashboard Page Tests
 *
 * Tests the run dashboard page functionality including:
 * - Breadcrumb navigation (Runs link > short run ID)
 * - "Untitled Run" heading (forge does not store plan goals)
 * - Tasks section with empty state
 * - Active Agents section heading
 * - Details metadata section (Run ID, Plan ID, Version, Created)
 * - Breadcrumb navigation back to runs list
 * - 404 handling for non-existent runs
 */

import { test, expect } from '../fixtures/base';
import {
  createPlan,
  submitPlan,
  approvePlan,
  publishPlan,
  createForgeRun,
  getPlan,
  waitForStableVersion,
} from '../fixtures/api';

async function createPublishedPlanAndRun(goalSuffix: string) {
  const plan = await createPlan(`Run Dashboard ${goalSuffix}`);
  const latest = await waitForStableVersion(plan.plan_id);
  await submitPlan(plan.plan_id, latest.version);
  await approvePlan(plan.plan_id, latest.version);
  await publishPlan(plan.plan_id, latest.version);
  const publishedPlan = await getPlan(plan.plan_id);

  const run = await createForgeRun(publishedPlan);
  return { plan: publishedPlan, run };
}

test.describe('Forge - Run Dashboard Page', () => {
  test('shows breadcrumb with Runs link and short run ID', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Breadcrumb ${Date.now()}`);
    const shortId = run.run_id.slice(0, 8);

    await page.goto(`/forge/runs/${run.run_id}`);
    await page.waitForLoadState('domcontentloaded');

    // Breadcrumb: "Runs" link navigating to /forge/runs (scoped to nav to avoid sidebar match)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Runs' })).toBeVisible({ timeout: 10_000 });

    // Short run ID shown in breadcrumb (scoped to nav to avoid matching details/status bar)
    await expect(page.getByRole('navigation').getByText(shortId)).toBeVisible();
  });

  test('displays "Untitled Run" as heading', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Title ${Date.now()}`);

    await page.goto(`/forge/runs/${run.run_id}`);
    await page.waitForLoadState('domcontentloaded');

    // Forge does not store plan goals -- runs always show "Untitled Run"
    await expect(
      page.getByRole('heading', { name: 'Untitled Run', level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows Tasks section with empty state', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Tasks ${Date.now()}`);

    await page.goto(`/forge/runs/${run.run_id}`);
    await page.waitForLoadState('domcontentloaded');

    // Tasks section heading
    await expect(page.getByRole('heading', { name: 'Tasks', level: 2 })).toBeVisible({
      timeout: 10_000,
    });

    // Empty state within tasks section
    await expect(page.getByRole('heading', { name: 'No tasks', level: 3 })).toBeVisible();
    await expect(
      page.getByText('Tasks will appear here once the run starts.')
    ).toBeVisible();
  });

  test('shows Active Agents section heading', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Agents ${Date.now()}`);

    await page.goto(`/forge/runs/${run.run_id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: 'Active Agents', level: 2 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows Details section with metadata fields', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Details ${Date.now()}`);

    await page.goto(`/forge/runs/${run.run_id}`);
    await page.waitForLoadState('domcontentloaded');

    // Details heading
    await expect(page.getByRole('heading', { name: 'Details', level: 2 })).toBeVisible({
      timeout: 10_000,
    });

    // Description list terms
    await expect(page.getByRole('term').filter({ hasText: 'Run ID' })).toBeVisible();
    await expect(page.getByRole('term').filter({ hasText: 'Plan ID' })).toBeVisible();
    await expect(page.getByRole('term').filter({ hasText: 'Version' })).toBeVisible();
    await expect(page.getByRole('term').filter({ hasText: 'Created' })).toBeVisible();

    // Version definition should show "v1"
    await expect(page.getByRole('definition').filter({ hasText: 'v1' })).toBeVisible();
  });

  test('breadcrumb Runs link navigates back to runs list', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Nav ${Date.now()}`);

    await page.goto(`/forge/runs/${run.run_id}`);
    await page.waitForLoadState('domcontentloaded');

    // Click "Runs" breadcrumb link (scoped to nav to avoid sidebar match)
    await page.getByRole('navigation').getByRole('link', { name: 'Runs' }).click();

    await expect(page).toHaveURL('/forge');
  });

  test('handles 404 for non-existent run', async ({ page }) => {
    await page.goto('/forge/runs/nonexistent-run-id-12345');
    await page.waitForLoadState('domcontentloaded');

    // Should show some error/not-found state
    const errorIndicator = page
      .getByText(/not found/i)
      .or(page.getByText(/error/i))
      .or(page.getByText(/does not exist/i));
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10_000 });
  });
});
