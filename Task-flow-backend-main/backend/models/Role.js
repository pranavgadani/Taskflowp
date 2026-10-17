const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: [50, "Role name cannot exceed 50 characters"],
    match: [/^[a-zA-Z0-9\s]+$/, "Role name can only contain letters, numbers and spaces"]
  },
  status: { type: String, required: true },
  permissions: [
    {
      name: { type: String, required: true },
      value: { type: String, required: true },
      all: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    }
  ],
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
}, { timestamps: true });

roleSchema.index({ companyId: 1 });

module.exports =
  mongoose.models.Role ||
  mongoose.model("Role", roleSchema);