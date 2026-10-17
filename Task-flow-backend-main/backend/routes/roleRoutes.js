const express = require("express");
const router = express.Router();
const { createRole, getRoles, getRole, updateRole, deleteRole } = require("../controllers/roleController");

const { checkPermission } = require("../middleware/permissions");
const authMiddleware = require("../middleware/auth");

// GET roles
router.get("/", authMiddleware, checkPermission("role_management", "read"), getRoles);

// GET role by ID
router.get("/:id", authMiddleware, checkPermission("role_management", "read"), getRole);

// CREATE role
router.post("/", authMiddleware, checkPermission("role_management", "create"), createRole);

// UPDATE role
router.put("/:id", authMiddleware, checkPermission("role_management", "update"), updateRole);

// DELETE role
router.delete("/:id", authMiddleware, checkPermission("role_management", "delete"), deleteRole);

module.exports = router;