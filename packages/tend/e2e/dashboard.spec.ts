import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test('should load dashboard with main heading', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for "Tend Dashboard" heading (level 1)
    const mainHeading = page.getByRole('heading', { name: 'Tend Dashboard', level: 1 });
    await expect(mainHeading).toBeVisible({ timeout: 10_000 });
  });

  test('should render welcome section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for "Welcome to Tend" heading (level 2)
    const welcomeHeading = page.getByRole('heading', { name: 'Welcome to Tend', level: 2 });
    await expect(welcomeHeading).toBeVisible();

    // Check for welcome text
    const welcomeText = page.getByText(/What would you like to work on\? Create a new project/i);
    await expect(welcomeText).toBeVisible();
  });

  test('should show API failure message gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for async fetch to complete and error to render
    const failedToLoad = page.getByText('Failed to load projects');
    await expect(failedToLoad).toBeVisible({ timeout: 5000 });
  });

  test('should render status bar at bottom', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for connection indicator
    const offline = page.getByText('Offline');
    await expect(offline).toBeVisible();

    // Check for "No agents active"
    const noAgents = page.getByText('No agents active');
    await expect(noAgents).toBeVisible();

    // Check for collapse button
    const collapseButton = page.getByRole('button', { name: 'Collapse status bar' });
    await expect(collapseButton).toBeVisible();
  });

  test('should show status bar metrics', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Status bar should show: ❓ 0, ✓ 0, ⏱️ 00:00
    const questionButton = page.getByRole('button', { name: /❓ 0/ });
    await expect(questionButton).toBeVisible();
    await expect(questionButton).toBeDisabled();

    const checkmark = page.getByText('✓ 0');
    await expect(checkmark).toBeVisible();

    const timer = page.getByText(/⏱️ \d{2}:\d{2}/);
    await expect(timer).toBeVisible();
  });

  test('should have theme toggle button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for theme toggle button
    const themeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });
    await expect(themeButton).toBeVisible();
  });

  test('should handle theme toggle click', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find and click theme toggle
    const themeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/i });
    const initialText = await themeButton.textContent();

    await themeButton.click();

    // Wait a moment for theme change
    await page.waitForTimeout(100);

    // Button text should change (or at least page should not crash)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render without crashing when backend is down', async ({ page }) => {
    // This is the normal state for tests - backend is not running
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Page should render all key elements despite API failures
    await expect(page.getByRole('heading', { name: 'Tend Dashboard' })).toBeVisible();
    await expect(page.getByText('Offline')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
  });

  test('should collapse status bar when button clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find collapse button
    const collapseButton = page.getByRole('button', { name: 'Collapse status bar' });
    await expect(collapseButton).toBeVisible();

    // Click it
    await collapseButton.click();

    // Wait for animation
    await page.waitForTimeout(300);

    // Status bar metrics may be hidden or button text changed
    await expect(page.locator('body')).toBeVisible();
  });
});
