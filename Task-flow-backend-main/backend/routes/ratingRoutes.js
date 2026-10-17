const express = require("express");
const router = express.Router();
const Rating = require("../models/Rating");
const Staff = require("../models/Staff");
const authMiddleware = require("../middleware/auth");

// @route   GET /api/ratings
// @desc    Get all ratings for the current user's company (filtered optionally by employeeId)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === (process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com") || req.user.role?.name === "Super Admin";
    let companyId = req.user.companyId?._id || req.user.companyId;

    if (isSuperAdmin && !companyId) {
      companyId = req.query.companyId || req.headers["x-company-id"];
    }

    const filter = {};
    if (companyId) {
      filter.companyId = companyId;
    }
    if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }

    const ratings = await Rating.find(filter)
      .populate("employeeId", "name email image position")
      .populate("ratedBy", "name email image")
      .populate("projectId", "title name")
      .populate("taskId", "title")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.status(500).json({ message: "Server error fetching ratings" });
  }
});

// @route   GET /api/ratings/summary
// @desc    Get aggregate rating summary per employee
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === (process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com") || req.user.role?.name === "Super Admin";
    let companyId = req.user.companyId?._id || req.user.companyId;

    if (isSuperAdmin && !companyId) {
      companyId = req.query.companyId || req.headers["x-company-id"];
    }

    const filter = {};
    if (companyId) {
      filter.companyId = companyId;
    }

    const ratings = await Rating.find(filter)
      .populate("employeeId", "name email image position");

    // Group by employee
    const summaryMap = {};
    ratings.forEach((r) => {
      if (!r.employeeId?._id) return;
      const empId = r.employeeId._id.toString();
      if (!summaryMap[empId]) {
        summaryMap[empId] = {
          employee: r.employeeId,
          totalRatings: 0,
          totalScore: 0,
          averageScore: 0,
          categoryBreakdown: {},
          latestFeedback: r.feedback,
        };
      }
      summaryMap[empId].totalRatings += 1;
      summaryMap[empId].totalScore += r.score;
      if (!summaryMap[empId].categoryBreakdown[r.category]) {
        summaryMap[empId].categoryBreakdown[r.category] = { total: 0, count: 0 };
      }
      summaryMap[empId].categoryBreakdown[r.category].total += r.score;
      summaryMap[empId].categoryBreakdown[r.category].count += 1;
    });

    const summary = Object.values(summaryMap).map((item) => ({
      ...item,
      averageScore: Number((item.totalScore / item.totalRatings).toFixed(1)),
    }));

    res.json(summary);
  } catch (error) {
    console.error("Error fetching rating summary:", error);
    res.status(500).json({ message: "Server error fetching rating summary" });
  }
});

// @route   POST /api/ratings
// @desc    Create a new employee rating
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { employeeId, projectId, taskId, score, category, reviewPeriod, feedback } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee is required." });
    }

    const numericScore = Number(score);
    if (!numericScore || numericScore < 1 || numericScore > 5) {
      return res.status(400).json({ message: "Score must be a number between 1 and 5." });
    }

    const isSuperAdmin = req.user.email === (process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com") || req.user.role?.name === "Super Admin";

    // Find employee first (using _id or MySQL string id)
    let employee = null;
    try {
      employee = await Staff.findById(employeeId);
    } catch {
      // ignore
    }
    if (!employee) {
      employee = await Staff.findOne({ email: employeeId });
    }

    // Resolve companyId
    let companyId = req.user.companyId?._id || req.user.companyId || req.body.companyId;
    if (!companyId && employee?.companyId) {
      companyId = employee.companyId;
    }

    // If still no companyId (e.g. Super Admin without default company), fallback to first available Company or employee
    if (!companyId) {
      const Company = require("../models/Company");
      const defaultCompany = await Company.findOne();
      if (defaultCompany) {
        companyId = defaultCompany._id;
      }
    }

    if (!companyId) {
      return res.status(400).json({ message: "No company associated with this evaluation." });
    }

    // Verify employee
    if (!employee && !isSuperAdmin) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const resolvedEmployeeId = employee ? employee._id : employeeId;

    const rating = new Rating({
      employeeId: resolvedEmployeeId,
      ratedBy: req.user._id,
      companyId,
      projectId: projectId || null,
      taskId: taskId || null,
      score: numericScore,
      category: category || "Overall Performance",
      reviewPeriod: reviewPeriod || "General Review",
      feedback: feedback ? feedback.trim() : "",
    });

    await rating.save();

    const populatedRating = await Rating.findById(rating._id)
      .populate("employeeId", "name email image position")
      .populate("ratedBy", "name email image")
      .populate("projectId", "title name")
      .populate("taskId", "title");

    res.status(201).json({ message: "Rating saved successfully", rating: populatedRating });
  } catch (error) {
    console.error("Error saving rating:", error);
    res.status(500).json({ message: error.message || "Server error saving rating" });
  }
});

// @route   DELETE /api/ratings/:id
// @desc    Delete a rating
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.companyId?._id || req.user.companyId;
    const rating = await Rating.findOne({ _id: req.params.id, companyId });
    if (!rating) {
      return res.status(404).json({ message: "Rating not found." });
    }

    // Allow deletion if super admin, company owner, or person who rated
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    const isCompanyOwner = req.user.role?.name === "Company Owner";
    const isAuthor = rating.ratedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isCompanyOwner && !isAuthor) {
      return res.status(403).json({ message: "Not authorized to delete this rating." });
    }

    await Rating.findByIdAndDelete(req.params.id);
    res.json({ message: "Rating deleted successfully." });
  } catch (error) {
    console.error("Error deleting rating:", error);
    res.status(500).json({ message: "Server error deleting rating" });
  }
});

module.exports = router;
