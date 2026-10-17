const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('HR Flow E2E Tests @hr', () => {

  test('Attendance page loads with Clock In / Status controls', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.resolve(__dirname, '../../.auth/superadmin.json'),
    });
    const page = await context.newPage();
    await page.goto('/attendance');

    await expect(page).toHaveURL(/.*attendance/);
    await expect(page.locator('body')).toContainText(/Attendance|Clock In|Shift/i);
    await context.close();
  });

  test('Break Management page loads and displays break types', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.resolve(__dirname, '../../.auth/superadmin.json'),
    });
    const page = await context.newPage();
    await page.goto('/breaks');

    await expect(page).toHaveURL(/.*breaks/);
    await expect(page.locator('body')).toContainText(/Break/i);
    await context.close();
  });

  test('Leave & Absence module loads balance overview', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.resolve(__dirname, '../../.auth/developer.json'),
    });
    const page = await context.newPage();
    await page.goto('/leave');

    await expect(page).toHaveURL(/.*leave/);
    await expect(page.locator('body')).toContainText(/Leave/i);
    await context.close();
  });
});
