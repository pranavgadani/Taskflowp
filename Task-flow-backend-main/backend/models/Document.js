const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
    documentType: { type: String, required: true },
    description: { type: String },
    content: [{
        content: { type: String, default: "" }
    }], // Store each page as a sub-document with its own Object ID
    file: { type: String },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "Staff" }],
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    access: { type: String, enum: ["All", "Manager", "Staff", "Company Owner"], default: "All" },
    accessGranted: { type: Boolean, default: false }, // General toggle: True means all assigned users can view
    grantedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Staff" }], // Users granted access individually
    requestedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Staff" }], // Users who have requested access
    textType: { type: String, enum: ["notepad", "doc", "upload"], default: "upload" }, // NEW
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    }
}, { timestamps: true });

documentSchema.index({ companyId: 1 });

module.exports = mongoose.model("Document", documentSchema);
