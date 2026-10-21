/**
 * Page Object Model: Attendance Page
 */
class AttendancePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Clock In/Out
    this.clockInBtn    = page.locator('button', { hasText: /Clock In/i }).first();
    this.clockOutBtn   = page.locator('button', { hasText: /Clock Out/i }).first();
    this.statusBadge   = page.locator('.status-badge, [class*="status"]').first();

    // Work Schedules section
    this.workShiftsHeading = page.locator('h3', { hasText: /Company Work Shifts/i });
    this.shiftCards        = page.locator('.shift-card');

    // Attendance table
    this.attendanceTable = page.locator('table, .attendance-table, [class*="table"]').first();
    this.tableRows       = page.locator('tr').filter({ hasNot: page.locator('th') });

    // Date filter
    this.dateFilter = page.locator('input[type="date"]').first();
  }

  async goto() {
    await this.page.goto('/attendance');
    await this.page.waitForLoadState('networkidle');
  }

  async clockIn() {
    await this.clockInBtn.waitFor({ state: 'visible', timeout: 8000 });
    await this.clockInBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async clockOut() {
    await this.clockOutBtn.waitFor({ state: 'visible', timeout: 8000 });
    await this.clockOutBtn.click();
    await this.page.waitForTimeout(1000);
  }
}

module.exports = { AttendancePage };
