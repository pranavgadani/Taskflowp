const { pool } = require("./mysqlDb");

async function seedMySQLDefaults() {
  const permissions = [
    { id: "perm_staff", name: "Staff Management", value: "staff_management" },
    { id: "perm_task", name: "Task Management", value: "task_management" },
    { id: "perm_role", name: "Role Management", value: "role_management" },
    { id: "perm_perm", name: "Permission Management", value: "permission_management" },
    { id: "perm_status", name: "Task Status Management", value: "task_status_management" },
    { id: "perm_project", name: "Project Management", value: "project_management" },
    { id: "perm_dash", name: "View Dashboard", value: "view_dashboard" },
    { id: "perm_comp", name: "Company Management", value: "company_management" },
    { id: "perm_doc", name: "Document Management", value: "document" },
    { id: "perm_att", name: "Attendance Management", value: "attendance_management" },
    { id: "perm_leave", name: "Leave Management", value: "leave_management" },
    { id: "perm_rating", name: "Performance and Rating", value: "rating_management" },
    { id: "perm_break", name: "Break Management", value: "break_management" },
    { id: "perm_chat", name: "Team Chat", value: "chat_management" }
  ];

  for (const p of permissions) {
    await pool.query(
      "INSERT INTO permissions (id, name, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)",
      [p.id, p.name, p.value]
    );
  }

  const superAdminPerms = permissions.map(p => ({
    name: p.name,
    value: p.value,
    all: true,
    create: true,
    read: true,
    update: true,
    delete: true
  }));

  const devPerms = [
    { name: "Task Management", value: "task_management", all: false, create: false, read: true, update: true, delete: false },
    { name: "Project Management", value: "project_management", all: false, create: false, read: true, update: false, delete: false },
    { name: "View Dashboard", value: "view_dashboard", all: true, create: true, read: true, update: true, delete: true },
    { name: "Document Management", value: "document", all: false, create: false, read: true, update: false, delete: false },
    { name: "Attendance Management", value: "attendance_management", all: false, create: true, read: true, update: false, delete: false },
    { name: "Leave Management", value: "leave_management", all: false, create: true, read: true, update: false, delete: false },
    { name: "Break Management", value: "break_management", all: false, create: true, read: true, update: false, delete: false },
    { name: "Team Chat", value: "chat_management", all: true, create: true, read: true, update: true, delete: true }
  ];

  await pool.query(
    "INSERT INTO roles (id, name, status, permissions) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE permissions=VALUES(permissions)",
    ["role_superadmin", "Super Admin", "Active", JSON.stringify(superAdminPerms)]
  );

  await pool.query(
    "INSERT INTO roles (id, name, status, permissions) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE permissions=VALUES(permissions)",
    ["role_developer", "Developer", "Active", JSON.stringify(devPerms)]
  );

  await pool.query(
    "INSERT INTO roles (id, name, status, permissions) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE permissions=VALUES(permissions)",
    ["role_owner", "Company Owner", "Active", JSON.stringify(superAdminPerms)]
  );

  await pool.query(
    "INSERT INTO roles (id, name, status, permissions) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE permissions=VALUES(permissions)",
    ["role_staff", "Staff", "Active", JSON.stringify(devPerms)]
  );

  const statuses = ["Active", "In Progress", "Complete", "Pending", "Incomplete"];
  for (let i = 0; i < statuses.length; i++) {
    await pool.query(
      "INSERT INTO task_statuses (id, name, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)",
      [`status_${i + 1}`, statuses[i], "Active"]
    );
  }

  const defaultCompany = {
    _id: "default_company",
    companyName: "TaskFlow Technologies",
    email: "info@taskflow.com",
    phone: "9876543210",
    addressLine1: "Tech Hub, 4th Floor",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    pincode: "380015",
    workingHours: {
      startTime: "09:30",
      endTime: "18:30"
    },
    breakTime: {
      lunchBreak: 40,
      teaBreak: 20
    },
    policies: []
  };

  await pool.query(
    "INSERT INTO collections (collection_name, _id, data) VALUES ('companies', ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)",
    [defaultCompany._id, JSON.stringify(defaultCompany)]
  );

  console.log("✅ Seeded permissions, roles, task_statuses, and company into MySQL taskflow_db");
}

module.exports = seedMySQLDefaults;
