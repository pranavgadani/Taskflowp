const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Role Based Access Control Suite @rbac', () => {

  test('Super Admin sees full management navigation', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.resolve(__dirname, '../../.auth/superadmin.json'),
    });
    const page = await context.newPage();
    await page.goto('/');

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Verify presence of core modules
    await expect(sidebar.getByText('Dashboard')).toBeVisible();
    await expect(sidebar.getByText('Project', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('Staff')).toBeVisible();
    await expect(sidebar.getByText('Role')).toBeVisible();
    await expect(sidebar.getByText('Permission')).toBeVisible();
    await expect(sidebar.getByText('Attendance')).toBeVisible();
    await expect(sidebar.getByText('Leave & Absence')).toBeVisible();
    await expect(sidebar.getByText('Performance & Rating')).toBeVisible();
    await expect(sidebar.getByText('Break Management')).toBeVisible();
    await expect(sidebar.getByText('Team Chat')).toBeVisible();
    await context.close();
  });

  test('Developer role is blocked from Company Policy/Settings direct route', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.resolve(__dirname, '../../.auth/developer.json'),
    });
    const page = await context.newPage();
    
    // Developer visiting /staff or restricted paths
    await page.goto('/role');
    // Developer should be redirected to dashboard /
    await expect(page).toHaveURL(/\/(#.*)?$/);
    await context.close();
  });

});
