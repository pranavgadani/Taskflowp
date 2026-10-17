const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { pool } = require("./config/mysqlDb");

const Staff = require("./models/Staff");
const Project = require("./models/Project");
const Task = require("./models/Task");
const Role = require("./models/Role");
const TaskStatus = require("./models/TaskStatus");
const Company = require("./models/Company");

async function seedDummyData() {
  try {
    console.log("🌱 Starting Clean Seeding: 2 Projects & 5 Developers...");

    // 1. Roles & Default Company
    const initialPolicies = [
      {
        title: "Workplace Attendance & Daily Timesheet Policy",
        category: "Leave & Attendance",
        summary: "Mandatory working hours (9:00 AM - 6:00 PM), daily shift clock-in, and compulsory 8.00 hrs timesheet submission.",
        content: "1. Working Hours: Standard working hours are Monday to Friday, 9:00 AM to 6:00 PM with a 1-hour lunch break (1:00 PM to 2:00 PM).\n2. Shift Clock-in: All employees must clock in through TaskFlow upon arrival and clock out at departure.\n3. Daily Timesheet: Every engineer must log exact project, task, and subtask hours daily. Minimum 8.00 billable/project hours must be logged and submitted before 7:00 PM.\n4. Missed Timesheets: Timesheets not submitted on the same day will trigger an automated reminder to the reporting manager.",
        effectiveDate: new Date("2026-01-01"),
        status: "Active",
        updatedBy: "Super Admin",
        updatedAt: new Date()
      },
      {
        title: "Leave Management, Short Leave & Holidays",
        category: "Leave & Attendance",
        summary: "Annual leave quotas: 12 Casual Leaves, 8 Sick Leaves, 15 Privilege Leaves, and 2-hour Short Leaves protocol.",
        content: "1. Annual Quotas: Employees are entitled to 12 CL (Casual Leaves), 8 SL (Sick Leaves), and 15 PL (Privilege/Earned Leaves) per calendar year.\n2. Prior Notice: Planned leaves must be applied at least 48 hours in advance via the Leave module.\n3. Medical Certificate: Sick leaves exceeding 2 consecutive days require a valid medical certificate from a registered practitioner.\n4. Short Leaves: Maximum of 2 short leaves (up to 2 hours each) can be availed in a calendar month with manager approval.",
        effectiveDate: new Date("2026-01-01"),
        status: "Active",
        updatedBy: "Super Admin",
        updatedAt: new Date()
      },
      {
        title: "Information Security, Source Code & Data Protection",
        category: "IT & Security",
        summary: "Strict zero-leakage policy for source code, API keys, client databases, and credentials.",
        content: "1. Confidentiality: All source code, Git repositories, architecture diagrams, and client credentials are proprietary company assets.\n2. Device Security: Company laptops must have full-disk encryption and screen lock timeout set to 5 minutes.\n3. Prohibited Actions: Uploading proprietary code to public repositories, personal cloud drives, or unapproved AI platforms is strictly prohibited.\n4. Password Hygiene: Passwords must be updated quarterly, and Two-Factor Authentication (2FA) is mandatory across all work accounts.",
        effectiveDate: new Date("2026-01-01"),
        status: "Active",
        updatedBy: "Super Admin",
        updatedAt: new Date()
      },
      {
        title: "Code of Conduct & Professional Workplace Standards",
        category: "Code of Conduct",
        summary: "Zero-tolerance for harassment or discrimination, peer review etiquette, and client communication ethics.",
        content: "1. Mutual Respect: We maintain an inclusive, collaborative environment with zero tolerance for harassment, discrimination, or abusive behavior.\n2. Transparent Communication: Technical discussions and sprint blockers must be communicated openly in official Team Chat channels.\n3. Code Reviews: Peer reviews must be constructive, focused on code quality, security, and performance standards.",
        effectiveDate: new Date("2026-01-01"),
        status: "Active",
        updatedBy: "Super Admin",
        updatedAt: new Date()
      }
    ];

    let defaultCompany = await Company.findOne({ email: "info@itcompany.com" });
    if (!defaultCompany) {
      defaultCompany = await Company.create({
        companyName: "Padhya Soft",
        email: "info@itcompany.com",
        contactPersonName: "Super Admin",
        contactPersonEmail: "gadanipranav@gmail.com",
        contactPersonPhone: "9876543210",
        addressLine1: "101, Tech Park, SG Highway",
        city: "Ahmedabad",
        state: "Gujarat",
        pincode: "380054",
        policies: initialPolicies
      });
      console.log("✅ Default IT Company Created:", defaultCompany.companyName);
    } else {
      defaultCompany.companyName = "Padhya Soft";
      defaultCompany.policies = initialPolicies;
      await defaultCompany.save();
      console.log("✅ Default Company Updated:", defaultCompany.companyName);
    }

    const devPermissions = [
      { name: "Task Management", value: "task_management", all: false, create: false, read: true, update: true, delete: false },
      { name: "Issue Management", value: "issue", all: false, create: false, read: true, update: true, delete: false },
      { name: "Project Management", value: "project_management", all: false, create: false, read: true, update: false, delete: false },
      { name: "View Dashboard", value: "view_dashboard", all: true, create: true, read: true, update: true, delete: true },
      { name: "Document Management", value: "document", all: false, create: false, read: true, update: false, delete: false }
    ];

    let devRole = await Role.findOne({ name: "Developer" });
    if (!devRole) {
      devRole = await Role.create({ name: "Developer", status: "Active", companyId: defaultCompany._id, permissions: devPermissions });
    } else {
      devRole.permissions = devPermissions;
      await devRole.save();
    }

    // 2. 5 Dummy Developers
    const passwordHash = await bcrypt.hash("Test@123", 10);
    const developersData = [
      { name: "Rahul Sharma", email: "rahul@itcompany.com", position: "Senior Backend Developer", role: devRole._id, phone: "9876543210" },
      { name: "Priya Patel", email: "priya@itcompany.com", position: "Frontend React Developer", role: devRole._id, phone: "9876543211" },
      { name: "Amit Verma", email: "amit@itcompany.com", position: "Full Stack Developer", role: devRole._id, phone: "9876543212" },
      { name: "Sneha Mehta", email: "sneha@itcompany.com", position: "UI/UX & Frontend Developer", role: devRole._id, phone: "9876543213" },
      { name: "Vikram Singh", email: "vikram@itcompany.com", position: "Cloud & Backend Developer", role: devRole._id, phone: "9876543214" }
    ];

    const createdUsers = [];
    for (const u of developersData) {
      let user = await Staff.findOne({ email: u.email });
      if (!user) {
        user = await Staff.create({
          name: u.name,
          email: u.email,
          password: passwordHash,
          role: u.role,
          position: u.position,
          phone: u.phone,
          status: "Active",
          companyId: defaultCompany._id
        });
      } else {
        user.password = passwordHash;
        user.role = devRole._id;
        user.position = u.position;
        user.companyId = defaultCompany._id;
        await user.save();
      }
      createdUsers.push(user);

      // Seed MySQL staff table
      await pool.query(
        `INSERT INTO staff (id, name, email, password, role, position, status, phone, company_id)
         VALUES (?, ?, ?, ?, 'Developer', ?, 'Active', ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), position=VALUES(position), role='Developer', company_id=VALUES(company_id)`,
        [user._id.toString(), u.name, u.email, passwordHash, u.position, u.phone, defaultCompany._id.toString()]
      );

      // Initialize leave balance for user
      await pool.query(
        `INSERT INTO leave_balances (id, user_id, user_name, user_email, cl_balance, sl_balance, pl_balance, comp_off)
         VALUES (?, ?, ?, ?, 12, 8, 15, 2)
         ON DUPLICATE KEY UPDATE user_name=VALUES(user_name), user_email=VALUES(user_email)`,
        [`bal_${user._id}`, user._id.toString(), u.name, u.email]
      );
    }
    console.log("✅ 5 Developers created with Leave balances");

    // 3. CLEAN OLD PROJECTS & CREATE EXACTLY 2 PROJECTS
    await Project.deleteMany({});
    await pool.query("DELETE FROM projects");
    await Task.deleteMany({});
    await pool.query("DELETE FROM timesheets");
    try { await pool.query("DELETE FROM test_cases"); } catch (e) {}
    try { await pool.query("DELETE FROM qa_bugs"); } catch (e) {}

    const assignedStaffList = JSON.stringify(
      createdUsers.map(u => ({ _id: u._id.toString(), id: u._id.toString(), name: u.name, email: u.email }))
    );

    const projectsData = [
      {
        name: "FinTech Mobile Banking App",
        description: "iOS and Android mobile application for digital payments, micro-loans and UPI instant transfer.",
        status: "Active"
      },
      {
        name: "E-Commerce Multi-Vendor Hub",
        description: "Scalable B2B wholesale portal with Stripe payment, warehouse inventory and order tracking.",
        status: "Active"
      }
    ];

    const createdProjects = [];
    for (const p of projectsData) {
      const project = await Project.create({
        name: p.name,
        description: p.description,
        status: p.status,
        companyId: defaultCompany._id,
        assignedTo: createdUsers.map(u => u._id)
      });
      createdProjects.push(project);

      await pool.query(
        `INSERT INTO projects (id, name, description, status, assigned_to)
         VALUES (?, ?, ?, 'Active', ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), assigned_to=VALUES(assigned_to)`,
        [project._id.toString(), p.name, p.description, assignedStaffList]
      );
    }
    console.log("✅ Exactly 2 IT Projects created with all 5 Developers assigned in MySQL & Mongo");

    // 4. Default Statuses
    let statusInProgress = await TaskStatus.findOne({ name: /In Progress/i });
    if (!statusInProgress) statusInProgress = await TaskStatus.create({ name: "In Progress", status: "Active", companyId: defaultCompany._id });
    let statusComplete = await TaskStatus.findOne({ name: /Complete/i });
    if (!statusComplete) statusComplete = await TaskStatus.create({ name: "Complete", status: "Active", companyId: defaultCompany._id });
    let statusPending = await TaskStatus.findOne({ name: /Pending/i });
    if (!statusPending) statusPending = await TaskStatus.create({ name: "Pending", status: "Active", companyId: defaultCompany._id });

    // 5. Tasks for the 2 Projects
    const now = new Date();
    const dMinus5 = new Date(now.getTime() - 5 * 86400000);
    const dMinus3 = new Date(now.getTime() - 3 * 86400000);
    const dMinus2 = new Date(now.getTime() - 2 * 86400000);
    const dMinus1 = new Date(now.getTime() - 1 * 86400000);
    const dPlus2 = new Date(now.getTime() + 2 * 86400000);
    const dPlus4 = new Date(now.getTime() + 4 * 86400000);
    const dPlus6 = new Date(now.getTime() + 6 * 86400000);

    const tasksData = [
      // Project 1 Tasks (FinTech)
      {
        title: "Implement OAuth2 Social Google/Apple Sign-in",
        priority: "High",
        project: createdProjects[0]._id,
        assignedTo: createdUsers[0]._id, // Rahul
        status: statusInProgress._id,
        companyId: defaultCompany._id,
        startDate: dMinus3,
        endDate: dPlus4,
        subtasks: [
          { title: "Setup Google OAuth credentials & Consent screen", status: "Complete", startDate: dMinus3, endDate: dMinus2, hours: 4.5 },
          { title: "Implement Apple ID private key sign-in endpoint", status: "In Process", startDate: dMinus1, endDate: dPlus2, hours: 3.5 },
          { title: "Frontend JWT refresh token persistence & auto-login", status: "Pending", startDate: dPlus2, endDate: dPlus4, hours: 0 }
        ]
      },
      {
        title: "Biometric FaceID & Secure Keychain Vault",
        priority: "Critical",
        project: createdProjects[0]._id,
        assignedTo: createdUsers[2]._id, // Amit
        status: statusInProgress._id,
        companyId: defaultCompany._id,
        startDate: dMinus2,
        endDate: dPlus4,
        subtasks: [
          { title: "Android BiometricPrompt API hardware crypto check", status: "Complete", startDate: dMinus2, endDate: dMinus1, hours: 4.0 },
          { title: "iOS LocalAuthentication biometric fallback dialog", status: "In Process", startDate: now, endDate: dPlus2, hours: 3.5 },
          { title: "Secure enclaved private key rotation mechanism", status: "Pending", startDate: dPlus2, endDate: dPlus4, hours: 0 }
        ]
      },
      // Project 2 Tasks (E-Commerce)
      {
        title: "Design Responsive Checkout & Cart Wireframes",
        priority: "Medium",
        project: createdProjects[1]._id,
        assignedTo: createdUsers[3]._id, // Sneha
        status: statusComplete._id,
        companyId: defaultCompany._id,
        startDate: dMinus5,
        endDate: dPlus2,
        subtasks: [
          { title: "Figma UI prototype for Desktop checkout flow", status: "Complete", startDate: dMinus5, endDate: dMinus3, hours: 6.0 },
          { title: "Mobile drawer cart layout & swipe-to-delete", status: "In Process", startDate: dMinus2, endDate: now, hours: 4.0 },
          { title: "Stripe element form layout & error validation states", status: "Pending", startDate: now, endDate: dPlus2, hours: 0 }
        ]
      },
      {
        title: "Build Product Inventory & Order Status Webhooks",
        priority: "High",
        project: createdProjects[1]._id,
        assignedTo: createdUsers[1]._id, // Priya
        status: statusInProgress._id,
        companyId: defaultCompany._id,
        startDate: dMinus2,
        endDate: dPlus4,
        subtasks: [
          { title: "Stripe webhook payment_intent.succeeded listener", status: "Complete", startDate: dMinus2, endDate: dMinus1, hours: 5.0 },
          { title: "Low stock notification email & push alert dispatch", status: "In Process", startDate: now, endDate: dPlus2, hours: 3.0 },
          { title: "Order shipment tracking URL sync with carrier API", status: "Pending", startDate: dPlus2, endDate: dPlus4, hours: 0 }
        ]
      },
      {
        title: "Kubernetes Cluster Deployment & Redis Cache Layer",
        priority: "Critical",
        project: createdProjects[1]._id,
        assignedTo: createdUsers[4]._id, // Vikram
        status: statusPending._id,
        companyId: defaultCompany._id,
        startDate: dMinus1,
        endDate: dPlus6,
        subtasks: [
          { title: "Helm chart configuration for E-Commerce API pods", status: "In Process", startDate: dMinus1, endDate: dPlus2, hours: 4.5 },
          { title: "Redis cluster setup for session & cart store", status: "Complete", startDate: dMinus3, endDate: dMinus1, hours: 3.5 }
        ]
      }
    ];

    const createdTasks = [];
    for (const t of tasksData) {
      const task = await Task.create(t);
      createdTasks.push(task);
    }
    console.log("✅ Tasks created for 2 projects with Subtasks & Dates");

    // 6. QA Test Cases
    const testCases = [
      {
        id: "TC-101",
        title: "Verify Google OAuth Callback Redirects to Dashboard",
        project_id: createdProjects[0]._id.toString(),
        module: "Authentication",
        type: "Functional",
        priority: "High",
        steps: "1. Click Google Sign-in\n2. Authorize account\n3. Verify redirect to /dashboard",
        expected_result: "User is authenticated and redirected with valid JWT",
        status: "Pass",
        tested_by: "Rahul Sharma",
        notes: "Passed on Chrome and Safari iOS"
      },
      {
        id: "TC-102",
        title: "Verify Checkout Cart Total Matches Discount Voucher",
        project_id: createdProjects[1]._id.toString(),
        module: "Checkout",
        type: "Functional",
        priority: "Critical",
        steps: "1. Add item to cart\n2. Apply coupon SAVE20\n3. Check total",
        expected_result: "Cart total reduced by exactly 20%",
        status: "Pass",
        tested_by: "Priya Patel",
        notes: "Validated with multiple tax rates"
      }
    ];

    for (const tc of testCases) {
      await pool.query(
        `INSERT INTO test_cases (id, title, project_id, project_name, module_name, steps, expected_result, status, severity, created_by)
         VALUES (?, ?, ?, 'FinTech Mobile Banking App', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), status=VALUES(status)`,
        [tc.id, tc.title, tc.project_id, tc.module, tc.steps, tc.expected_result, tc.status, tc.priority, tc.tested_by]
      );
    }
    console.log("✅ QA Test Cases created");

    // 7. QA Bugs
    const sampleBugs = [
      {
        id: "BUG-201",
        title: "Safari iOS Cart Drawer Overflow scroll glitch",
        project_id: createdProjects[1]._id.toString(),
        severity: "Medium",
        priority: "Medium",
        assigned_to: createdUsers[3]._id.toString(),
        status: "In Progress",
        description: "On iOS WebKit, swiping inside the cart drawer triggers page reload."
      }
    ];

    for (const b of sampleBugs) {
      await pool.query(
        `INSERT INTO qa_bugs (id, title, project_id, project_name, severity, assigned_to, status, description, environment)
         VALUES (?, ?, ?, 'E-Commerce Multi-Vendor Hub', ?, ?, ?, ?, 'Staging')
         ON DUPLICATE KEY UPDATE title=VALUES(title), status=VALUES(status)`,
        [b.id, b.title, b.project_id, b.severity, b.assigned_to, b.status, b.description]
      );
    }
    console.log("✅ QA Bugs created");

    // 8. Seed Attendance for today only if not already present
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < createdUsers.length; i++) {
      const u = createdUsers[i];
      const [existingAtt] = await pool.query(
        "SELECT id FROM attendance WHERE (user_id = ? OR user_email = ?) AND date = ?",
        [u._id.toString(), u.email, todayStr]
      );
      if (existingAtt.length === 0) {
        const clockIn = new Date();
        clockIn.setHours(9, 30 + i * 5, 0);
        const clockOut = new Date();
        clockOut.setHours(18, 30, 0);

        await pool.query(
          `INSERT INTO attendance (id, user_id, user_name, user_email, date, clock_in, clock_out, work_mode, total_hours, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Office', 8.5, 'Present')
           ON DUPLICATE KEY UPDATE total_hours=VALUES(total_hours)`,
          [`att_seed_${u._id}`, u._id.toString(), u.name, u.email, todayStr, clockIn, clockOut]
        );
      }
    }
    console.log("✅ Attendance checked/seeded for employees");

    // 9. Seed Sample Daily Timesheets for the 2 Projects
    const sampleTimesheets = [
      {
        user: createdUsers[0], // Rahul
        project: createdProjects[0],
        task: createdTasks[0],
        subtaskTitle: "Setup Google OAuth credentials & Consent screen",
        hours: 4.5,
        taskStatus: "Complete",
        desc: "Configured Google Console client credentials and JWT callback validation."
      },
      {
        user: createdUsers[0], // Rahul
        project: createdProjects[0],
        task: createdTasks[0],
        subtaskTitle: "Implement Apple ID private key sign-in endpoint",
        hours: 3.5,
        taskStatus: "In Process",
        desc: "Integrated Apple token endpoint and verified p8 private key signature."
      },
      {
        user: createdUsers[1], // Priya
        project: createdProjects[1],
        task: createdTasks[3],
        subtaskTitle: "Stripe webhook payment_intent.succeeded listener",
        hours: 8.0,
        taskStatus: "Complete",
        desc: "Implemented Stripe webhook idempotency check and database order update."
      },
      {
        user: createdUsers[2], // Amit
        project: createdProjects[0],
        task: createdTasks[1],
        subtaskTitle: "Android BiometricPrompt API hardware crypto check",
        hours: 8.0,
        taskStatus: "In Process",
        desc: "Tested biometric prompt and cryptographic signature generation."
      },
      {
        user: createdUsers[3], // Sneha
        project: createdProjects[1],
        task: createdTasks[2],
        subtaskTitle: "Figma UI prototype for Desktop checkout flow",
        hours: 8.0,
        taskStatus: "Complete",
        desc: "Designed checkout summary card, promo code pill and payment option radios in Figma."
      },
      {
        user: createdUsers[4], // Vikram
        project: createdProjects[1],
        task: createdTasks[4],
        subtaskTitle: "Redis cluster setup for session & cart store",
        hours: 8.0,
        taskStatus: "Complete",
        desc: "Configured Redis cluster master-replica replication and sentinel failover."
      }
    ];

    for (let idx = 0; idx < sampleTimesheets.length; idx++) {
      const ts = sampleTimesheets[idx];
      const taskId = ts.task?._id?.toString() || null;
      const taskTitle = ts.task?.title || "Project Development";
      const subtaskId = ts.task?.subtasks?.[0]?._id?.toString() || null;

      await pool.query(
        `INSERT INTO timesheets (id, user_id, user_name, user_email, project_id, project_name, task_id, task_title, subtask_id, subtask_title, date, hours, description, is_billable, task_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'Submitted')
         ON DUPLICATE KEY UPDATE hours=VALUES(hours), description=VALUES(description), subtask_title=VALUES(subtask_title), task_status=VALUES(task_status)`,
        [`ts_seed_${idx}`, ts.user._id.toString(), ts.user.name, ts.user.email, ts.project._id.toString(), ts.project.name, taskId, taskTitle, subtaskId, ts.subtaskTitle, todayStr, ts.hours, ts.desc, ts.taskStatus]
      );
    }
    console.log("✅ Timesheets seeded for employees with subtasks and task_status");

    console.log("🎉 ALL DUMMY DATA SEEDED SUCCESSFULLY! (2 Projects, 5 Developers)");
    return true;
  } catch (err) {
    console.error("❌ Seeding Error:", err);
    return false;
  }
}

if (require.main === module) {
  seedDummyData().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = seedDummyData;
