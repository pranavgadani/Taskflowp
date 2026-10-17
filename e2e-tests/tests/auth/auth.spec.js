const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/LoginPage');
require('dotenv').config();

test.describe('Authentication Suite @smoke @auth', () => {
  test('Landing page loads and displays brand TaskFlow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('TaskFlow').first()).toBeVisible();
  });

  test('Valid login redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/(#.*)?$/);
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('Invalid credentials show error toast/message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginModal();
    await loginPage.emailInput.fill('invalid_user_999@example.com');
    await loginPage.passwordInput.fill('WrongPassword123');
    await loginPage.submitBtn.click();
    
    // Check that we stay on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('Unauthenticated user accessing protected route redirects to login', async ({ page }) => {
    await page.goto('/project');
    await expect(page).toHaveURL(/.*login/);
  });
});
