const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff");
const Role = require("../models/Role");

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
    const { pool } = require("../config/mysqlDb");
    const [rows] = await pool.query("SELECT id as _id, id, name, email, role, position, status, phone FROM staff ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD staff
router.post("/", authMiddleware, checkPermission("staff_management", "create"), checkPlanLimit("staff"), async (req, res) => {
  try {
    const { name, email, phone, status, role } = req.body;
    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    let roleDoc;
    if (role) roleDoc = await Role.findById(role);
    if (!roleDoc) roleDoc = await Role.findOne();

    const isSuperAdmin = req.user.email === (process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com") || req.user.role?.name === "Super Admin";
    let companyId = req.user.companyId?._id || req.user.companyId;

    if (isSuperAdmin && !companyId) {
      companyId = req.body.companyId || req.query.companyId;
    }

    const staff = new Staff({
      name,
      email,
      phone,
      status,
      password: hashedPassword,
      role: roleDoc ? roleDoc._id : undefined,
      companyId: companyId
    });

    await staff.save();

    if (email && plainPassword) {
      try {
        sendMail(email, roleDoc ? roleDoc.name : "Staff", plainPassword);
      } catch (mailErr) {
        console.error("Failed to send welcome email:", mailErr);
      }
    }

    res.status(201).json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE
router.put("/:id", authMiddleware, checkPermission("staff_management", "update"), async (req, res) => {
  const staff = await Staff.findByIdAndUpdate(
    req.params.id,
    req.body,
    { returnDocument: 'after' }
  ).populate("role", "name");
  res.json(staff);
});

// DELETE
router.delete("/:id", authMiddleware, checkPermission("staff_management", "delete"), async (req, res) => {
  await Staff.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
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