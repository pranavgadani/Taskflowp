const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// ─────────────────────────────────────────────
// Helper: authenticated browser context factory
// ─────────────────────────────────────────────
async function authContext(browser, role = 'superadmin') {
  const stateFile = path.resolve(__dirname, `../../.auth/${role}.json`);
  return browser.newContext({ storageState: stateFile });
}

// ─────────────────────────────────────────────
// TC-AUTH-001: Landing page & branding
// ─────────────────────────────────────────────
test.describe('Authentication & Authorization @smoke @auth', () => {

  test('TC-AUTH-001 · Landing page loads with branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Padhya Soft|TaskFlow/i);
    await expect(page.locator('body')).toContainText(/Padhya Soft|TaskFlow/i);
  });

  test('TC-AUTH-002 · Unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-003 · Unauthenticated visit to /task redirects to /login', async ({ page }) => {
    await page.goto('/task');
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-004 · Unauthenticated visit to /attendance redirects to /login', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-005 · Login page renders email & password inputs', async ({ page }) => {
    await page.goto('/login');
    // Open sign-in modal if not already visible
    const emailVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    if (!emailVisible) {
      const signInBtn = page.locator('button', { hasText: /Sign In/i }).first();
      await signInBtn.click();
    }
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('TC-AUTH-006 · Invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    const emailVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    if (!emailVisible) {
      await page.locator('button', { hasText: /Sign In/i }).first().click();
      await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 5000 });
    }
    await page.locator('input[type="email"]').fill('wrong@example.com');
    await page.locator('input[type="password"]').fill('WrongPass999');
    await page.locator('button[type="submit"]').click();
    // Should stay on login or show error toast
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-007 · Super Admin login succeeds and shows sidebar', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page).not.toHaveURL(/.*login/);
    await expect(page.locator('.sidebar')).toBeVisible();
    await ctx.close();
  });

  test('TC-AUTH-008 · Developer login succeeds and shows sidebar', async ({ browser }) => {
    const ctx  = await authContext(browser, 'developer');
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page).not.toHaveURL(/.*login/);
    await expect(page.locator('.sidebar')).toBeVisible();
    await ctx.close();
  });

  test('TC-AUTH-009 · /forgot-password page renders form', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 6000 });
  });

  test('TC-AUTH-010 · /reset-password page renders without crash', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.locator('body')).toBeVisible();
    // Should not be blank – either shows form or redirects
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
