const { test as setup, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authDir = path.resolve(__dirname, '../.auth');

if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

setup('authenticate as Super Admin', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD);
  await expect(page).not.toHaveURL(/.*login/);
  await page.context().storageState({ path: path.join(authDir, 'superadmin.json') });
});

setup('authenticate as Developer', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(process.env.DEVELOPER_EMAIL, process.env.DEVELOPER_PASSWORD);
  await expect(page).not.toHaveURL(/.*login/);
  await page.context().storageState({ path: path.join(authDir, 'developer.json') });
});
