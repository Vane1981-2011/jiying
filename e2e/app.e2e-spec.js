import { test, expect } from '@playwright/test';

test.describe('稽影 (Jiying) App', () => {

  test('page loads successfully with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('稽影');
  });

  test('dashboard renders key elements', async ({ page }) => {
    await page.goto('/');

    // Main heading
    await expect(page.locator('h1')).toContainText('稽影');

    // Subtitle / tagline
    await expect(page.locator('text=稽察审视，追影溯源')).toBeVisible();

    // Goal input textarea
    const goalInput = page.locator('textarea[placeholder*="你想要做什么"]');
    await expect(goalInput).toBeVisible();
    await expect(goalInput).toBeEnabled();

    // "开始" (Start) button
    const startButton = page.locator('button[type="submit"]');
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeDisabled(); // disabled until goal is entered

    // Context panel
    await expect(page.locator('text=语境')).toBeVisible();
  });

  test('settings page is accessible', async ({ page }) => {
    await page.goto('/settings');

    // Settings page heading
    await expect(page.locator('h1')).toContainText('设置');

    // API Key section
    await expect(page.locator('text=DeepSeek API Key')).toBeVisible();

    // Model selection section
    await expect(page.locator('text=AI 模型')).toBeVisible();

    // Uncomfortable mode toggle
    await expect(page.locator('text=不舒服模式')).toBeVisible();

    // Shell execution section
    await expect(page.locator('text=Shell 执行')).toBeVisible();
  });

  test('navigation between tabs works', async ({ page }) => {
    await page.goto('/');

    // Verify we start on the dashboard (工坊 tab should be active)
    const workspaceTab = page.locator('a[href="/"]');
    await expect(workspaceTab).toHaveClass(/bg-purple-100/);

    // Navigate to Settings via sidebar
    await page.locator('a[href="/settings"]').click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('h1')).toContainText('设置');

    // Navigate to Skills page
    await page.locator('a[href="/skills"]').click();
    await expect(page).toHaveURL(/\/skills/);

    // Navigate to Reflect page
    await page.locator('a[href="/reflect"]').click();
    await expect(page).toHaveURL(/\/reflect/);

    // Navigate to Audit (health) page
    await page.locator('a[href="/audit"]').click();
    await expect(page).toHaveURL(/\/audit/);

    // Navigate back to Dashboard
    await page.locator('a[href="/"]').click();
    await expect(page).toHaveURL('http://localhost:5173/');
    await expect(page.locator('h1')).toContainText('稽影');
  });

  test('goal input flow enables start button', async ({ page }) => {
    await page.goto('/');

    const goalInput = page.locator('textarea[placeholder*="你想要做什么"]');
    const startButton = page.locator('button[type="submit"]');

    // Start button should be disabled initially
    await expect(startButton).toBeDisabled();

    // Type a goal
    await goalInput.fill('分析2026年新能源汽车市场格局');

    // Start button should become enabled
    await expect(startButton).toBeEnabled();

    // Click start and verify we move to step 2 (trace step)
    await startButton.click();
    await expect(page.locator('text=服务于谁？')).toBeVisible();
  });

});
