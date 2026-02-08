/**
 * Forge UI - Preflight Page Tests
 *
 * Tests the preflight page functionality including:
 * - "Pre-Flight Check" heading
 * - Error state (Planner API unavailable in test environment)
 * - "Go Back" and "Retry" buttons
 * - "Go Back" navigation
 */

import { test, expect } from '../fixtures/base';
import {
  createPlan,
  submitPlan,
  approvePlan,
  publishPlan,
  getPlan,
  waitForStableVersion,
} from '../fixtures/api';

async function createPublishedPlan(goalSuffix: string) {
  const plan = await createPlan(`Preflight ${goalSuffix}`);
  const latest = await waitForStableVersion(plan.plan_id);
  await submitPlan(plan.plan_id, latest.version);
  await approvePlan(plan.plan_id, latest.version);
  await publishPlan(plan.plan_id, latest.version);
  return getPlan(plan.plan_id);
}

test.describe('Forge - Preflight Page', () => {
  test('displays Pre-Flight Check heading', async ({ page }) => {
    const plan = await createPublishedPlan(`Heading ${Date.now()}`);

    await page.goto(`/forge/preflight/${plan.plan_id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: /pre-flight check/i, level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows Planner API unavailable error', async ({ page }) => {
    const plan = await createPublishedPlan(`Error ${Date.now()}`);

    await page.goto(`/forge/preflight/${plan.plan_id}`);
    await page.waitForLoadState('domcontentloaded');

    // Preflight tries to connect to Planner API at wrong port in test env
    await expect(
      page.getByRole('heading', { name: /planner api unavailable/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Could not connect to the Planner API')
    ).toBeVisible();
  });

  test('shows Go Back and Retry buttons', async ({ page }) => {
    const plan = await createPublishedPlan(`Buttons ${Date.now()}`);

    await page.goto(`/forge/preflight/${plan.plan_id}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the error state to render (buttons appear in error state)
    await expect(
      page.getByRole('heading', { name: /planner api unavailable/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: /go back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });

  test('Go Back button navigates away from preflight', async ({ page }) => {
    const plan = await createPublishedPlan(`GoBack ${Date.now()}`);

    await page.goto(`/forge/preflight/${plan.plan_id}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the error state with buttons
    await expect(page.getByRole('button', { name: /go back/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: /go back/i }).click();

    // Should navigate away from the preflight page
    await expect(page).not.toHaveURL(/preflight/);
  });

  test('shows error state for non-existent plan', async ({ page }) => {
    await page.goto('/forge/preflight/nonexistent-plan-id-12345');
    await page.waitForLoadState('domcontentloaded');

    // Should show error state (Planner API unavailable or similar)
    const errorIndicator = page
      .getByText(/unavailable/i)
      .or(page.getByText(/not found/i))
      .or(page.getByText(/error/i));
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10_000 });
  });
});
