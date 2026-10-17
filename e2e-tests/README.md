# TaskFlow - Playwright End-to-End Test Suite

A modular, resilient end-to-end automation test suite built with **Playwright**, **Page Object Model (POM)**, **MySQL sync validation**, and **Multi-role RBAC**.

---

## 📁 Project Structure

```text
e2e-tests/
├── .auth/                  # Session storage state (reused across tests)
│   ├── superadmin.json
│   ├── developer.json
│   └── ...
├── fixtures/               # Authentication setups and custom test fixtures
│   └── auth.setup.js
├── pages/                  # Page Object Model (POM)
│   ├── LoginPage.js
│   ├── Sidebar.js
│   └── ...
├── tests/
│   ├── auth/               # Login, logout, redirects, protected routes
│   ├── rbac/               # Role-based visibility & route guards
│   ├── modules/            # CRUD flows per module
│   ├── hr/                 # Attendance, Leave, Breaks, Ratings
│   ├── realtime/           # Chat & notifications (Socket.io)
│   ├── db-sync/            # MongoDB to MySQL sync assertions
│   └── api/                # Direct REST API RBAC checks
├── utils/
│   └── dbHelper.js         # MySQL2 client connection & query utilities
├── playwright.config.js     # Playwright configuration
├── package.json
└── .env                    # Environment credentials & endpoints
```

---

## ⚙️ Environment Configuration (.env)

The test suite connects to the active frontend and backend:

```env
BASE_URL=http://localhost:5173
API_URL=http://localhost:5000/api
SOCKET_URL=http://localhost:5000

SUPERADMIN_EMAIL=gadanipranav@gmail.com
SUPERADMIN_PASSWORD=pranav123

OWNER_EMAIL=rahul@itcompany.com
OWNER_PASSWORD=Test@123

DEVELOPER_EMAIL=priya@itcompany.com
DEVELOPER_PASSWORD=Test@123

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=taskflow_db
```

---

## 🚀 Running Tests

Navigate to `e2e-tests`:

```powershell
cd e2e-tests
```

### 1. Run Smoke Tests
```powershell
npm run test:smoke
```

### 2. Run RBAC Suite
```powershell
npm run test:rbac
```

### 3. Run HR Module Suite
```powershell
npm run test:hr
```

### 4. Run MySQL Database Sync Suite
```powershell
npm run test:sync
```

### 5. Run All Tests
```powershell
npm test
```

### 6. Interactive UI / Headed Mode
```powershell
npm run test:ui
npm run test:headed
```

### 7. View HTML Report
```powershell
npm run report
```
