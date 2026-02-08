/**
 * Plan workflow lifecycle tests
 *
 * Tests the plan status workflow:
 * - draft → submitted → approved → published
 * - Workflow action buttons (Submit for Review, Approve, Publish)
 * - Read-only indicators for approved/published plans
 */

import { test, expect } from '../fixtures/base';
import { createPlan, submitPlan, approvePlan, publishPlan, waitForStableVersion } from '../fixtures/api';

test.describe('Plan Workflow', () => {
  test('draft plan shows Submit for Review button', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Workflow test ${ts}`, 'Start as draft');

    await page.goto(`/plans/${plan.plan_id}`);

    await expect(page.getByText(`Workflow test ${ts}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/draft/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /submit for review/i })).toBeVisible();
  });

  test('approved plan shows approved status', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Approve test ${ts}`, 'Test approval');

    // Wait for AI version generation to complete, then transition
    const latest = await waitForStableVersion(plan.plan_id);
    await submitPlan(plan.plan_id, latest.version);
    await approvePlan(plan.plan_id, latest.version);

    await page.goto(`/plans/${plan.plan_id}`);

    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('approved plan shows Publish button', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Publish btn ${ts}`, 'Approved state');

    const latest = await waitForStableVersion(plan.plan_id);
    await submitPlan(plan.plan_id, latest.version);
    await approvePlan(plan.plan_id, latest.version);

    await page.goto(`/plans/${plan.plan_id}`);

    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('published plan shows published status', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Publish test ${ts}`, 'Test publishing');

    const latest = await waitForStableVersion(plan.plan_id);
    await submitPlan(plan.plan_id, latest.version);
    await approvePlan(plan.plan_id, latest.version);
    await publishPlan(plan.plan_id, latest.version);

    await page.goto(`/plans/${plan.plan_id}`);

    await expect(page.getByText(/published/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('full workflow: draft to published', async ({ page }) => {
    test.setTimeout(45_000);
    const ts = Date.now();
    const plan = await createPlan(`Full lifecycle ${ts}`, 'Testing complete workflow');

    // Step 1: Draft state
    await page.goto(`/plans/${plan.plan_id}`);
    await expect(page.getByText(/draft/i).first()).toBeVisible({ timeout: 15_000 });

    // Step 2: Wait for stable version, then submit + approve via API
    const latest = await waitForStableVersion(plan.plan_id);
    await submitPlan(plan.plan_id, latest.version);
    await approvePlan(plan.plan_id, latest.version);
    await page.reload();
    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });

    // Step 3: Publish via API
    await publishPlan(plan.plan_id, latest.version);
    await page.reload();
    await expect(page.getByText(/published/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('plan displays version number', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Version test ${ts}`, 'Check version number');

    await page.goto(`/plans/${plan.plan_id}`);

    await expect(page.getByText(/version \d+/i)).toBeVisible({ timeout: 15_000 });
  });
});
