/**
 * Ideation Sessions E2E Tests
 *
 * Tests session management on the ideation dashboard:
 * - Dashboard layout (heading, In-Progress section, Sent to Planner section)
 * - Session creation via API and display in dashboard
 * - Session navigation (click session card -> canvas, back button -> dashboard)
 * - Multiple session display
 * - Continue section with session buttons
 *
 * DOM structure (from browser snapshots):
 * - heading "Ideation Dashboard" [level=1]
 * - heading "In-Progress (N)" [level=2]
 * - Session cards are generic elements (clickable divs, NOT links)
 *   with intent text, optional block count ("2 blocks"), and time ago
 * - "Continue" section with buttons named after sessions
 * - heading "Sent to Planner (N)" [level=2]
 */
import { test, expect } from '../fixtures/base';
import { createIdeationSession, createBlock } from '../fixtures/api';

test.describe('Ideation Sessions', () => {
  test('displays dashboard with main heading', async ({ page }) => {
    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: 'Ideation Dashboard', level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('displays In-Progress section heading', async ({ page }) => {
    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    // Heading shows "In-Progress (N)" where N is the active session count
    await expect(
      page.getByRole('heading', { name: /In-Progress/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('displays Sent to Planner section heading', async ({ page }) => {
    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: /Sent to Planner/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('creates session via API and displays in dashboard', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`API handoff ${ts}`);
    // Add 2 blocks so session ranks in the 2-block tier of the dashboard list
    await createBlock(session.id, { type: 'feature', title: 'X', keyword: 'x', emoji: '📌', content: 'block' });
    await createBlock(session.id, { type: 'feature', title: 'Y', keyword: 'y', emoji: '📍', content: 'block' });

    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    // Session intent text appears inside a clickable div (generic element)
    await expect(page.getByText(`API handoff ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('displays multiple sessions in dashboard', async ({ page }) => {
    const ts = Date.now();
    // Create 2 blocks each so sessions rank in the 2-block tier of the dashboard list
    const alpha = await createIdeationSession(`Session Alpha ${ts}`);
    await createBlock(alpha.id, { type: 'feature', title: 'A1', keyword: 'a1', emoji: '🅰️', content: 'block' });
    await createBlock(alpha.id, { type: 'feature', title: 'A2', keyword: 'a2', emoji: '🅰️', content: 'block' });
    const beta = await createIdeationSession(`Session Beta ${ts}`);
    await createBlock(beta.id, { type: 'feature', title: 'B1', keyword: 'b1', emoji: '🅱️', content: 'block' });
    await createBlock(beta.id, { type: 'feature', title: 'B2', keyword: 'b2', emoji: '🅱️', content: 'block' });
    const gamma = await createIdeationSession(`Session Gamma ${ts}`);
    await createBlock(gamma.id, { type: 'feature', title: 'C1', keyword: 'c1', emoji: '🇨', content: 'block' });
    await createBlock(gamma.id, { type: 'feature', title: 'C2', keyword: 'c2', emoji: '🇨', content: 'block' });

    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    // Use .first() to avoid strict mode when session name also appears in Continue buttons
    await expect(page.getByText(`Session Alpha ${ts}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`Session Beta ${ts}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`Session Gamma ${ts}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to session canvas when session card is clicked', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Clickable session ${ts}`);
    await createBlock(session.id, { type: 'feature', title: 'X', keyword: 'x', emoji: '📌', content: 'block' });
    await createBlock(session.id, { type: 'feature', title: 'Y', keyword: 'y', emoji: '📍', content: 'block' });

    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    // Session cards are clickable divs (generic elements), not links
    await page.getByText(`Clickable session ${ts}`).first().click();

    await expect(page).toHaveURL(new RegExp(`/ideation/session/${session.id}`), {
      timeout: 10_000,
    });
  });

  test('session canvas has Go back to dashboard button', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Back button ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Header banner has a "Go back to dashboard" button with an img icon
    const backButton = page.getByRole('button', { name: 'Go back to dashboard' });
    await expect(backButton).toBeVisible({ timeout: 10_000 });
  });

  test('navigates back to dashboard from session canvas', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Navigate back ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    const backButton = page.getByRole('button', { name: 'Go back to dashboard' });
    await expect(backButton).toBeVisible({ timeout: 10_000 });
    await backButton.click();

    // Should navigate back to dashboard
    await expect(page).toHaveURL(/\/ideation$/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: 'Ideation Dashboard', level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('new sessions appear in Continue section as buttons', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Continue btn ${ts}`);

    // Visit the session canvas to establish it as a recent session
    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Navigate to dashboard
    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    // Continue section shows session names as buttons
    await expect(
      page.getByRole('button', { name: `Continue btn ${ts}` })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Sent to Planner section shows empty state when no sessions sent', async ({ page }) => {
    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    // Empty state shows explanatory text
    await expect(
      page.getByText('No sessions sent to Planner yet')
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Curate blocks and click "\u2192 Planner" to send')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard has theme toggle button', async ({ page }) => {
    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard loads without errors', async ({ page }) => {
    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    // Verify dashboard heading renders (proves no crash)
    await expect(
      page.getByRole('heading', { name: 'Ideation Dashboard', level: 1 })
    ).toBeVisible({ timeout: 10_000 });

    // No error messages visible
    const errorText = page.getByText(/failed to load sessions/i);
    expect(await errorText.count()).toBe(0);
  });
});
