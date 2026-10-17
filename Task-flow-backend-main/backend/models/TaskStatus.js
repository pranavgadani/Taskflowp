const mongoose = require("mongoose");

const TaskStatusSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ["Active", "Inactive"], required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
}, { timestamps: true });

TaskStatusSchema.index({ companyId: 1 });

module.exports = mongoose.models.TaskStatus || mongoose.model("TaskStatus", TaskStatusSchema);