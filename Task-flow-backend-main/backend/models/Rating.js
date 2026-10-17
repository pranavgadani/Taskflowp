const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: [true, "Employee is required"]
  },
  ratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project"
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task"
  },
  score: {
    type: Number,
    min: [1, "Rating cannot be lower than 1"],
    max: [5, "Rating cannot exceed 5"],
    required: [true, "Score (1-5) is required"]
  },
  category: {
    type: String,
    enum: [
      "Overall Performance",
      "Work Quality",
      "Timeliness & Punctuality",
      "Problem Solving",
      "Communication & Teamwork"
    ],
    default: "Overall Performance"
  },
  reviewPeriod: {
    type: String,
    trim: true,
    default: "General Review"
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: [1000, "Feedback cannot exceed 1000 characters"]
  }
}, { timestamps: true });

ratingSchema.index({ companyId: 1, employeeId: 1 });
ratingSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("Rating", ratingSchema);
