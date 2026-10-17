const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },
    name: {
      // Only for group chats
      type: String,
      trim: true,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
      },
    ],
    // Clients (external) added only by project owners
    clientParticipants: [
      {
        name: { type: String, required: true },
        email: { type: String, required: true },
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false,
    },
    lastMessage: {
      text: { type: String, default: "" },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
      senderName: { type: String, default: "" },
      sentAt: { type: Date },
    },
    // project this convo is linked to (optional)
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationSchema.index({ companyId: 1 });
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
