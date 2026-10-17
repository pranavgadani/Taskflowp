const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Project name is required"],
        trim: true,
        maxlength: [100, "Project name cannot exceed 100 characters"],
        minlength: [1, "Project name cannot be empty"],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, "Description cannot exceed 500 characters"],
        default: "",
    },
    assignedTo: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staff",
        },
    ],
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        required: [true, "Status is required"]
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: false
    }
}, { timestamps: true });

projectSchema.index({ companyId: 1 });

module.exports = mongoose.model("Project", projectSchema);
