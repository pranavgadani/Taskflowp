const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { pool } = require("../config/mysqlDb");
const { generatePassword, sendMail } = require("../config/mail");
const { checkPermission } = require("../middleware/permissions");
const authMiddleware = require("../middleware/auth");
const { checkPlanLimit } = require("../middleware/subscriptionLimits");
const staffController = require("../controllers/staffController");
const companyController = require("../controllers/companyController");
const upload = require("../middleware/upload");

// GET all staff
router.get("/", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.id as _id, s.id, s.name, s.email, s.role, s.position, s.status, s.phone, s.image,
             r.id as role_id, r.name as role_name
      FROM staff s
      LEFT JOIN roles r ON s.role = r.id OR s.role = r.name
      ORDER BY s.created_at DESC
    `);

    const formatted = rows.map(r => ({
      _id: r.id,
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      position: r.position,
      status: r.status,
      image: r.image || "",
      role: {
        _id: r.role_id || r.role || "role_staff",
        id: r.role_id || r.role || "role_staff",
        name: r.role_name || r.role || "Staff"
      }
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD staff
router.post("/", authMiddleware, checkPermission("staff_management", "create"), checkPlanLimit("staff"), async (req, res) => {
  try {
    const { name, email, phone, status, role, position, password } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Name and email are required" });
    if (!password || password.trim().length < 6) return res.status(400).json({ error: "Password is required (min 6 characters)" });

    const plainPassword = password.trim();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const id = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const roleVal = role || "Developer";

    await pool.query(
      `INSERT INTO staff (id, name, email, password, role, position, status, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email.trim().toLowerCase(), hashedPassword, roleVal, position || roleVal, status || "Active", phone || ""]
    );

    // Auto leave balance
    try {
      await pool.query(
        `INSERT INTO leave_balances (id, user_id, user_name, user_email, cl_balance, sl_balance, pl_balance, comp_off)
         VALUES (?, ?, ?, ?, 12, 8, 15, 0)
         ON DUPLICATE KEY UPDATE user_name=VALUES(user_name), user_email=VALUES(user_email)`,
        [`bal_${id}`, id, name, email.trim().toLowerCase()]
      );
    } catch (e) {}

    if (email && plainPassword) {
      try {
        sendMail(email, roleVal, plainPassword);
      } catch (mailErr) {
        console.error("Failed to send welcome email:", mailErr);
      }
    }

    res.status(201).json({
      _id: id,
      id,
      name,
      email,
      phone,
      role: { name: roleVal },
      position: position || roleVal,
      status: status || "Active",
      tempPassword: plainPassword
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE
router.put("/:id", authMiddleware, checkPermission("staff_management", "update"), async (req, res) => {
  try {
    const { name, email, phone, status, role, position, password } = req.body;

    if (password && password.trim().length >= 6) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      await pool.query(
        `UPDATE staff SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           status = COALESCE(?, status),
           role = COALESCE(?, role),
           position = COALESCE(?, position),
           password = ?
         WHERE id = ?`,
        [name, email ? email.trim().toLowerCase() : null, phone, status, role, position, hashedPassword, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE staff SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           status = COALESCE(?, status),
           role = COALESCE(?, role),
           position = COALESCE(?, position)
         WHERE id = ?`,
        [name, email ? email.trim().toLowerCase() : null, phone, status, role, position, req.params.id]
      );
    }

    const [rows] = await pool.query("SELECT id as _id, id, name, email, phone, status, role, position FROM staff WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete("/:id", authMiddleware, checkPermission("staff_management", "delete"), async (req, res) => {
  try {
    await pool.query("DELETE FROM staff WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PROFILE ROUTES
router.get("/me", authMiddleware, staffController.getProfile);
router.put("/me", authMiddleware, staffController.updateProfile);

// COMPANY SETTINGS ROUTES
router.get("/company/settings", authMiddleware, companyController.getSettings);
router.put("/company/settings", authMiddleware, upload.single("appLogo"), companyController.updateSettings);

// COMPANY POLICY ROUTES
router.get("/company/policies", authMiddleware, companyController.getPolicies);
router.post("/company/policies", authMiddleware, companyController.addPolicy);
router.put("/company/policies/:policyId", authMiddleware, companyController.updatePolicy);
router.delete("/company/policies/:policyId", authMiddleware, companyController.deletePolicy);

module.exports = router;