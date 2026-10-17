const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscriptionController");
const authMiddleware = require("../middleware/auth");

// Public: list all plans
router.get("/plans", subscriptionController.getPlans);
router.get("/plans/:id", authMiddleware, subscriptionController.getPlanById);

// Protected: company-specific
router.get("/current", authMiddleware, subscriptionController.getCurrentSubscription);
router.get("/usage", authMiddleware, subscriptionController.getUsageStats);
router.post("/upgrade", authMiddleware, subscriptionController.upgradePlan);

// ================= ADMIN ROUTES (SUPER ADMIN ONLY) =================

// Middleware to check if user is Super Admin
const isSuperAdmin = (req, res, next) => {
  // Check by email or by role name
  if (req.user && (req.user.email === "gadanipranav@gmail.com" || 
      (req.user.role && req.user.role.name === "Super Admin"))) {
    return next();
  }
  return res.status(403).json({ error: "Access denied: Super Admin only" });
};

// Create, Update, Delete plans
router.post("/plans", authMiddleware, isSuperAdmin, subscriptionController.createPlan);
router.put("/plans/:id", authMiddleware, isSuperAdmin, subscriptionController.updatePlan);
router.delete("/plans/:id", authMiddleware, isSuperAdmin, subscriptionController.deletePlan);

module.exports = router;
