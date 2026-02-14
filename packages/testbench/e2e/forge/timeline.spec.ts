/**
 * Forge UI - Timeline Page Tests
 *
 * Tests the timeline view functionality including:
 * - Breadcrumb navigation (Runs > run ID link > "Timeline" text)
 * - "Timeline" heading
 * - Error state (timeline API endpoint returns 404 - not implemented)
 * - Breadcrumb run ID link navigates to run dashboard
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
  const plan = await createPlan(`Timeline ${goalSuffix}`);
  const latest = await waitForStableVersion(plan.plan_id);
  await submitPlan(plan.plan_id, latest.version);
  await approvePlan(plan.plan_id, latest.version);
  await publishPlan(plan.plan_id, latest.version);
  const publishedPlan = await getPlan(plan.plan_id);

  const run = await createForgeRun(publishedPlan);
  return { plan: publishedPlan, run };
}

test.describe('Forge - Timeline Page', () => {
  test('displays Timeline heading', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Heading ${Date.now()}`);

    await page.goto(`/forge/runs/${run.run_id}/timeline`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: 'Timeline', level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows breadcrumb with Runs link, run ID link, and Timeline text', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Breadcrumb ${Date.now()}`);
    const shortId = run.run_id.slice(0, 8);

    await page.goto(`/forge/runs/${run.run_id}/timeline`);
    await page.waitForLoadState('domcontentloaded');

    // Breadcrumb: "Runs" link (scoped to nav to avoid sidebar match)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Runs' })).toBeVisible({ timeout: 10_000 });

    // Breadcrumb: short run ID as a link (navigates to run dashboard)
    await expect(page.getByRole('link', { name: shortId })).toBeVisible();

    // Breadcrumb: "Timeline" text (not a link, current page)
    await expect(page.getByText('Timeline').last()).toBeVisible();
  });

  test('shows error state for unimplemented timeline API', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Error ${Date.now()}`);

    await page.goto(`/forge/runs/${run.run_id}/timeline`);
    await page.waitForLoadState('domcontentloaded');

    // Timeline API returns 404, so the page shows an error state
    await expect(
      page.getByRole('heading', { name: /failed to load timeline/i, level: 3 })
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Not Found')).toBeVisible();

    // Retry button should be available
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  });

  test('breadcrumb run ID link navigates to run dashboard', async ({ page }) => {
    const { run } = await createPublishedPlanAndRun(`Nav ${Date.now()}`);
    const shortId = run.run_id.slice(0, 8);

    await page.goto(`/forge/runs/${run.run_id}/timeline`);
    await page.waitForLoadState('domcontentloaded');

    // Click the run ID link in breadcrumb
    await page.getByRole('link', { name: shortId }).click();

    await expect(page).toHaveURL(`/forge/runs/${run.run_id}`);
  });
});
