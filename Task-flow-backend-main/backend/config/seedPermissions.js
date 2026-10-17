const Permission = require("../models/Permission");
const TaskStatus = require("../models/TaskStatus");
const Subscription = require("../models/Subscription");

module.exports = async function seedDefaults() {
  try {
    // 1. Seed Permissions
    const permissions = [
      { name: "Staff Management", value: "staff_management" },
      { name: "Task Management", value: "task_management" },
      { name: "Role Management", value: "role_management" },
      { name: "Permission Management", value: "permission_management" },
      { name: "Task Status Management", value: "task_status_management" },
      { name: "Project Management", value: "project_management" },
      { name: "View Dashboard", value: "view_dashboard" },
      { name: "Company Management", value: "company_management" },
      { name: "Issue Management", value: "issue" },
      { name: "Document Management", value: "document" },
      { name: "Attendance Management", value: "attendance_management" },
      { name: "Leave Management", value: "leave_management" },
      { name: "Performance and Rating", value: "rating_management" },
      { name: "Break Management", value: "break_management" },
      { name: "Team Chat", value: "chat_management" },
    ];

    for (const perm of permissions) {
      if (!(await Permission.findOne({ value: perm.value }))) {
        await Permission.create(perm);
        console.log(`✅ Created permission: ${perm.name}`);
      }
    }

    // 2. Seed Default Task Statuses (Global)
    const defaultStatuses = ["Complete", "Incomplete", "Pending"];
    for (const statusName of defaultStatuses) {
      const exists = await TaskStatus.findOne({
        name: new RegExp(`^${statusName}$`, "i"),
        project: null
      });
      if (!exists) {
        await TaskStatus.create({ name: statusName, status: "Active", project: null });
        console.log(`✅ Created global status: ${statusName}`);
      }
    }

    // 3. Seed Default Subscription Plans
    const plans = [
      { name: "Free", price: 0, billingCycle: "monthly", maxStaff: 5, maxProjects: 1, maxTasks: 25, maxDocuments: 10, maxStatuses: 5, maxIssues: 10 },
      { name: "Quarterly", price: 44, billingCycle: "quarterly", maxStaff: 50, maxProjects: 1, maxTasks: 250, maxDocuments: 100, maxStatuses: 50, maxIssues: 100 },
      { name: "Yearly", price: 96, billingCycle: "yearly", maxStaff: -1, maxProjects: -1, maxTasks: -1, maxDocuments: -1, maxStatuses: -1, maxIssues: -1 }
    ];

    for (const plan of plans) {
      if (!(await Subscription.findOne({ name: plan.name, billingCycle: plan.billingCycle }))) {
        await Subscription.create(plan);
        console.log(`✅ Created plan: ${plan.name}`);
      }
    }

    console.log("✅ Defaults seeding completed");
  } catch (err) {
    console.log("❌ Error seeding defaults:", err);
  }
};
