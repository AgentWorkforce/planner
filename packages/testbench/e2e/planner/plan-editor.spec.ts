/**
 * Plan editor interaction tests
 *
 * Tests the plan editor page functionality:
 * - Goal display
 * - Tab navigation (Plan/Understanding/Context/Decisions) using role="radio"
 * - Steps section
 * - Version and status display
 * - 404 handling
 */

import { test, expect } from '../fixtures/base';
import { createPlan } from '../fixtures/api';

test.describe('Plan Editor Page', () => {
  test('displays plan goal', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Editor test ${ts}`, 'Testing the editor view');

    await page.goto(`/plans/${plan.plan_id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(`Editor test ${ts}`)).toBeVisible({ timeout: 15_000 });
  });

  test('shows steps section header', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Steps header ${ts}`, 'Check steps section');

    await page.goto(`/plans/${plan.plan_id}`);

    // Server auto-generates AI steps, so "Steps (N)" heading should appear
    await expect(page.getByRole('heading', { name: /steps/i })).toBeVisible({ timeout: 15_000 });
  });

  test('displays steps from AI-generated version', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Steps display ${ts}`, 'Plan with auto-generated steps');

    await page.goto(`/plans/${plan.plan_id}`);

    // Server auto-generates steps from the goal - wait for them to appear
    await expect(page.getByRole('heading', { name: /steps \(\d+\)/i })).toBeVisible({ timeout: 20_000 });
  });

  test('navigates between editor tabs', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Tab nav ${ts}`, 'Test all tabs');

    await page.goto(`/plans/${plan.plan_id}`);

    // Wait for the plan to load
    await expect(page.getByText(`Tab nav ${ts}`)).toBeVisible({ timeout: 15_000 });

    // Tabs use role="radio" with aria-label
    const planTab = page.getByRole('radio', { name: /plan view/i });
    const understandingTab = page.getByRole('radio', { name: /understanding view/i });

    // Plan tab should be active by default
    await expect(planTab).toBeChecked();

    // Navigate to Understanding tab
    await understandingTab.click();
    await page.waitForTimeout(300);
    await expect(understandingTab).toBeChecked();

    // Back to Plan tab
    await planTab.click();
    await page.waitForTimeout(300);
    await expect(planTab).toBeChecked();
  });

  test('shows back to plans link', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Back link ${ts}`, 'Check navigation');

    await page.goto(`/plans/${plan.plan_id}`);

    const backLink = page.getByRole('link', { name: /back to plans/i });
    await expect(backLink).toBeVisible({ timeout: 15_000 });
  });

  test('back link navigates to plans list', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Back nav ${ts}`, 'Navigate back');

    await page.goto(`/plans/${plan.plan_id}`);
    await expect(page.getByRole('link', { name: /back to plans/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: /back to plans/i }).click();
    await expect(page).toHaveURL('/plans');
  });

  test('handles 404 for non-existent plan', async ({ page }) => {
    await page.goto('/plans/nonexistent-plan-id-12345');

    const errorMessage = page.getByText(/not found/i).or(page.getByText(/error/i));
    await expect(errorMessage.first()).toBeVisible({ timeout: 10_000 });
  });

  test('displays plan version number', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Version display ${ts}`, 'Check version in UI');

    await page.goto(`/plans/${plan.plan_id}`);

    await expect(page.getByText(/version \d+/i)).toBeVisible({ timeout: 15_000 });
  });

  test('shows plan status badge', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Status badge ${ts}`, 'Check status display');

    await page.goto(`/plans/${plan.plan_id}`);

    await expect(page.getByText(/draft/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
