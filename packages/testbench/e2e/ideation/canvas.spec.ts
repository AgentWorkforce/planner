/**
 * Ideation Canvas E2E Tests
 *
 * Tests session canvas page functionality:
 * - Header banner: back button, session title (button), progress %, theme toggle,
 *   "AI Understanding" button, "-> Planner" handoff button
 * - Forming column: heading "Forming (N)" [level=2], physics-animated blocks
 * - Chat area: textbox "Type your message...", disabled Send button, helper text
 * - Curated column: empty state, curated block display
 * - AI Understanding drawer
 * - Non-existent session error handling
 *
 * DOM structure (from browser snapshots):
 * - banner (header bar):
 *   - button "Go back to dashboard" with img
 *   - button with session title text + dropdown img
 *   - generic with progress percentage (e.g., "0%")
 *   - button "Switch to dark mode"
 *   - button "AI Understanding"
 *   - button "-> Planner"
 * - heading "Forming (0)" [level=2]
 * - textbox "Type your message..."
 * - button "Send message" [disabled] with img
 * - paragraph "Press Enter to send, Shift+Enter for new line"
 * - Curated column empty state: "No curated blocks yet" + helper text
 */
import { test, expect } from '../fixtures/base';
import {
  createIdeationSession,
  createBlock,
  curateBlock,
} from '../fixtures/api';

test.describe('Ideation Canvas', () => {
  test('shows session title in header banner as a button', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`My Session ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Session title appears as a button in the header banner (with dropdown)
    await expect(
      page.getByRole('button', { name: new RegExp(`My Session ${ts}`) })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows Forming column heading', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Forming column ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Forming heading shows block count, e.g., "Forming (0)"
    await expect(
      page.getByRole('heading', { name: /Forming/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows chat input with correct placeholder', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Chat placeholder ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Chat input has placeholder "Type your message..." (NOT "Type a message...")
    const chatInput = page.getByPlaceholder('Type your message...');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await expect(chatInput).toBeEnabled();
  });

  test('shows helper text for chat input', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Helper text ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByText('Press Enter to send, Shift+Enter for new line')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows Send message button (initially disabled)', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Send btn ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    const sendButton = page.getByRole('button', { name: 'Send message' });
    await expect(sendButton).toBeVisible({ timeout: 10_000 });
    await expect(sendButton).toBeDisabled();
  });

  test('shows planner handoff button with arrow text', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Handoff btn ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // The handoff button text is literally "-> Planner" (with unicode arrow)
    const handoffButton = page.getByRole('button', { name: '\u2192 Planner' });
    await expect(handoffButton).toBeVisible({ timeout: 10_000 });
  });

  test('shows AI Understanding button', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`AI btn test ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('button', { name: 'AI Understanding' })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows Go back to dashboard button', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Back btn ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('button', { name: 'Go back to dashboard' })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows empty curated column state', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Empty curated ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('No curated blocks yet')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Click on forming blocks to curate them when ready')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('displays blocks in forming column when created via API', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Block display ${ts}`);

    await createBlock(session.id, {
      type: 'feature',
      title: `Auth Feature ${ts}`,
      keyword: 'authentication',
      emoji: '\uD83D\uDD10',
      content: 'Implement OAuth2 authentication flow',
    });

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Blocks render as physics-animated elements; test for keyword or emoji text content
    // The forming heading count should reflect the block: "Forming (1)"
    await expect(
      page.getByRole('heading', { name: /Forming \(1\)/i, level: 2 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('curated blocks appear in curated column', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Curated blocks ${ts}`);

    const block = await createBlock(session.id, {
      type: 'feature',
      title: `Curated Feature ${ts}`,
      keyword: 'curated',
      emoji: '\u2705',
      content: 'This block has been curated',
    });

    await curateBlock(session.id, block.id);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Curated block keyword and emoji should be visible in curated column
    await expect(page.getByText('curated').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('\u2705').first()).toBeVisible({ timeout: 10_000 });

    // Empty state text should NOT be visible since there is a curated block
    await expect(page.getByText('No curated blocks yet')).not.toBeVisible({ timeout: 5_000 });
  });

  test('AI Understanding drawer opens when button clicked', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`AI drawer ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Click the AI Understanding button
    await page.getByRole('button', { name: 'AI Understanding' }).click();

    // Dialog opens with heading "AI Understanding" [level=2]
    await expect(
      page.getByRole('dialog', { name: 'AI Understanding' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: 'AI Understanding', level: 2 })
    ).toBeVisible({ timeout: 5_000 });

    // Has a close button
    await expect(
      page.getByRole('button', { name: 'Close drawer' })
    ).toBeVisible({ timeout: 5_000 });

    // Shows analyzing message for new session
    await expect(
      page.getByText('AI is still analyzing your idea...')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('AI Understanding drawer closes when close button clicked', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`AI close ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'AI Understanding' }).click();
    await expect(
      page.getByRole('dialog', { name: 'AI Understanding' })
    ).toBeInViewport({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Close drawer' }).click();

    await expect(
      page.getByRole('dialog', { name: 'AI Understanding' })
    ).not.toBeInViewport({ timeout: 5_000 });
  });

  test('handles non-existent session gracefully', async ({ page }) => {
    await page.goto('/ideation/session/nonexistent-session-12345');
    await page.waitForLoadState('domcontentloaded');

    // CanvasPage renders "Session not found" for invalid session IDs
    await expect(
      page.getByText(/session not found/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows progress percentage in header', async ({ page }) => {
    const ts = Date.now();
    const session = await createIdeationSession(`Progress ${ts}`);

    await page.goto(`/ideation/session/${session.id}`);
    await page.waitForLoadState('domcontentloaded');

    // Progress percentage displayed in header (e.g., "0%")
    await expect(page.getByText(/\d+%/)).toBeVisible({ timeout: 10_000 });
  });
});
