/**
 * Extended Playwright test fixture with common helpers.
 */
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

export const test = base.extend<{
  /**
   * Wait for the app to be fully loaded (no loading spinners/skeletons).
   */
  waitForAppReady: (page: Page) => Promise<void>;
}>({
  waitForAppReady: async ({}, use) => {
    await use(async (page: Page) => {
      // Wait for main content to be present (not a loading screen)
      await page.waitForLoadState('networkidle');
    });
  },
});

/**
 * Navigate and wait for a page to be interactive.
 */
export async function navigateAndWait(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Wait for a toast notification to appear with specific text.
 */
export async function waitForToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Dismiss all visible toasts by clicking them.
 */
export async function dismissToasts(page: Page) {
  const toasts = page.locator('[data-sonner-toast]');
  const count = await toasts.count();
  for (let i = 0; i < count; i++) {
    try {
      await toasts.nth(i).click({ timeout: 1000 });
    } catch {
      // Toast may have auto-dismissed
    }
  }
}
