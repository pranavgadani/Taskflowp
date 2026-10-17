const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Staff = require("../models/Staff");

// ─── Helper: get companyId ───────────────────────────────────────────────────
const getCompanyId = (req) => {
  const c = req.query.companyId || req.body.companyId || req.user?.companyId?._id?.toString() || req.user?.companyId?.toString();
  if (!c || c === "undefined" || c === "null" || c === "") return null;
  return c;
};

// ═══════════════════════════════════════════
//  CONVERSATIONS
// ═══════════════════════════════════════════

// GET  /api/chat/conversations  — list current user's conversations
router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const query = {
      participants: userId,
      isArchived: false,
    };

    const convos = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .populate("participants", "name email image position")
      .populate("createdBy", "name email image");

    res.json(convos);
  } catch (err) {
    console.error("GET /conversations error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/chat/conversations/direct — start or get 1-to-1 conversation
router.post("/conversations/direct", authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const companyId = getCompanyId(req);
    const userId = req.user._id;

    if (!targetUserId) return res.status(400).json({ message: "targetUserId required" });
    if (targetUserId.toString() === userId.toString())
      return res.status(400).json({ message: "Cannot chat with yourself" });

    // Check if direct conversation already exists
    let convo = await Conversation.findOne({
      type: "direct",
      participants: { $all: [userId, targetUserId], $size: 2 },
    }).populate("participants", "name email image position");

    if (!convo) {
      convo = await Conversation.create({
        type: "direct",
        participants: [userId, targetUserId],
        createdBy: userId,
        companyId: companyId || undefined,
      });
      convo = await convo.populate("participants", "name email image position");
    }

    res.json(convo);
  } catch (err) {
    console.error("POST /conversations/direct error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/chat/conversations/group — create group conversation
router.post("/conversations/group", authMiddleware, async (req, res) => {
  try {
    const { name, participantIds, clientParticipants, projectId } = req.body;
    const companyId = getCompanyId(req);
    const userId = req.user._id;

    // Only owners / super admin can add clients
    const userRole = req.user?.role?.name;
    const isOwnerOrAdmin =
      req.user?.email === "gadanipranav@gmail.com" ||
      userRole === "Super Admin" ||
      userRole === "Company Owner";

    const allParticipants = [
      userId.toString(),
      ...(participantIds || []).filter((id) => id.toString() !== userId.toString()),
    ];

    const convo = await Conversation.create({
      type: "group",
      name: name || "Group Chat",
      participants: allParticipants,
      clientParticipants:
        isOwnerOrAdmin && Array.isArray(clientParticipants) ? clientParticipants : [],
      createdBy: userId,
      companyId: companyId || undefined,
      projectId: projectId || null,
    });

    const populated = await convo.populate("participants", "name email image position");
    res.status(201).json(populated);
  } catch (err) {
    console.error("POST /conversations/group error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/chat/conversations/:id/add-client — add client (project owner only)
router.put("/conversations/:id/add-client", authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;

    const userRole = req.user?.role?.name;
    const isOwnerOrAdmin =
      req.user?.email === "gadanipranav@gmail.com" ||
      userRole === "Super Admin" ||
      userRole === "Company Owner";

    if (!isOwnerOrAdmin)
      return res.status(403).json({ message: "Only project owners can add clients" });

    if (!name || !email) return res.status(400).json({ message: "Name and email required" });

    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const alreadyExists = convo.clientParticipants.some(
      (c) => c.email.toLowerCase() === email.toLowerCase()
    );
    if (alreadyExists) return res.status(400).json({ message: "Client already added" });

    convo.clientParticipants.push({ name, email });
    await convo.save();

    res.json(convo);
  } catch (err) {
    console.error("PUT /add-client error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/chat/conversations/:id/remove-client — remove client (project owner only)
router.put("/conversations/:id/remove-client", authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.body;

    const userRole = req.user?.role?.name;
    const isOwnerOrAdmin =
      req.user?.email === "gadanipranav@gmail.com" ||
      userRole === "Super Admin" ||
      userRole === "Company Owner";

    if (!isOwnerOrAdmin)
      return res.status(403).json({ message: "Only project owners can remove clients" });

    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    convo.clientParticipants = convo.clientParticipants.filter(
      (c) => c._id.toString() !== clientId
    );
    await convo.save();

    res.json(convo);
  } catch (err) {
    console.error("PUT /remove-client error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/chat/conversations/:id
router.delete("/conversations/:id", authMiddleware, async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    // Only creator or admin can delete
    const isSuperAdmin = req.user?.email === "gadanipranav@gmail.com" || req.user?.role?.name === "Super Admin";
    if (!isSuperAdmin && convo.createdBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to delete this conversation" });

    await Message.deleteMany({ conversationId: req.params.id });
    await convo.deleteOne();

    res.json({ message: "Conversation deleted" });
  } catch (err) {
    console.error("DELETE /conversations/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ═══════════════════════════════════════════
//  MESSAGES
// ═══════════════════════════════════════════

// GET  /api/chat/conversations/:id/messages
router.get("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({
      conversationId: req.params.id,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("sender", "name email image");

    // Mark as read
    await Message.updateMany(
      { conversationId: req.params.id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json(messages.reverse());
  } catch (err) {
    console.error("GET /messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/chat/conversations/:id/messages — send message (REST fallback)
router.post("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;

    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const msg = await Message.create({
      conversationId: req.params.id,
      sender: req.user._id,
      senderName: req.user.name,
      senderImage: req.user.image || "",
      text: text || "",
      readBy: [req.user._id],
    });

    // Update lastMessage on conversation
    convo.lastMessage = {
      text: text || "",
      senderId: req.user._id,
      senderName: req.user.name,
      sentAt: new Date(),
    };
    await convo.save();

    const populated = await msg.populate("sender", "name email image");

    // Emit via socket if io is available
    const io = req.app.get("io");
    if (io) {
      io.to(`conv_${req.params.id}`).emit("new_message", populated);
      io.to(`conv_${req.params.id}`).emit("conversation_updated", convo);
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error("POST /messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/chat/staff — list all active staff (for new convo)
router.get("/staff", authMiddleware, async (req, res) => {
  try {
    const staff = await Staff.find({ status: "Active" })
      .select("name email image position role")
      .populate("role", "name");

    res.json(staff);
  } catch (err) {
    console.error("GET /chat/staff error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/chat/unread-counts
router.get("/unread-counts", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all conversation ids for user
    const convos = await Conversation.find({
      participants: userId,
      isArchived: false,
    }).select("_id");

    const convoIds = convos.map((c) => c._id);

    // Count unread per conversation
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: convoIds },
          readBy: { $nin: [userId] },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$conversationId",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = {};
    unreadAgg.forEach((a) => {
      counts[a._id.toString()] = a.count;
    });

    res.json(counts);
  } catch (err) {
    console.error("GET /unread-counts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

