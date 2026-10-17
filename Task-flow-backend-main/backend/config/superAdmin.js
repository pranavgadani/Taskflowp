const Staff = require("../models/Staff");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const bcrypt = require("bcryptjs");

module.exports = async function createSuperAdmin() {
  try {
    const email = "gadanipranav@gmail.com";

    const exist = await Staff.findOne({ email }).populate("role");
    if (exist) {
      console.log("⚠️ Super Admin Already Exists");
      return;
    }

    // Create or find Super Admin role
    let superAdminRole = await Role.findOne({ name: "Super Admin" });
    if (!superAdminRole) {
      superAdminRole = await Role.create({
        name: "Super Admin",
        status: "Active"
      });
      console.log("✅ Super Admin Role Created");
    }

    // Get all permissions and grant full access
    const permissions = await Permission.find({});
    
    // Add all permissions with full access using new format
    superAdminRole.permissions = permissions.map(permission => ({
      name: permission.name,
      value: permission.value,
      all: true,
      create: true,
      read: true,
      update: true,
      delete: true
    }));
    
    await superAdminRole.save();
    console.log("✅ Super Admin Role Permissions Updated");

    const hash = await bcrypt.hash("pranav123", 10);

    await Staff.create({
      name: "Super Admin",
      email,
      password: hash,
      role: superAdminRole._id,
      position: "Super Admin",
      status: "Active"
    });

    console.log("✅ Super Admin Created");
  } catch (err) {
    console.log("❌ Error creating super admin", err);
  }
};