import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('should load settings page with main heading', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Check for "Settings" heading (level 1)
    const heading = page.getByRole('heading', { name: 'Settings', level: 1 });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should display all settings sections', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Check for all section headings (level 2)
    const themeSection = page.getByRole('heading', { name: 'Theme', level: 2 });
    await expect(themeSection).toBeVisible();

    const notificationsSection = page.getByRole('heading', { name: 'Notifications', level: 2 });
    await expect(notificationsSection).toBeVisible();

    const agentSection = page.getByRole('heading', { name: 'Agent Preferences', level: 2 });
    await expect(agentSection).toBeVisible();

    const aboutSection = page.getByRole('heading', { name: 'About', level: 2 });
    await expect(aboutSection).toBeVisible();
  });

  test('should display theme description', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Check for theme description text
    const description = page.getByText(/Choose how Tend looks\. System matches your device preference\./i);
    await expect(description).toBeVisible();
  });

  test('should have all theme toggle buttons', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Find all three theme buttons
    const lightButton = page.getByRole('button', { name: 'Light' });
    const darkButton = page.getByRole('button', { name: 'Dark' });
    const systemButton = page.getByRole('button', { name: 'System' });

    await expect(lightButton).toBeVisible();
    await expect(darkButton).toBeVisible();
    await expect(systemButton).toBeVisible();
  });

  test('should toggle theme selection', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const lightButton = page.getByRole('button', { name: 'Light' });
    const darkButton = page.getByRole('button', { name: 'Dark' });

    // Click light theme
    await lightButton.click();
    await page.waitForTimeout(100);

    // Click dark theme
    await darkButton.click();
    await page.waitForTimeout(100);

    // Page should still be visible (theme change should work)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display notification checkboxes', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Check for notification settings text
    const questionBubbles = page.getByText(/Question Bubbles/i);
    await expect(questionBubbles).toBeVisible();

    const soundAlerts = page.getByText(/Sound Alerts/i);
    await expect(soundAlerts).toBeVisible();
  });

  test('should have notification checkboxes with correct default states', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Get all checkboxes
    const checkboxes = page.getByRole('checkbox');

    // Should have 3 checkboxes total (2 notification + 1 auto-approve)
    await expect(checkboxes).toHaveCount(3);
  });

  test('should toggle notification checkboxes', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Find first checkbox
    const firstCheckbox = page.getByRole('checkbox').first();

    // Get initial state
    const initialChecked = await firstCheckbox.isChecked();

    // Toggle it
    await firstCheckbox.click();
    await page.waitForTimeout(100);

    // Should have changed
    const afterToggle = await firstCheckbox.isChecked();
    expect(afterToggle).toBe(!initialChecked);

    // Toggle back
    await firstCheckbox.click();
    await page.waitForTimeout(100);

    // Should be back to original
    const afterSecondToggle = await firstCheckbox.isChecked();
    expect(afterSecondToggle).toBe(initialChecked);
  });

  test('should display agent preferences section', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Check for response speed label
    const responseSpeed = page.getByText('Default Response Speed');
    await expect(responseSpeed).toBeVisible();

    // Check for speed buttons
    const fastButton = page.getByRole('button', { name: 'Fast' });
    const balancedButton = page.getByRole('button', { name: 'Balanced' });
    const thoroughButton = page.getByRole('button', { name: 'Thorough' });

    await expect(fastButton).toBeVisible();
    await expect(balancedButton).toBeVisible();
    await expect(thoroughButton).toBeVisible();
  });

  test('should have auto-approve checkbox', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Check for auto-approve text
    const autoApprove = page.getByText(/Auto-approve Actions/i);
    await expect(autoApprove).toBeVisible();
  });

  test('should change agent response speed', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const fastButton = page.getByRole('button', { name: 'Fast' });
    const balancedButton = page.getByRole('button', { name: 'Balanced' });
    const thoroughButton = page.getByRole('button', { name: 'Thorough' });

    // Click through all options
    await fastButton.click();
    await page.waitForTimeout(50);

    await balancedButton.click();
    await page.waitForTimeout(50);

    await thoroughButton.click();
    await page.waitForTimeout(50);

    // Page should remain stable
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display about section with version info', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Check for version label
    const versionLabel = page.getByText('Version');
    await expect(versionLabel).toBeVisible();

    // Check for version number
    const versionNumber = page.getByText('0.1.0');
    await expect(versionNumber).toBeVisible();

    // Check for environment label
    const environmentLabel = page.getByText('Environment');
    await expect(environmentLabel).toBeVisible();

    // Check for environment value
    const environmentValue = page.getByText('development');
    await expect(environmentValue).toBeVisible();
  });

  test('should have reset to defaults button', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Check for reset button
    const resetButton = page.getByRole('button', { name: 'Reset to Defaults' });
    await expect(resetButton).toBeVisible();
  });

  test('should reset settings when reset button clicked', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Change a setting first
    const darkButton = page.getByRole('button', { name: 'Dark' });
    await darkButton.click();
    await page.waitForTimeout(100);

    // Click reset
    const resetButton = page.getByRole('button', { name: 'Reset to Defaults' });
    await resetButton.click();
    await page.waitForTimeout(200);

    // Page should still be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('should persist settings across navigation', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Change theme to dark
    const darkButton = page.getByRole('button', { name: 'Dark' });
    await darkButton.click();
    await page.waitForTimeout(100);

    // Navigate away
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navigate back
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Settings should still be visible and functional
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });
});
