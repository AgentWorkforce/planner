import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('should load settings page', async ({ page }) => {
    await page.goto('/settings');

    // Check for "Settings" heading
    const heading = page.locator('h1').filter({ hasText: 'Settings' });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should display all settings sections', async ({ page }) => {
    await page.goto('/settings');

    // Check for main section headings
    const themeSection = page.locator('h2').filter({ hasText: 'Theme' });
    const notificationsSection = page.locator('h2').filter({ hasText: 'Notifications' });
    const agentSection = page.locator('h2').filter({ hasText: /Agent/i });
    const aboutSection = page.locator('h2').filter({ hasText: 'About' });

    await expect(themeSection).toBeVisible();
    await expect(notificationsSection).toBeVisible();
    await expect(agentSection).toBeVisible();
    await expect(aboutSection).toBeVisible();
  });

  test('should toggle theme between light/dark/system', async ({ page }) => {
    await page.goto('/settings');

    // Find theme buttons
    const lightButton = page.locator('button').filter({ hasText: 'Light' });
    const darkButton = page.locator('button').filter({ hasText: 'Dark' });
    const systemButton = page.locator('button').filter({ hasText: 'System' });

    // All buttons should be visible
    await expect(lightButton).toBeVisible();
    await expect(darkButton).toBeVisible();
    await expect(systemButton).toBeVisible();

    // Click light theme
    await lightButton.click();
    // Button should show active state (has accent-green class or similar)
    await expect(lightButton).toHaveClass(/accent-green|bg-accent/);

    // Click dark theme
    await darkButton.click();
    await expect(darkButton).toHaveClass(/accent-green|bg-accent/);

    // Click system theme
    await systemButton.click();
    await expect(systemButton).toHaveClass(/accent-green|bg-accent/);
  });

  test('should display notification settings', async ({ page }) => {
    await page.goto('/settings');

    // Look for notification checkboxes
    const questionBubblesLabel = page.locator('text=/Question Bubbles/i');
    const soundAlertsLabel = page.locator('text=/Sound Alerts/i');

    await expect(questionBubblesLabel).toBeVisible();
    await expect(soundAlertsLabel).toBeVisible();

    // Check that checkboxes exist and are interactive
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(3); // 2 notification + 1 agent auto-approve
  });

  test('should toggle notification settings', async ({ page }) => {
    await page.goto('/settings');

    // Find first checkbox (question bubbles)
    const firstCheckbox = page.locator('input[type="checkbox"]').first();

    // Get initial state
    const initialState = await firstCheckbox.isChecked();

    // Toggle it
    await firstCheckbox.click();

    // State should have changed
    const newState = await firstCheckbox.isChecked();
    expect(newState).toBe(!initialState);

    // Toggle back
    await firstCheckbox.click();
    const finalState = await firstCheckbox.isChecked();
    expect(finalState).toBe(initialState);
  });

  test('should display agent preferences section', async ({ page }) => {
    await page.goto('/settings');

    // Check for response speed options
    const fastButton = page.locator('button').filter({ hasText: 'Fast' });
    const balancedButton = page.locator('button').filter({ hasText: 'Balanced' });
    const thoroughButton = page.locator('button').filter({ hasText: 'Thorough' });

    await expect(fastButton).toBeVisible();
    await expect(balancedButton).toBeVisible();
    await expect(thoroughButton).toBeVisible();

    // Check for auto-approve checkbox
    const autoApproveLabel = page.locator('text=/Auto-approve/i');
    await expect(autoApproveLabel).toBeVisible();
  });

  test('should change agent response speed', async ({ page }) => {
    await page.goto('/settings');

    // Find response speed buttons
    const fastButton = page.locator('button').filter({ hasText: 'Fast' });
    const balancedButton = page.locator('button').filter({ hasText: 'Balanced' });

    // Click fast
    await fastButton.click();
    await expect(fastButton).toHaveClass(/accent-green|bg-accent/);

    // Click balanced
    await balancedButton.click();
    await expect(balancedButton).toHaveClass(/accent-green|bg-accent/);
  });

  test('should display about section with version info', async ({ page }) => {
    await page.goto('/settings');

    // Check for version information
    const versionLabel = page.locator('text=/Version/i');
    const environmentLabel = page.locator('text=/Environment/i');

    await expect(versionLabel).toBeVisible();
    await expect(environmentLabel).toBeVisible();

    // Check for reset button
    const resetButton = page.locator('button').filter({ hasText: /Reset/i });
    await expect(resetButton).toBeVisible();
  });

  test('should persist settings across navigation', async ({ page }) => {
    await page.goto('/settings');

    // Change theme to dark
    const darkButton = page.locator('button').filter({ hasText: 'Dark' });
    await darkButton.click();

    // Navigate away
    await page.goto('/');

    // Navigate back
    await page.goto('/settings');

    // Dark button should still be selected
    await expect(darkButton).toHaveClass(/accent-green|bg-accent/);
  });
});
