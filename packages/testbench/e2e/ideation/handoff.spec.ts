/**
 * Ideation Handoff E2E Tests
 *
 * Tests the handoff-to-planner workflow:
 * - "-> Planner" button visibility in canvas header
 * - HandoffDialog opens/closes correctly
 * - Dialog content: title, block counts, radio options, threshold input
 * - Cancel and confirm buttons
 * - API handoff flow and plan creation verification
 *
 * HandoffDialog DOM structure (from source HandoffDialog.tsx):
 * - Overlay: fixed div with bg-black/60
 * - Dialog:
 *   - Header: h2 "Hand off to Planner" + Close button (aria-label="Close")
 *   - Content:
 *     - "Ready to send:" + curated block count + uncurated block count
 *     - Radio options (only shown when uncurated blocks exist):
 *       - "Leave out (only send curated)"
 *       - "Include as context (AI considers them)"
 *       - "Include all above [75]% confidence" with number input
 *   - Footer: "Cancel" button + "Send to Planner ->" button
 */
import { test, expect } from '../fixtures/base';
import {
  createIdeationSession,
  createBlock,
  curateBlock,
  sendToPlanner,
  getPlan,
} from '../fixtures/api';

test.describe('Ideation Handoff', () => {
  test('shows planner handoff button in session header', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Handoff button ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Button text is literally "-> Planner" (unicode arrow)
    const handoffButton = page.getByRole('button', { name: '\u2192 Planner' });
    await expect(handoffButton).toBeVisible({ timeout: 10_000 });
  });

  test('opens handoff dialog when button clicked', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Dialog open ${ts}`);

    // Create and curate a block so dialog has content
    const block = await createBlock(session.id, {
      type: 'feature',
      title: `Block A ${ts}`,
      keyword: 'blocka',
      emoji: '\uD83C\uDD70\uFE0F',
      content: 'Test block for handoff dialog',
    });
    await curateBlock(session.id, block.id);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Click the handoff button
    await page.getByRole('button', { name: '\u2192 Planner' }).click();

    // Dialog opens with title "Hand off to Planner"
    await expect(page.getByText('Hand off to Planner')).toBeVisible({ timeout: 5_000 });

    // Shows curated block count
    await expect(page.getByText(/curated blocks?/i)).toBeVisible({ timeout: 5_000 });

    // Action buttons present
    await expect(page.getByRole('button', { name: /Send to Planner/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
  });

  test('closes dialog when Cancel is clicked', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Dismiss dialog ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: '\u2192 Planner' }).click();
    await expect(page.getByText('Hand off to Planner')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /Cancel/i }).click();

    await expect(page.getByText('Hand off to Planner')).not.toBeVisible({ timeout: 5_000 });
  });

  test('closes dialog when Close (X) button is clicked', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Close X ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: '\u2192 Planner' }).click();
    await expect(page.getByText('Hand off to Planner')).toBeVisible({ timeout: 5_000 });

    // Close button (exact match to avoid matching "Close drawer" from AI Understanding)
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await expect(page.getByText('Hand off to Planner')).not.toBeVisible({ timeout: 5_000 });
  });

  test('closes dialog when overlay backdrop is clicked', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Backdrop close ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: '\u2192 Planner' }).click();
    await expect(page.getByText('Hand off to Planner')).toBeVisible({ timeout: 5_000 });

    // Click the overlay backdrop (the fixed inset-0 div)
    // Force click at a corner to hit the overlay, not the dialog content
    await page.click('.fixed.inset-0', { position: { x: 10, y: 10 } });

    await expect(page.getByText('Hand off to Planner')).not.toBeVisible({ timeout: 5_000 });
  });

  test('dialog shows uncurated block options when uncurated blocks exist', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Options test ${ts}`);

    // Create curated block
    const block1 = await createBlock(session.id, {
      type: 'feature',
      title: `Approved ${ts}`,
      keyword: 'approved',
      emoji: '\u2705',
      content: 'Curated block',
    });
    await curateBlock(session.id, block1.id);

    // Create uncurated block
    await createBlock(session.id, {
      type: 'feature',
      title: `Draft ${ts}`,
      keyword: 'draft',
      emoji: '\uD83D\uDCDD',
      content: 'Uncurated block',
    });

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: '\u2192 Planner' }).click();
    await expect(page.getByText('Hand off to Planner')).toBeVisible({ timeout: 5_000 });

    // Shows curated and uncurated counts (use specific text to avoid matching both)
    await expect(page.getByText(/\d+ curated blocks?$/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/\d+ un-curated block/i)).toBeVisible({ timeout: 5_000 });

    // Radio options for handling uncurated blocks
    await expect(page.getByText('Leave out (only send curated)')).toBeVisible();
    await expect(page.getByText('Include as context (AI considers them)')).toBeVisible();
    await expect(page.getByText(/Include all above/i)).toBeVisible();
  });

  test('dialog has threshold number input for confidence option', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Threshold ${ts}`);

    // Create curated + uncurated blocks to trigger options
    const block1 = await createBlock(session.id, {
      type: 'feature',
      title: `Curated ${ts}`,
      keyword: 'curated',
      emoji: '\u2705',
      content: 'Curated block',
    });
    await curateBlock(session.id, block1.id);

    await createBlock(session.id, {
      type: 'feature',
      title: `Uncurated ${ts}`,
      keyword: 'uncurated',
      emoji: '\u2B50',
      content: 'Uncurated block',
    });

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: '\u2192 Planner' }).click();
    await expect(page.getByText('Hand off to Planner')).toBeVisible({ timeout: 5_000 });

    // Threshold number input exists (default value 75)
    const thresholdInput = page.locator('input[type="number"]');
    await expect(thresholdInput).toBeVisible({ timeout: 5_000 });
    await expect(thresholdInput).toHaveValue('75');
  });

  test('dialog shows only curated count when no uncurated blocks', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Only curated ${ts}`);

    // Create only curated blocks (no uncurated)
    const block = await createBlock(session.id, {
      type: 'feature',
      title: `Feature ${ts}`,
      keyword: 'feature',
      emoji: '\uD83D\uDCA1',
      content: 'Curated only',
    });
    await curateBlock(session.id, block.id);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: '\u2192 Planner' }).click();
    await expect(page.getByText('Hand off to Planner')).toBeVisible({ timeout: 5_000 });

    // Shows curated count
    await expect(page.getByText(/1 curated block/i)).toBeVisible({ timeout: 5_000 });

    // Radio options should NOT be visible (no uncurated blocks)
    await expect(page.getByText('Leave out (only send curated)')).not.toBeVisible();
  });

  test('sends session to planner via API and creates plan', async () => {
    const ts = Date.now();
    const session = await createIdeationSession(`API handoff ${ts}`);

    const block1 = await createBlock(session.id, {
      type: 'feature',
      title: `Feature ${ts}`,
      keyword: 'feature',
      emoji: '\uD83D\uDCA1',
      content: 'Main feature description',
    });

    const block2 = await createBlock(session.id, {
      type: 'feature',
      title: `User Story ${ts}`,
      keyword: 'story',
      emoji: '\uD83D\uDC64',
      content: 'As a user I want...',
    });

    await curateBlock(session.id, block1.id);
    await curateBlock(session.id, block2.id);

    // Send via API
    const result = await sendToPlanner(session.id, {
      goal: `Implement feature from ideation ${ts}`,
      context: 'Generated from ideation session',
    });

    expect(result).toBeDefined();
    const planId = result.data?.plan_id ?? result.plan_id;
    expect(planId).toBeDefined();

    // Verify plan was created
    const plan = await getPlan(planId);
    expect(plan).toBeDefined();
    expect(plan.summary.goal).toContain(`Implement feature from ideation ${ts}`);
  });

  test('Sent to Planner section updates on dashboard after handoff', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Dashboard handoff ${ts}`);

    const block = await createBlock(session.id, {
      type: 'feature',
      title: `Feature ${ts}`,
      keyword: 'feature',
      emoji: '\u26A1',
      content: 'Feature for handoff',
    });
    await curateBlock(session.id, block.id);
    await sendToPlanner(session.id, {
      goal: `Handoff feature ${ts}`,
    });

    // Go to dashboard
    await page.goto('/ideation');
    await page.waitForLoadState('domcontentloaded');

    // "Sent to Planner" heading should reflect the count
    // After a successful handoff, the count should be >= 1
    await expect(
      page.getByRole('heading', { name: /Sent to Planner/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 });
  });
});
