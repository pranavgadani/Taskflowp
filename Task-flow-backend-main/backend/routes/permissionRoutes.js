const express = require("express");
const router = express.Router();
const Permission = require("../models/Permission");

const { checkPermission } = require("../middleware/permissions");
const authMiddleware = require("../middleware/auth");

// GET all permissions
router.get("/", authMiddleware, checkPermission("permission_management", "read"), async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD permission
router.post("/", authMiddleware, checkPermission("permission_management", "create"), async (req, res) => {
  try {
    const permission = new Permission(req.body);
    await permission.save();
    res.json(permission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE permission
router.put("/:id", authMiddleware, checkPermission("permission_management", "update"), async (req, res) => {
  try {
    const permission = await Permission.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after' }
    );
    res.json(permission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE permission
router.delete("/:id", authMiddleware, checkPermission("permission_management", "delete"), async (req, res) => {
  try {
    await Permission.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;