const { pool } = require("../config/mysqlDb");

// Helper to resolve role permissions object
async function getRolePermissions(user) {
  if (user?.role && typeof user.role === "object" && user.role.permissions) {
    return user.role;
  }
  const roleIdOrName = user?.role?.name || user?.role || "Staff";
  try {
    const [rows] = await pool.query("SELECT * FROM roles WHERE id = ? OR name = ? LIMIT 1", [roleIdOrName, roleIdOrName]);
    if (rows && rows.length > 0) {
      let perms = [];
      try {
        perms = typeof rows[0].permissions === "string" ? JSON.parse(rows[0].permissions) : rows[0].permissions;
      } catch (e) { perms = []; }
      return {
        id: rows[0].id,
        name: rows[0].name,
        permissions: perms || []
      };
    }
  } catch (err) {
    console.error("Error fetching role:", err);
  }
  return null;
}

// Check if user has specific permission for an action
const checkPermission = (permissionValue, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(403).json({ error: "Access denied: No user found" });
      }

      // 👑 SUPER ADMIN EMAIL BYPASS
      if (req.user.email === "gadanipranav@gmail.com" || req.user.email === process.env.SUPERADMIN_EMAIL) {
        return next();
      }

      const role = await getRolePermissions(req.user);
      if (!role) {
        return res.status(403).json({ error: "Access denied: Role not found" });
      }

      // 👑 ADMIN BYPASS
      if (role.name === "Super Admin" || role.name === "Company Owner") {
        return next();
      }

      const permissions = Array.isArray(role.permissions) ? role.permissions : [];
      const permission = permissions.find(p => p.value === permissionValue);

      if (!permission) {
        return res.status(403).json({
          error: `Access denied: No permission for ${permissionValue}`
        });
      }

      const hasPermission = permission.all || permission[action];
      if (!hasPermission) {
        return res.status(403).json({
          error: `Access denied: No ${action} permission for ${permissionValue}`
        });
      }

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

      if (req.user.email === "gadanipranav@gmail.com" || req.user.email === process.env.SUPERADMIN_EMAIL) {
        return next();
      }

      const role = await getRolePermissions(req.user);
      if (!role) {
        return res.status(403).json({ error: "Access denied: Role not found" });
      }

      if (role.name === "Super Admin" || role.name === "Company Owner") {
        return next();
      }

      const permissions = Array.isArray(role.permissions) ? role.permissions : [];
      const hasAnyPermission = permissionValues.some(permissionValue => {
        const permission = permissions.find(p => p.value === permissionValue);
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

    if (req.user.email === "gadanipranav@gmail.com" || req.user.email === process.env.SUPERADMIN_EMAIL) {
      return res.json([{
        name: "Super Admin Access",
        value: "all",
        all: true,
        create: true,
        read: true,
        update: true,
        delete: true
      }]);
    }

    const role = await getRolePermissions(req.user);
    if (!role) {
      return res.json([]);
    }

    const permissions = Array.isArray(role.permissions) ? role.permissions : [];
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
