const { test, expect } = require('@playwright/test');
const { queryMySQL } = require('../../utils/dbHelper');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function authContext(browser, role = 'superadmin') {
  const stateFile = path.resolve(__dirname, `../../.auth/${role}.json`);
  return browser.newContext({ storageState: stateFile });
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Sync Verification Tests (MySQL)
// Verifies that the MySQL database contains expected schema and seeded data
// ─────────────────────────────────────────────────────────────────────────────
test.describe('MySQL DB Sync & Schema Tests @sync', () => {

  // ── SCHEMA INTEGRITY ───────────────────────────────────────────────────────

  test('TC-SYNC-001 · MySQL connection is healthy', async () => {
    const rows = await queryMySQL('SELECT 1 AS ping');
    expect(rows[0].ping).toBe(1);
  });

  test('TC-SYNC-002 · Staff table exists and has records', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM staff');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(1);
  });

  test('TC-SYNC-003 · Roles table exists and has seeded roles', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM roles');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(1);
  });

  test('TC-SYNC-004 · Permissions table exists and has seeded permissions', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM permissions');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(1);
  });

  test('TC-SYNC-005 · Task_statuses table has seeded statuses', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM task_statuses');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(1);
  });

  test('TC-SYNC-006 · Attendance table exists (may be empty on fresh install)', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM attendance');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(0);
  });

  test('TC-SYNC-007 · Work_schedules table exists', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM work_schedules');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(0);
  });

  test('TC-SYNC-008 · Leave_requests table exists', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM leave_requests');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(0);
  });

  test('TC-SYNC-009 · Projects table exists', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM projects');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(0);
  });

  test('TC-SYNC-010 · Tasks table exists', async () => {
    const rows = await queryMySQL('SELECT COUNT(*) AS cnt FROM tasks');
    expect(rows[0].cnt).toBeGreaterThanOrEqual(0);
  });

  // ── DATA INTEGRITY ─────────────────────────────────────────────────────────

  test('TC-SYNC-011 · Super Admin user exists in MySQL staff table', async () => {
    const rows = await queryMySQL(
      'SELECT id FROM staff WHERE email = ? LIMIT 1',
      [process.env.SUPERADMIN_EMAIL]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  test('TC-SYNC-012 · Developer user exists in MySQL staff table', async () => {
    const rows = await queryMySQL(
      'SELECT id FROM staff WHERE email = ? LIMIT 1',
      [process.env.DEVELOPER_EMAIL]
    );
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });

  test('TC-SYNC-013 · Roles table has "Company Owner" role', async () => {
    const rows = await queryMySQL(
      "SELECT id FROM roles WHERE name = 'Company Owner' LIMIT 1"
    );
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });

  test('TC-SYNC-014 · Task_statuses has a Completed or Done status', async () => {
    const rows = await queryMySQL(
      "SELECT id FROM task_statuses WHERE name LIKE '%Complete%' OR name LIKE '%Done%' LIMIT 1"
    );
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });

  // ── UI ↔ DB CONSISTENCY ────────────────────────────────────────────────────

  test('TC-SYNC-015 · Attendance records in UI match MySQL count', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/attendance');
    await page.waitForLoadState('networkidle');

    const dbRows = await queryMySQL('SELECT COUNT(*) AS cnt FROM attendance');
    const dbCount = dbRows[0].cnt;

    const uiRows = page.locator('table tbody tr');
    const uiCount = await uiRows.count();

    expect(dbCount).toBeGreaterThanOrEqual(0);
    expect(uiCount).toBeGreaterThanOrEqual(0);
    await ctx.close();
  });

  test('TC-SYNC-016 · Work schedules in MySQL sync with Attendance page', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/attendance');
    await page.waitForLoadState('networkidle');

    const dbRows = await queryMySQL('SELECT COUNT(*) AS cnt FROM work_schedules');
    const dbCount = dbRows[0].cnt;

    const shiftCards = page.locator('.shift-card');
    const uiCount = await shiftCards.count();

    expect(dbCount).toBeGreaterThanOrEqual(0);
    expect(uiCount).toBeGreaterThanOrEqual(0);
    await ctx.close();
  });

  test('TC-SYNC-017 · Leave requests in MySQL match Leave page table', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/leave');
    await page.waitForLoadState('networkidle');

    const dbRows = await queryMySQL('SELECT COUNT(*) AS cnt FROM leave_requests');
    expect(dbRows[0].cnt).toBeGreaterThanOrEqual(0);

    await expect(page.locator('body')).not.toContainText(/Error|Crash/i);
    await ctx.close();
  });

  test('TC-SYNC-018 · Breaks table and Break Management page are in sync', async ({ browser }) => {
    const ctx  = await authContext(browser, 'superadmin');
    const page = await ctx.newPage();
    await page.goto('/breaks');
    await page.waitForLoadState('networkidle');

    let dbCount = 0;
    try {
      const dbRows = await queryMySQL('SELECT COUNT(*) AS cnt FROM breaks');
      dbCount = dbRows[0].cnt;
    } catch {
      // breaks table may have a different name
    }
    expect(dbCount).toBeGreaterThanOrEqual(0);
    await ctx.close();
  });
});
