/**
 * Page Object Model: Leave & Absence Page
 */
class LeavePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    this.applyLeaveBtn   = page.locator('button', { hasText: /Apply Leave|Request Leave|\+ Leave/i }).first();
    this.leaveTypeSelect = page.locator('select[name*="leave_type"], select[name*="type"]').first();
    this.startDateInput  = page.locator('input[name*="start"], input[type="date"]').first();
    this.endDateInput    = page.locator('input[name*="end"], input[type="date"]').last();
    this.reasonInput     = page.locator('textarea[name*="reason"], input[name*="reason"]').first();
    this.submitBtn       = page.locator('button[type="submit"]').first();
    this.modal           = page.locator('.modal, [role="dialog"]').first();
    this.leaveTable      = page.locator('table').first();
    this.balanceCard     = page.locator('[class*="balance"], [class*="leave-balance"]').first();
  }

  async goto() {
    await this.page.goto('/leave');
    await this.page.waitForLoadState('networkidle');
  }

  async applyLeave({ startDate, endDate, reason = 'Playwright test leave' } = {}) {
    await this.applyLeaveBtn.waitFor({ state: 'visible', timeout: 8000 });
    await this.applyLeaveBtn.click();
    await this.modal.waitFor({ state: 'visible', timeout: 5000 });

    if (startDate) await this.startDateInput.fill(startDate);
    if (endDate) await this.endDateInput.fill(endDate);
    if (reason) {
      const reasonField = this.page.locator('textarea, input[name*="reason"]').last();
      await reasonField.fill(reason);
    }
    await this.submitBtn.click();
    await this.page.waitForTimeout(1000);
  }
}

module.exports = { LeavePage };
