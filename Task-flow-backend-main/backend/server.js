require("dotenv").config({ path: './.env' });
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const createSuperAdmin = require("./config/superAdmin");
const seedDefaults = require("./config/seedPermissions");

const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const taskRoutes = require("./routes/taskRoutes");
const roleRoutes = require("./routes/roleRoutes");
const taskStatusRoutes = require("./routes/taskStatusRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const projectRoutes = require("./routes/projectRoutes");
const documentRoutes = require("./routes/documentRoutes");
const companyRoutes = require("./routes/companyRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const chatRoutes = require("./routes/chatRoutes");
const clientRoutes = require("./routes/clientRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const qaRoutes = require("./routes/qaRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const breakRoutes = require("./routes/breakRoutes");
const Message = require("./models/Message");
const Conversation = require("./models/Conversation");
const { checkPermission, checkAnyPermission, getUserPermissions } = require("./middleware/permissions");
const authMiddleware = require("./middleware/auth");

const app = express();
const server = http.createServer(app);

// ======== SOCKET.IO SETUP ========
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for the Vite frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Make io accessible in routes/controllers via req.io
app.set("io", io);

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // ── Chat: join a conversation room ──
  socket.on("join_conversation", (conversationId) => {
    socket.join(`conv_${conversationId}`);
  });

  // ── Chat: leave a conversation room ──
  socket.on("leave_conversation", (conversationId) => {
    socket.leave(`conv_${conversationId}`);
  });

  // ── Chat: send message via socket ──
  socket.on("send_message", async (data) => {
    try {
      const { conversationId, text, senderId, senderName, senderImage } = data;
      if (!conversationId || !text || !senderId) return;

      const msg = await Message.create({
        conversationId,
        sender: senderId,
        senderName: senderName || "",
        senderImage: senderImage || "",
        text,
        readBy: [senderId],
      });

      // Update conversation lastMessage
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: {
          text,
          senderId,
          senderName: senderName || "",
          sentAt: new Date(),
        },
        updatedAt: new Date(),
      });

      // Emit to all in room including sender
      io.to(`conv_${conversationId}`).emit("new_message", msg);
      // Also notify all company members for sidebar unread badge
      io.emit(`conv_updated_${conversationId}`, {
        conversationId,
        lastMessage: { text, senderName, sentAt: new Date() },
      });
    } catch (err) {
      console.error("Socket send_message error:", err);
    }
  });

  // ── Chat: typing indicator ──
  socket.on("typing", ({ conversationId, userName, isTyping }) => {
    socket.to(`conv_${conversationId}`).emit("user_typing", { userName, isTyping });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// middleware
app.use(cors({
  origin: true, // Allow any origin that makes the request
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Static uploads
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/task-status", taskStatusRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/qa", qaRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/breaks", breakRoutes);
app.use("/api/timesheets", require("./routes/timesheetRoutes"));

// Get current user permissions
app.get("/api/user-permissions", authMiddleware, getUserPermissions);

app.get("/", (req, res) => {
  res.send("Task Manager API Running ");
});

// Connect Databases
const { initDB } = require("./config/mysqlDb");
const { registerMySQLSyncPlugin } = require("./config/syncMySQL");

// Apply MySQL sync plugin to all mongoose schemas
mongoose.plugin(registerMySQLSyncPlugin);

async function startServer() {
  try {
    // 1. Initialize MySQL taskflow_db tables
    await initDB();

    // 2. Connect DB engine
    let mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
    if (!mongoUri) {
      try {
        const { MongoMemoryServer } = require("mongodb-memory-server");
        const path = require("path");
        const fs = require("fs");
        const binaryDir = path.join(__dirname, "../.mongo-bin");
        const dbPath = path.join(__dirname, "../.mongo-data");
        if (!fs.existsSync(binaryDir)) fs.mkdirSync(binaryDir, { recursive: true });
        if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

        const mongod = await MongoMemoryServer.create({
          binary: {
            downloadDir: binaryDir,
            version: "6.0.14"
          },
          instance: {
            dbPath: dbPath
          }
        });
        mongoUri = mongod.getUri();
        console.log("⚡ In-Memory Mongo Engine started on D: drive (Zero-Setup)");
      } catch (e) {
        console.warn("MongoMemoryServer fallback error:", e.message);
        mongoUri = "mongodb://127.0.0.1:27017/taskmanager";
      }
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Database Engine Connected & Synced with MySQL taskflow_db");

    await seedDefaults();
    await createSuperAdmin();
    try {
      const seedDummyData = require("./seedData");
      await seedDummyData();
    } catch (sErr) {
      console.warn("Seed dummy note:", sErr.message);
    }

    // Start server after DB connection
    server.listen(5000, () => console.log("🚀 Server running on port 5000 with Socket.io & MySQL (taskflow_db) ⚡"));
  } catch (err) {
    console.error("❌ Startup Error:", err);
    process.exit(1);
  }
}

startServer();