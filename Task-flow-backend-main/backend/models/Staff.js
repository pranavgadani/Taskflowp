const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"],
    match: [/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"]
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: [255, "Email cannot exceed 255 characters"],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"]
  },
  password: { type: String, required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
  phone: {
    type: String,
    trim: true,
    maxlength: [15, "Phone cannot exceed 15 characters"],
    match: [/^\d{10,15}$/, "Phone number must contain 10 to 15 digits only"]
  },
  position: String,
  status: { type: String, enum: ["Active", "Inactive"], required: [true, "Status is required"] },
  image: String,
  video: String,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, { timestamps: true });

staffSchema.index({ companyId: 1 });

module.exports = mongoose.model("Staff", staffSchema);