const { chromium } = require('playwright');

async function testAllModules() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('🚀 Step 1: Navigating to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

  // Open Sign in modal if needed or fill form
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  if (!await emailInput.isVisible()) {
    console.log('Clicking Sign In button to open modal...');
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);
  }

  console.log('🔑 Step 2: Logging in as Priya Patel (priya@itcompany.com)...');
  await emailInput.fill('priya@itcompany.com');
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill('Test@123');

  await page.click('button[type="submit"], button:has-text("Sign In")');
  await page.waitForTimeout(2000);

  console.log('📍 Current URL after login:', page.url());

  const modulesToTest = [
    { name: 'Attendance Management', path: '/attendance', apiCheck: '/api/attendance' },
    { name: 'Dashboard', path: '/', apiCheck: null },
    { name: 'Projects', path: '/project', apiCheck: '/api/projects' },
    { name: 'Tasks', path: '/task', apiCheck: '/api/tasks' },
    { name: 'Timesheets', path: '/timesheet', apiCheck: '/api/timesheets' },
    { name: 'Issues', path: '/issue', apiCheck: '/api/tasks' },
    { name: 'Task Status', path: '/task-status', apiCheck: '/api/task-status' },
    { name: 'Team', path: '/team', apiCheck: '/api/projects' },
    { name: 'Documents', path: '/document', apiCheck: '/api/documents' },
    { name: 'QA & Testing', path: '/qa', apiCheck: '/api/qa' },
    { name: 'Staff', path: '/staff', apiCheck: '/api/staff' },
    { name: 'Role', path: '/role', apiCheck: '/api/roles' },
    { name: 'Permission', path: '/permission', apiCheck: '/api/permissions' },
    { name: 'Leave & Absence', path: '/leave', apiCheck: '/api/leave' },
    { name: 'Performance & Rating', path: '/rating', apiCheck: '/api/ratings' },
    { name: 'Break Management', path: '/breaks', apiCheck: '/api/breaks' },
    { name: 'Team Chat', path: '/chat', apiCheck: '/api/chat' },
    { name: 'Company Policies', path: '/profile?tab=policies', apiCheck: '/api/companies' }
  ];

  console.log('\n================ MODULE CHECK REPORT ================');
  const results = [];

  for (const mod of modulesToTest) {
    let apiStatus = 'Static / Frontend-Only';
    let apiCalls = [];

    // Setup network listener for this page visit
    const onResponse = (response) => {
      const url = response.url();
      if (url.includes('/api/') && !url.includes('/user-permissions') && !url.includes('/auth/me')) {
        apiCalls.push({ url, status: response.status() });
      }
    };
    page.on('response', onResponse);

    try {
      await page.goto(`http://localhost:5173${mod.path}`, { waitUntil: 'networkidle', timeout: 8000 });
      await page.waitForTimeout(600);

      const currentUrl = page.url();
      const pageTitle = await page.title();
      const bodyText = await page.locator('body').innerText();
      
      const isRedirected = !currentUrl.includes(mod.path.split('?')[0]) && mod.path !== '/';
      const isAccessDenied = bodyText.includes('Access Denied') || bodyText.includes('You do not have permission');
      
      let status = 'Working (Dynamic)';
      if (isRedirected || isAccessDenied) {
        status = isRedirected ? `Redirected to ${currentUrl}` : 'Access Denied';
      } else if (apiCalls.length === 0 && mod.apiCheck) {
        status = 'Loaded (No API calls triggered / Static)';
      } else if (apiCalls.length > 0) {
        const failedApi = apiCalls.find(a => a.status >= 400);
        if (failedApi) {
          status = `API Error: ${failedApi.status} on ${failedApi.url}`;
        }
      }

      results.push({
        module: mod.name,
        path: mod.path,
        url: currentUrl,
        status,
        apiCount: apiCalls.length,
        sampleApis: apiCalls.map(a => `${a.status} ${a.url.replace('http://localhost:5000/api', '')}`).slice(0, 3)
      });
    } catch (err) {
      results.push({
        module: mod.name,
        path: mod.path,
        url: page.url(),
        status: `Error: ${err.message.slice(0, 50)}`,
        apiCount: apiCalls.length,
        sampleApis: []
      });
    } finally {
      page.off('response', onResponse);
    }
  }

  console.log(JSON.stringify(results, null, 2));

  // Screenshot Attendance module specifically
  await page.goto('http://localhost:5173/attendance', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'attendance_verified.png' });
  console.log('📸 Attendance screenshot saved to attendance_verified.png');

  await browser.close();
}

testAllModules().catch(console.error);
