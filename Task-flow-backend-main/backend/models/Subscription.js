const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },       // "Free", "Quarterly", "Yearly"
  billingCycle: { type: String, enum: ["monthly", "quarterly", "yearly"], required: true },
  price: { type: Number, default: 0 },                       // USD
  maxProjects: { type: Number, default: 1 },                 // -1 = unlimited
  maxTasks: { type: Number, default: 25 },                   // -1 = unlimited
  maxStaff: { type: Number, default: 5 },                    // -1 = unlimited
  maxDocuments: { type: Number, default: 10 },               // -1 = unlimited
  maxTaskStatuses: { type: Number, default: 5 },             // New
  maxIssues: { type: Number, default: 10 },                  // New
  maxBulkUploads: { type: Number, default: 1 },              // New
  maxAddText: { type: Number, default: 5 },                  // New
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);
