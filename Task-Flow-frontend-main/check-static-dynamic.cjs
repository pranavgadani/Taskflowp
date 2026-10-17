const { chromium } = require('playwright');

async function checkModulesStaticVsDynamic() {
  // 1. Get auth token via direct API call first
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya@itcompany.com', password: 'Test@123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const user = loginData.user;

  console.log('✅ Logged in via API:', user.name, '| Role:', user.role?.name);

  // 2. Launch browser with token pre-set in localStorage / cookies
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  
  // Set token cookie & local storage
  await context.addCookies([
    {
      name: 'token',
      value: token,
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();
  
  // Navigate to root to set localStorage
  await page.goto('http://localhost:5173/login');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token, user });

  console.log('🚀 Loading application with authenticated session...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const modules = [
    { name: 'Dashboard', path: '/' },
    { name: 'Attendance Management', path: '/attendance' },
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

  console.log('\n================ DATA SOURCE ANALYSIS (STATIC vs DYNAMIC) ================');
  const report = [];

  for (const mod of modules) {
    const apiCalls = [];
    const responseHandler = (res) => {
      const url = res.url();
      if (url.includes('/api/') && !url.includes('/user-permissions') && !url.includes('/auth/me')) {
        apiCalls.push({
          url: url.replace(/.*\/api/, '/api'),
          status: res.status()
        });
      }
    };

    page.on('response', responseHandler);

    try {
      await page.goto('http://localhost:5173' + mod.path, { waitUntil: 'networkidle', timeout: 7000 });
      await page.waitForTimeout(800);

      const currentUrl = page.url();
      const bodyText = await page.locator('body').innerText();

      const isRedirected = !currentUrl.includes(mod.path.split('?')[0]) && mod.path !== '/';
      const isAccessDenied = bodyText.includes('Access Denied');

      let nature = 'Dynamic (Connected to MongoDB & MySQL)';
      if (isRedirected) {
        nature = `Redirected to ${currentUrl}`;
      } else if (isAccessDenied) {
        nature = 'Access Denied (Permission Missing)';
      } else if (apiCalls.length === 0) {
        nature = 'Static / Hardcoded (No API calls)';
      }

      report.push({
        module: mod.name,
        path: mod.path,
        nature: nature,
        apiCount: apiCalls.length,
        endpoints: [...new Set(apiCalls.map(a => `${a.status} ${a.url}`))].slice(0, 4)
      });
    } catch (e) {
      report.push({
        module: mod.name,
        path: mod.path,
        nature: 'Timeout / Error: ' + e.message.slice(0, 40),
        apiCount: 0,
        endpoints: []
      });
    } finally {
      page.off('response', responseHandler);
    }
  }

  console.log(JSON.stringify(report, null, 2));

  // Take screenshot of attendance page
  await page.goto('http://localhost:5173/attendance', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'attendance_page_live.png', fullPage: true });
  console.log('\n📸 Attendance full-page screenshot saved as attendance_page_live.png');

  await browser.close();
}

checkModulesStaticVsDynamic().catch(console.error);
