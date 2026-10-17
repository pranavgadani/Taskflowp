const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    maxlength: [50, "Permission name cannot exceed 50 characters"],
    match: [/^[a-zA-Z\s&-]+$/, "Permission name can only contain letters, spaces, and &"]
  },
  value: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  }
});

module.exports =
  mongoose.models.Permission ||
  mongoose.model("Permission", permissionSchema);