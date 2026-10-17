class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.signInHeaderBtn = page.locator('button.header-login-btn, button:has-text("Sign In to Workspace"), button:has-text("Sign In")').first();
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitBtn = page.locator('form button[type="submit"]');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openLoginModal() {
    if (await this.emailInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }
    await this.signInHeaderBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.signInHeaderBtn.click();
    await this.emailInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  async login(email, password) {
    await this.goto();
    await this.openLoginModal();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitBtn.click();
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 12000 });
  }
}

module.exports = { LoginPage };
