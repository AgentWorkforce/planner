/**
 * Forge UI - Runs List Page Tests
 *
 * Tests the runs list page functionality including:
 * - Page structure (title, subtitle, Import Plan button)
 * - Status filter tabs (All, Running, Completed, Failed, Paused)
 * - Run card display after creation (link elements with "Untitled Run")
 * - Navigation to run dashboard via run card
 * - Empty state when filtering to a status with no runs
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
  const plan = await createPlan(`Runs List ${goalSuffix}`);
  const latest = await waitForStableVersion(plan.plan_id);
  await submitPlan(plan.plan_id, latest.version);
  await approvePlan(plan.plan_id, latest.version);
  await publishPlan(plan.plan_id, latest.version);
  const publishedPlan = await getPlan(plan.plan_id);

  const run = await createForgeRun(publishedPlan);
  return { plan: publishedPlan, run };
}

test.describe('Forge - Runs List Page', () => {
  test('displays page title, subtitle, and Import Plan button', async ({ page }) => {
    await page.goto('/forge');
    await page.waitForLoadState('domcontentloaded');

    // Page heading
    await expect(page.getByRole('heading', { name: 'Runs', level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Subtitle paragraph
    await expect(page.getByText('Monitor and manage orchestration runs')).toBeVisible();

    // Import Plan button
    await expect(page.getByRole('button', { name: /import plan/i })).toBeVisible();
  });

  test('shows status filter tabs', async ({ page }) => {
    await page.goto('/forge');
    await page.waitForLoadState('domcontentloaded');

    // Filter tablist
    await expect(
      page.getByRole('tablist', { name: /filter runs by status/i })
    ).toBeVisible({ timeout: 10_000 });

    // Individual tabs -- "All" tab has a count badge, others may or may not
    await expect(page.getByRole('tab', { name: /all/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /running/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /completed/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /failed/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /paused/i })).toBeVisible();

    // "All" tab should be selected by default
    await expect(page.getByRole('tab', { name: /all/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('displays run card after creation', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Display ${Date.now()}`);

    await page.goto('/forge');
    await page.waitForLoadState('domcontentloaded');

    // Run cards are link elements pointing to /forge/runs/{run_id}
    const runCard = page.locator(`a[href="/forge/runs/${run.run_id}"]`);
    await expect(runCard).toBeVisible({ timeout: 10_000 });

    // Run cards show "Untitled Run" (forge does not store plan goals)
    await expect(runCard.getByRole('heading', { name: 'Untitled Run', level: 2 })).toBeVisible();
  });

  test('navigates to run dashboard when clicking run card', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Navigate ${Date.now()}`);

    await page.goto('/forge');
    await page.waitForLoadState('domcontentloaded');

    // Click the run card link
    const runCard = page.locator(`a[href="/forge/runs/${run.run_id}"]`);
    await expect(runCard).toBeVisible({ timeout: 10_000 });
    await runCard.click();

    await expect(page).toHaveURL(new RegExp(`/forge/runs/${run.run_id}`));
  });

  test('filters runs by Completed status', async ({ page }) => {
    // Create a run (runs complete immediately with 0 tasks)
    await createPublishedPlanAndRun(`Filter ${Date.now()}`);

    await page.goto('/forge');
    await page.waitForLoadState('domcontentloaded');

    // Click Completed tab
    await page.getByRole('tab', { name: /completed/i }).click();

    // Completed tab should now be selected
    await expect(page.getByRole('tab', { name: /completed/i })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 10_000 }
    );

    // Completed runs should be visible (runs complete immediately)
    await expect(
      page.getByRole('heading', { name: 'Untitled Run', level: 2 }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows empty state when filtering to Failed (no failed runs)', async ({ page }) => {
    await page.goto('/forge');
    await page.waitForLoadState('domcontentloaded');

    // Click Failed tab -- there should be no failed runs
    await page.getByRole('tab', { name: /failed/i }).click();

    // Should show some form of empty state (no run cards visible)
    // Wait for tab switch to take effect
    await expect(page.getByRole('tab', { name: /failed/i })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 10_000 }
    );

    // No run card headings should be visible
    await expect(
      page.getByRole('heading', { name: 'Untitled Run', level: 2 })
    ).toHaveCount(0, { timeout: 10_000 });
  });
});
