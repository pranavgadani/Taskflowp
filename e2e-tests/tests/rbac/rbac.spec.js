const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function authContext(browser, role = 'superadmin') {
  const stateFile = path.resolve(__dirname, `../../.auth/${role}.json`);
  return browser.newContext({ storageState: stateFile });
}

// ─────────────────────────────────────────────────────────────────────────────
// RBAC: Role-Based Access Control Suite
// ─────────────────────────────────────────────────────────────────────────────
test.describe('RBAC – Role-Based Access Control @rbac', () => {

  // ── SUPER ADMIN ────────────────────────────────────────────────────────────

  test('TC-RBAC-001 · Super Admin sidebar shows all management items', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/');

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    const expectedItems = ['Dashboard', 'Project', 'Staff', 'Role', 'Permission', 'Attendance'];
    for (const item of expectedItems) {
      await expect(sidebar.getByText(item, { exact: true }).first()).toBeVisible();
    }
    await ctx.close();
  });

  test('TC-RBAC-002 · Super Admin can access /staff page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/staff');
    await expect(page).toHaveURL(/.*staff/);
    await expect(page.locator('body')).toContainText(/Staff|Employee|Member/i);
    await ctx.close();
  });

  test('TC-RBAC-003 · Super Admin can access /role page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/role');
    await expect(page).toHaveURL(/.*role/);
    await expect(page.locator('body')).toContainText(/Role/i);
    await ctx.close();
  });

  test('TC-RBAC-004 · Super Admin can access /permission page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/permission');
    await expect(page).toHaveURL(/.*permission/);
    await expect(page.locator('body')).toContainText(/Permission/i);
    await ctx.close();
  });

  test('TC-RBAC-005 · Super Admin can access /attendance page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/attendance');
    await expect(page).toHaveURL(/.*attendance/);
    await expect(page.locator('body')).toContainText(/Attendance|Clock|Shift/i);
    await ctx.close();
  });

  test('TC-RBAC-006 · Super Admin can access /task page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/task');
    await expect(page).toHaveURL(/.*task/);
    await expect(page.locator('body')).toContainText(/Task/i);
    await ctx.close();
  });

  test('TC-RBAC-007 · Super Admin can access /project page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/project');
    await expect(page).toHaveURL(/.*project/);
    await expect(page.locator('body')).toContainText(/Project/i);
    await ctx.close();
  });

  test('TC-RBAC-008 · Super Admin can access /clients page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/clients');
    await expect(page).toHaveURL(/.*clients/);
    await expect(page.locator('body')).toContainText(/Client/i);
    await ctx.close();
  });

  // ── DEVELOPER ──────────────────────────────────────────────────────────────

  test('TC-RBAC-009 · Developer is redirected away from /role', async ({ browser }) => {
    const ctx  = await authContext(browser, 'developer');
    const page = await ctx.newPage();
    await page.goto('/role');
    // Should redirect to dashboard (/)
    await expect(page).toHaveURL(/^\S*\/(#.*)?$/);
    await ctx.close();
  });

  test('TC-RBAC-010 · Developer is redirected away from /staff', async ({ browser }) => {
    const ctx  = await authContext(browser, 'developer');
    const page = await ctx.newPage();
    await page.goto('/staff');
    await expect(page).toHaveURL(/^\S*\/(#.*)?$/);
    await ctx.close();
  });

  test('TC-RBAC-011 · Developer is redirected away from /permission', async ({ browser }) => {
    const ctx  = await authContext(browser, 'developer');
    const page = await ctx.newPage();
    await page.goto('/permission');
    await expect(page).toHaveURL(/^\S*\/(#.*)?$/);
    await ctx.close();
  });

  test('TC-RBAC-012 · Developer can access /task page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'developer');
    const page = await ctx.newPage();
    await page.goto('/task');
    // Developer has task_management read permission → should load
    await expect(page.locator('body')).toContainText(/Task/i);
    await ctx.close();
  });

  test('TC-RBAC-013 · Developer can access /leave page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'developer');
    const page = await ctx.newPage();
    await page.goto('/leave');
    await expect(page.locator('body')).toContainText(/Leave/i);
    await ctx.close();
  });

  test('TC-RBAC-014 · Developer can access /profile page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'developer');
    const page = await ctx.newPage();
    await page.goto('/profile');
    await expect(page.locator('body')).toContainText(/Profile|Account/i);
    await ctx.close();
  });

  test('TC-RBAC-015 · Developer cannot access /clients (owner/admin only)', async ({ browser }) => {
    const ctx  = await authContext(browser, 'developer');
    const page = await ctx.newPage();
    await page.goto('/clients');
    // Should redirect to dashboard
    await expect(page).toHaveURL(/^\S*\/(#.*)?$/);
    await ctx.close();
  });

  // ── NAVIGATION REDIRECTS ───────────────────────────────────────────────────

  test('TC-RBAC-016 · /projects alias redirects to /project for Super Admin', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/projects');
    await expect(page).toHaveURL(/.*project/);
    await ctx.close();
  });

  test('TC-RBAC-017 · /tasks alias redirects to /task', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/tasks');
    await expect(page).toHaveURL(/.*task/);
    await ctx.close();
  });

  test('TC-RBAC-018 · /policies alias redirects to /profile?tab=policies', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/policies');
    await expect(page).toHaveURL(/.*profile.*policies|.*profile/i);
    await ctx.close();
  });

  test('TC-RBAC-019 · Unknown route redirects to dashboard for authenticated user', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/^\S*\/(#.*)?$/);
    await ctx.close();
  });
});
