/**
 * Pipeline visualization tests
 *
 * Tests the /pipeline route functionality:
 * - Plans display in pipeline view
 * - View mode toggle (Sequence/Board) using role="radio"
 * - Initiative filtering
 * - Navigation to plan editor
 * - Board/Sequence column layout
 */

import { test, expect } from '../fixtures/base';
import { createPlan, createInitiative, updatePlan } from '../fixtures/api';

test.describe('Pipeline Page', () => {
  // Pipeline page loads all plans + initiative tabs, which grows with accumulated test data.
  // Give extra time for API responses under parallel load.
  test.setTimeout(45_000);

  test('displays plans in pipeline view', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`Pipeline Plan One ${ts}`, 'First plan');
    await createPlan(`Pipeline Plan Two ${ts}`, 'Second plan');

    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(`Pipeline Plan One ${ts}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Pipeline Plan Two ${ts}`)).toBeVisible({ timeout: 15_000 });
  });

  test('shows view mode toggle buttons', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`View Mode Test ${ts}`, 'Check toggles');

    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    // View toggles use role="radio"
    await expect(page.getByRole('radio', { name: /sequence/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /board/i })).toBeVisible();
  });

  test('switches between Sequence and Board views', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`View Switch ${ts}`, 'Toggle between views');

    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    const boardToggle = page.getByRole('radio', { name: /board/i });
    const sequenceToggle = page.getByRole('radio', { name: /sequence/i });

    await sequenceToggle.click();
    await page.waitForTimeout(300);
    await expect(sequenceToggle).toBeChecked();

    await boardToggle.click();
    await page.waitForTimeout(300);
    await expect(boardToggle).toBeChecked();
  });

  test('persists view mode in localStorage', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`Persistence Test ${ts}`, 'Check persistence');

    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    const sequenceToggle = page.getByRole('radio', { name: /sequence/i });
    await sequenceToggle.click();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(sequenceToggle).toBeChecked();
  });

  test('shows initiative filter tabs', async ({ page }) => {
    const ts = Date.now();
    const initiative = await createInitiative(`Pipeline Init ${ts}`, 'For filtering');
    const plan = await createPlan(`Init Plan ${ts}`, 'Part of initiative');
    await updatePlan(plan.plan_id, { initiative_id: initiative.id });

    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    // All tab (pipeline uses role="tab" for initiative filter)
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible({ timeout: 15_000 });

    // Initiative tab
    await expect(page.getByRole('tab', { name: new RegExp(`Pipeline Init ${ts}`, 'i') })).toBeVisible({ timeout: 15_000 });
  });

  test('navigates to plan editor when clicking plan card', async ({ page }) => {
    const ts = Date.now();
    const plan = await createPlan(`Clickable Plan ${ts}`, 'Click to navigate');

    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    await page.getByText(`Clickable Plan ${ts}`).click();

    await expect(page).toHaveURL(new RegExp(`/plans/${plan.plan_id}`));
  });

  test('shows New Plan button in toolbar', async ({ page }) => {
    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    const newButton = page.getByRole('button', { name: /new plan/i })
      .or(page.getByRole('link', { name: /new plan/i }));
    await expect(newButton.first()).toBeVisible();
  });

  test('Board view shows status columns', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`Board Columns ${ts}`, 'Check board layout');

    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    // Board is the default view. Wait for plan data to fully load (with 500+ plans this is slow).
    const boardToggle = page.getByRole('radio', { name: /board/i });
    await expect(boardToggle).toBeVisible({ timeout: 15_000 });
    await boardToggle.click();
    await expect(boardToggle).toBeChecked({ timeout: 5_000 });

    // Board view columns are h2 headings: Drafting, At Gate, Approved, Running, Complete
    await expect(page.locator('h2').filter({ hasText: 'Drafting' })).toBeVisible({ timeout: 30_000 });
  });

  test('Sequence view shows wave columns', async ({ page }) => {
    const ts = Date.now();
    await createPlan(`Sequence Waves ${ts}`, 'Check sequence layout');

    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    const sequenceToggle = page.getByRole('radio', { name: /sequence/i });
    await expect(sequenceToggle).toBeVisible({ timeout: 15_000 });
    await sequenceToggle.click();
    await expect(sequenceToggle).toBeChecked({ timeout: 5_000 });

    // Sequence view columns are h2 headings: NOW, Wave 2, DONE
    await expect(page.locator('h2').filter({ hasText: 'NOW' })).toBeVisible({ timeout: 30_000 });
  });

  test('page loads without errors', async ({ page }) => {
    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    // Pipeline heading should be visible
    await expect(page.getByRole('heading', { name: 'Pipeline', level: 1 })).toBeVisible();

    // No error messages
    const errorMessage = page.locator('text=/error loading pipeline/i');
    expect(await errorMessage.count()).toBe(0);
  });
});
