const Role = require("../models/Role");
const Permission = require("../models/Permission");

// Check if user has specific permission for an action
const checkPermission = (permissionValue, action) => {
  return async (req, res, next) => {
    try {
      // Get user from auth middleware (assuming req.user is set)
      if (!req.user) {
        return res.status(403).json({ error: "Access denied: No user found" });
      }

      // 👑 SUPER ADMIN EMAIL BYPASS (before role check)
      if (req.user.email === "gadanipranav@gmail.com" || req.user.email === process.env.SUPERADMIN_EMAIL) {
        console.log(`✅ SUPER ADMIN ACCESS GRANTED for ${permissionValue} - ${action}`);
        return next();
      }

      if (!req.user.role) {
        return res.status(403).json({ error: "Access denied: No role assigned" });
      }

      // Find user's role
      const role = await Role.findById(req.user.role);

      if (!role) {
        return res.status(403).json({ error: "Access denied: Role not found" });
      }

      // 👑 ADMIN BYPASS
      if (role.name === "Super Admin" || role.name === "Company Owner") {
        console.log(`✅ ADMIN ACCESS GRANTED for ${permissionValue} - ${action}`);
        return next();
      }

      // LOG: Show user permissions in console
      console.log(`=== PERMISSION CHECK FOR USER: ${req.user.email} ===`);
      console.log(`Role: ${role.name}`);
      console.log(`All Permissions:`, role.permissions.map(p => ({
        name: p.name,
        value: p.value,
        all: p.all,
        create: p.create,
        read: p.read,
        update: p.update,
        delete: p.delete
      })));

      // Find the specific permission
      const permission = role.permissions.find(p =>
        p.value === permissionValue
      );

      if (!permission) {
        return res.status(403).json({
          error: `Access denied: No permission for ${permissionValue}`
        });
      }

      // Check if user has 'all' access or specific action permission
      const hasPermission = permission.all || permission[action];

      // LOG: Show permission check result
      console.log(`Checking: ${permissionValue} - ${action}`);
      console.log(`Permission found:`, {
        name: permission.name,
        value: permission.value,
        all: permission.all,
        create: permission.create,
        read: permission.read,
        update: permission.update,
        delete: permission.delete,
        hasPermission: hasPermission
      });

      if (!hasPermission) {
        console.log(`❌ ACCESS DENIED for ${permissionValue} - ${action}`);
        return res.status(403).json({
          error: `Access denied: No ${action} permission for ${permissionValue}`
        });
      }

      console.log(`✅ ACCESS GRANTED for ${permissionValue} - ${action}`);
      // User has permission, continue
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ error: "Permission check failed" });
    }
  };
};

// Check multiple permissions (user needs at least one)
const checkAnyPermission = (permissionValues, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(403).json({ error: "Access denied: No user found" });
      }

      // 👑 SUPER ADMIN EMAIL BYPASS (before role check)
      if (req.user.email === "gadanipranav@gmail.com" || req.user.email === process.env.SUPERADMIN_EMAIL) {
        console.log(`✅ SUPER ADMIN ACCESS GRANTED (Any)`);
        return next();
      }

      if (!req.user.role) {
        return res.status(403).json({ error: "Access denied: No role assigned" });
      }

      const role = await Role.findById(req.user.role);

      if (!role) {
        return res.status(403).json({ error: "Access denied: Role not found" });
      }

      // 👑 ADMIN BYPASS
      if (role.name === "Super Admin" || role.name === "Company Owner") {
        console.log(`✅ ADMIN ACCESS GRANTED (Any)`);
        return next();
      }

      // Check if user has any of the required permissions
      const hasAnyPermission = permissionValues.some(permissionValue => {
        const permission = role.permissions.find(p =>
          p.value === permissionValue
        );
        return permission && (permission.all || permission[action]);
      });

      if (!hasAnyPermission) {
        return res.status(403).json({
          error: `Access denied: No ${action} permission for any of: ${permissionValues.join(", ")}`
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ error: "Permission check failed" });
    }
  };
};

// Get user permissions (for frontend)
const getUserPermissions = async (req, res) => {
  try {
    if (!req.user) {
      return res.json([]);
    }

    // 👑 SUPER ADMIN EMAIL BYPASS
    if (req.user.email === "gadanipranav@gmail.com" || req.user.email === process.env.SUPERADMIN_EMAIL) {
      return res.json([{
        name: 'Super Admin Access',
        value: 'all',
        all: true,
        create: true,
        read: true,
        update: true,
        delete: true
      }]);
    }

    if (!req.user.role) {
      return res.json([]);
    }

    const role = await Role.findById(req.user.role);

    if (!role) {
      return res.json([]);
    }

    // Format permissions for frontend
    const permissions = role.permissions.map(p => ({
      name: p.name,
      value: p.value,
      all: p.all,
      create: p.create,
      read: p.read,
      update: p.update,
      delete: p.delete
    }));

    res.json(permissions);
  } catch (error) {
    console.error("Get permissions error:", error);
    res.status(500).json({ error: "Failed to get permissions" });
  }
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  getUserPermissions
};
