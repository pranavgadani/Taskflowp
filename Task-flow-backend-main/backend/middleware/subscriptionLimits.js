/**
 * Subscription Limit Enforcement Middleware
 * 
 * Usage: checkPlanLimit("staff" | "project" | "task" | "document")
 * 
 * Place BEFORE the create handler in routes to block if limit reached.
 */
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Staff = require("../models/Staff");
const Task = require("../models/Task");

const getCompanyId = (req) => req.user?.companyId?._id || req.user?.companyId;

const MODEL_MAP = {
  staff: require("../models/Staff"),
  task: require("../models/Task"),
  project: require("../models/Project"),
  document: require("../models/Document"),
};

const LIMIT_FIELD_MAP = {
  staff: "maxStaff",
  task: "maxTasks",
  project: "maxProjects",
  document: "maxDocuments",
};

const LABEL_MAP = {
  staff: "Staff members",
  task: "Tasks",
  project: "Projects",
  document: "Documents",
};

/**
 * Returns Express middleware that enforces a subscription plan limit.
 * @param {string} resource - "staff" | "task" | "project" | "document"
 */
function checkPlanLimit(resource) {
  return async (req, res, next) => {
    try {
      // Super admins are never limited
      const isSuperAdmin = req.user?.email === process.env.SUPERADMIN_EMAIL || req.user?.role?.name === "Super Admin";
      if (isSuperAdmin) return next();

      const companyId = getCompanyId(req);
      if (!companyId) return next(); // No company = skip check

      // Load company with subscription populated
      const company = await Company.findById(companyId).populate("subscription");
      const plan = company?.subscription;

      // If no plan assigned, apply Free plan limits by default
      let maxAllowed;
      if (!plan) {
        const freePlan = await Subscription.findOne({ billingCycle: "monthly" });
        maxAllowed = freePlan ? freePlan[LIMIT_FIELD_MAP[resource]] : 1;
      } else {
        maxAllowed = plan[LIMIT_FIELD_MAP[resource]];
      }

      // -1 means unlimited
      if (maxAllowed === -1) return next();

      // Count current usage
      const Model = MODEL_MAP[resource];
      if (!Model) return next();

      const currentCount = await Model.countDocuments({ companyId });

      if (currentCount >= maxAllowed) {
        const planName = plan?.name || "Free";
        const label = LABEL_MAP[resource];
        return res.status(403).json({
          error: `Plan limit reached`,
          message: `Your "${planName}" plan allows a maximum of ${maxAllowed} ${label}. Please upgrade your plan to add more.`,
          limitReached: true,
          resource,
          current: currentCount,
          max: maxAllowed,
          planName
        });
      }

      next();
    } catch (err) {
      // Don't block on middleware errors, just log and continue
      console.error("Subscription limit check error:", err.message);
      next();
    }
  };
}

module.exports = { checkPlanLimit };
