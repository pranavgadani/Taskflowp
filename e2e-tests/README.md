# TaskFlow — Playwright E2E Test Suite (Senior QA Grade)

A **production-grade**, modular end-to-end automation suite for TaskFlow built with **Playwright**, following **Page Object Model (POM)**, **MySQL sync validation**, and **Multi-role RBAC** testing patterns.

---

## 📁 Project Structure

```text
e2e-tests/
├── .auth/                      # Saved session states (reused across tests)
│   ├── superadmin.json
│   └── developer.json
├── fixtures/
│   └── auth.setup.js           # Creates .auth session files before all tests
├── pages/                      # Page Object Model (POM) classes
│   ├── LoginPage.js
│   ├── Sidebar.js
│   ├── AttendancePage.js
│   ├── TaskPage.js
│   └── LeavePage.js
├── tests/
│   ├── auth/                   # TC-AUTH-001 to TC-AUTH-010 (10 tests)
│   │   └── auth.spec.js
│   ├── rbac/                   # TC-RBAC-001 to TC-RBAC-019 (19 tests)
│   │   └── rbac.spec.js
│   ├── hr/                     # TC-HR-001 to TC-HR-016 (16 tests)
│   │   └── hr.spec.js
│   ├── modules/                # TC-MOD-001 to TC-MOD-025 (25 tests)
│   │   └── modules.spec.js
│   ├── api/                    # TC-API-001 to TC-API-020 (20 tests)
│   │   └── api.spec.js
│   ├── db-sync/                # TC-SYNC-001 to TC-SYNC-018 (18 tests)
│   │   └── db-sync.spec.js
│   └── realtime/               # TC-RT-001 to TC-RT-008 (8 tests)
│       └── realtime.spec.js
├── utils/
│   └── dbHelper.js             # MySQL2 query helper
├── playwright.config.js
├── package.json
├── .env                        # Credentials & URLs (never commit!)
└── README.md
```

**Total: 116 test cases across 7 suites**

---

## ⚙️ Environment Configuration (`.env`)

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

CUSTOM_EMAIL=amit@itcompany.com
CUSTOM_PASSWORD=Test@123

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=taskflow_db
```

---

## 🚀 Prerequisites

1. **Frontend running**: `npm run dev` in `Task-Flow-frontend-main/` (port 5173)
2. **Backend running**: `node backend/server.js` in `task-flow-backend-main/` (port 5000)
3. **MySQL running**: with `taskflow_db` seeded
4. **Install Playwright**: `npm install && npx playwright install`

---

## 🏃 Running Tests

Navigate to `e2e-tests/`:

### Phase 1: Generate Auth Sessions (REQUIRED first run)
```powershell
npm run setup
```

### Run Individual Suites
```powershell
npm run test:smoke      # @smoke — Landing page, branding
npm run test:auth       # @auth — Login, logout, redirects (10 tests)
npm run test:rbac       # @rbac — Role-based access control (19 tests)
npm run test:hr         # @hr   — Attendance, Leave, Breaks, Rating (16 tests)
npm run test:modules    # @modules — All UI module CRUD flows (25 tests)
npm run test:api        # @api  — Direct REST API RBAC tests (20 tests)
npm run test:sync       # @sync — MySQL DB schema & sync checks (18 tests)
npm run test:realtime   # @realtime — Chat & Socket.io (8 tests)
```

### Run All Tests
```powershell
npm test
```

### Interactive / Debug Mode
```powershell
npm run test:ui      # Playwright UI mode (visual test runner)
npm run test:headed  # Headed browser mode
npm run test:debug   # Step-by-step debug mode
```

### View HTML Report
```powershell
npm run report
```

---

## 🧪 Test Suite Overview

| Suite | Tag | Tests | What It Covers |
|-------|-----|-------|----------------|
| Authentication | `@auth` | 10 | Login, logout, redirects, branding, invalid creds |
| RBAC | `@rbac` | 19 | Super Admin access, Developer restrictions, route guards |
| HR Modules | `@hr` | 16 | Attendance (clock in/out, shifts), Leave, Breaks, Timesheet, Rating |
| Module CRUD | `@modules` | 25 | Dashboard, Project, Task, Staff, Role, Document, QA, Tickets, Chat |
| API Tests | `@api` | 20 | REST endpoint auth, RBAC enforcement, response codes |
| DB Sync | `@sync` | 18 | MySQL schema integrity, seeded data, UI↔DB consistency |
| Real-Time | `@realtime` | 8 | Chat page, Socket.io, toast system, JS error detection |
| **TOTAL** | | **116** | |

---

## 🔐 RBAC Matrix

| Route | Super Admin | Company Owner | Developer |
|-------|-------------|--------------|-----------|
| `/staff` | ✅ | ✅ | ❌ → `/` |
| `/role` | ✅ | ❌ → `/` | ❌ → `/` |
| `/permission` | ✅ | ❌ → `/` | ❌ → `/` |
| `/task` | ✅ | ✅ | ✅ |
| `/leave` | ✅ | ✅ | ✅ |
| `/clients` | ✅ | ✅ | ❌ → `/` |
| `/attendance` | ✅ | ✅ | ✅ |
| `/chat` | ✅ | ✅ | ✅ |
| `/profile` | ✅ | ✅ | ✅ |

---

## 📊 2nd & 4th Saturday Holiday Rule (Business Logic Tests)

The company policy states **2nd and 4th Saturdays are company holidays**. These are validated in:
- `TC-HR-005` — Shift cards render Saturday with off-day indication  
- `TC-SYNC-007` — Work schedules table exists and is queryable  
- `TC-SYNC-016` — Work schedules in MySQL sync with Attendance page UI

---

## 🛡️ Test Naming Convention

```
TC-{SUITE}-{NNN} · {Short description}
```

Example: `TC-RBAC-009 · Developer is redirected away from /role`
