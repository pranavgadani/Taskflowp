const { chromium } = require('playwright');

async function testAllModules() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('🚀 Step 1: Navigating to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

  // Check if sign in button or input is visible
  const emailField = page.locator('input[type="email"]').first();
  if (!await emailField.isVisible()) {
    console.log('Clicking Sign In button to open modal...');
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(600);
  }

  console.log('🔑 Step 2: Logging in as Priya Patel (priya@itcompany.com)...');
  await page.fill('input[type="email"]', 'priya@itcompany.com');
  await page.fill('input[type="password"]', 'Test@123');

  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(2500);

  console.log('📍 Current URL after login:', page.url());

  const modulesToTest = [
    { name: 'Attendance Management', path: '/attendance' },
    { name: 'Dashboard', path: '/' },
    { name: 'Projects', path: '/project' },
    { name: 'Tasks', path: '/task' },
    { name: 'Timesheets', path: '/timesheet' },
    { name: 'Issues', path: '/issue' },
    { name: 'Task Status', path: '/task-status' },
    { name: 'Team', path: '/team' },
    { name: 'Documents', path: '/document' },
    { name: 'QA & Testing', path: '/qa' },
    { name: 'Staff', path: '/staff' },
    { name: 'Role', path: '/role' },
    { name: 'Permission', path: '/permission' },
    { name: 'Leave & Absence', path: '/leave' },
    { name: 'Performance & Rating', path: '/rating' },
    { name: 'Break Management', path: '/breaks' },
    { name: 'Team Chat', path: '/chat' },
    { name: 'Company Policies', path: '/profile?tab=policies' }
  ];

  console.log('\n================ MODULE CHECK REPORT ================');
  const results = [];

  for (const mod of modulesToTest) {
    let apiCalls = [];
    const onResponse = (response) => {
      const url = response.url();
      if (url.includes('/api/') && !url.includes('/user-permissions') && !url.includes('/auth/me')) {
        apiCalls.push({ url, status: response.status() });
      }
    };
    page.on('response', onResponse);

    try {
      await page.goto('http://localhost:5173' + mod.path, { waitUntil: 'networkidle', timeout: 8000 });
      await page.waitForTimeout(600);

      const currentUrl = page.url();
      const bodyText = await page.locator('body').innerText();
      
      const isRedirected = !currentUrl.includes(mod.path.split('?')[0]) && mod.path !== '/';
      const isAccessDenied = bodyText.includes('Access Denied') || bodyText.includes('You do not have permission');
      
      let status = 'Working (Dynamic API)';
      if (isRedirected) {
        status = 'Redirected to ' + currentUrl;
      } else if (isAccessDenied) {
        status = 'Access Denied';
      } else if (apiCalls.length === 0) {
        status = 'Static / Frontend Mock';
      } else {
        const failed = apiCalls.find(a => a.status >= 400);
        if (failed) status = 'API Error: ' + failed.status;
      }

      results.push({
        module: mod.name,
        path: mod.path,
        status: status,
        apiCount: apiCalls.length,
        apiCalls: apiCalls.map(a => a.status + ' ' + a.url.replace(/.*\/api/, '/api')).slice(0, 3)
      });
    } catch (err) {
      results.push({
        module: mod.name,
        path: mod.path,
        status: 'Error: ' + err.message.slice(0, 40),
        apiCount: 0,
        apiCalls: []
      });
    } finally {
      page.off('response', onResponse);
    }
  }

  console.log(JSON.stringify(results, null, 2));

  await page.goto('http://localhost:5173/attendance', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'attendance_verified.png' });
  console.log('📸 Screenshot saved to attendance_verified.png');

  await browser.close();
}

testAllModules().catch(console.error);
