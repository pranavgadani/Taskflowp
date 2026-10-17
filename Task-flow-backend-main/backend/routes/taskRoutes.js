const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("fast-csv");

const Task = require("../models/Task");
const Staff = require("../models/Staff");
const TaskStatus = require("../models/TaskStatus");
const { sendMail, sendTaskOrIssueMail } = require("../config/mail");
const { checkPermission, checkAnyPermission } = require("../middleware/permissions");
const authMiddleware = require("../middleware/auth");
const { checkPlanLimit } = require("../middleware/subscriptionLimits");


// FILE STORAGE
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

// File format validation
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "image") {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid image format! Only images are allowed."), false);
    }
  } else if (file.fieldname === "video") {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid video format! Only videos are allowed."), false);
    }
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});


// ================= GET TASKS =================
router.get("/", authMiddleware, checkAnyPermission(["task_management", "issue"], "read"), async (req, res) => {
  try {
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com";
    const isSuperAdmin = req.user?.email === SUPERADMIN_EMAIL || req.user?.role?.name === "Super Admin";

    const filter = {};
    
    // Multi-tenant check: filter by companyId if not superadmin
    if (!isSuperAdmin) {
      filter.companyId = req.user.companyId?._id || req.user.companyId;
    } else if (req.query.companyId) { // Super Admin filtering by company
      filter.companyId = req.query.companyId;
    }

    const isCompanyOwner = req.user?.role?.name === "Company Owner";

    // Only filter by assigned projects if NOT super admin AND NOT company owner
    if (!isSuperAdmin && !isCompanyOwner) {
      const Project = require("../models/Project");
      const assignedProjects = await Project.find({ assignedTo: req.user._id }).select("_id");
      const projectIds = assignedProjects.map(p => p._id.toString());

      if (req.query.project) {
        // If they requested a specific project, check if they are in it
        if (!projectIds.includes(req.query.project.toString())) {
          return res.json([]); // Not assigned to this project
        }
        filter.project = req.query.project;
      } else {
        // General view: show all tasks from all assigned projects
        filter.project = { $in: projectIds };
      }
    } else if (req.query.project) {
      // Superadmin requested a specific project
      filter.project = req.query.project;
    }

    // Filter by type: 'task' or 'issue'
    if (req.query.type === "issue") {
      filter.type = "issue";
    } else if (req.query.type === "task") {
      filter.$or = [
        { type: "task" },
        { type: { $exists: false } },
        { type: null }
      ];
    }

    if (req.query.page && req.query.limit) {
      // Server-side pagination requested
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const [tasks, totalCount] = await Promise.all([
        Task.find(filter)
          .sort({ _id: -1 }) // Latest first
          .skip(skip)
          .limit(limit)
          .populate("assignedTo", "name")
          .populate("status", "name")
          .populate("project", "name"),
        Task.countDocuments(filter)
      ]);

      res.json({
        tasks,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      });
    } else {
      // Legacy behavior (Dashboard etc.): return top 1000 as list
      const tasks = await Task.find(filter)
        .sort({ _id: -1 }) // Show latest tasks first
        .limit(1000) // Prevent server/browser crash on 10+ lakh rows
        .populate("assignedTo", "name")
        .populate("status", "name")
        .populate("project", "name");
      res.json(tasks);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ================= SAMPLE CSV TEMPLATE =================
router.get("/bulk-upload/sample", authMiddleware, (req, res) => {
  const isIssue = req.query.type === "issue";
  let header, sample;
  if (isIssue) {
    header = "title,description,assignedTo,status,priority";
    sample = "Fix login bug,User cannot login with correct credentials,John Doe,Active,High";
  } else {
    header = "title,description,assignedTo,status";
    sample = "Design homepage,Create wireframe for homepage,Jane Smith,Active";
  }
  const content = header + "\n" + sample + "\n";
  res.setHeader("Content-Disposition", `attachment; filename="${isIssue ? "issues" : "tasks"}_sample.csv"`);
  res.setHeader("Content-Type", "text/csv");
  res.send(content);
});

// ================= ADD TASK + MAIL =================
router.post(
  "/",
  authMiddleware,
  checkAnyPermission(["task_management", "issue"], "create"),
  checkPlanLimit("task"),
  upload.fields([{ name: "image" }, { name: "video" }]),
  async (req, res) => {
    try {
      const { title, description, assignedTo, status, project, priority, type, startDate, endDate, estimatedHours, calculatedEndDate, subtasks } = req.body;

      // ====== BACKEND VALIDATION ======
      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Title is required" });
      }
      if (title.length > 100) {
        return res.status(400).json({ error: "Title must be 100 characters or less" });
      }
      // Simple regex to block common injection characters like < > { } [ ] ;
      const safeRegex = /^[a-zA-Z0-9\s\-_.,()!@?]*$/;
      if (!safeRegex.test(title)) {
        return res.status(400).json({ error: "Title contains potentially unsafe characters" });
      }

      if (description && description.length > 1000) {
        return res.status(400).json({ error: "Description must be 1000 characters or less" });
      }

      const image = req.files?.image?.[0]?.filename || null;
      const video = req.files?.video?.[0]?.filename || null;

      const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com";
      const isSuperAdmin = req.user?.email === SUPERADMIN_EMAIL || req.user?.role?.name === "Super Admin";
      let companyId = req.user.companyId?._id || req.user.companyId;

      if (isSuperAdmin && !companyId) {
        companyId = req.body.companyId || req.query.companyId;
      }

      let parsedSubtasks = [];
      if (subtasks) {
        try {
          parsedSubtasks = typeof subtasks === "string" ? JSON.parse(subtasks) : subtasks;
        } catch (e) { parsedSubtasks = []; }
      }

      const task = new Task({
        title,
        description,
        assignedTo,
        status,
        project: project || null,
        priority: priority || "Medium",
        type: type || "task",
        startDate: startDate || null,
        endDate: endDate || calculatedEndDate || null,
        estimatedHours: estimatedHours || 0,
        calculatedEndDate: calculatedEndDate || endDate || null,
        subtasks: Array.isArray(parsedSubtasks) ? parsedSubtasks : [],
        image,
        video,
        companyId: companyId
      });

      await task.save();

      // populated task
      const populated = await Task.findById(task._id)
        .populate("assignedTo", "name email")
        .populate("status", "name")
        .populate("project", "name");

      // ===== SEND MAIL =====
      if (Array.isArray(populated.assignedTo)) {
        populated.assignedTo.forEach(staff => {
          if (staff.email) {
            try {
              sendTaskOrIssueMail(
                staff.email,
                title,
                description,
                staff.name,
                populated.status?.name,
                populated.type || "task"
              );
            } catch (err) { console.error("Mail error:", err); }
          }
        });
      }

      // Socket emit
      const io = req.app.get("io");
      if (io) io.emit("task:created", populated);

      res.json(populated);

    } catch (err) {
      console.log(err);
      res.status(500).json({ error: err.message });
    }
  }
);


// ================= UPDATE =================
router.put("/:id", authMiddleware, checkAnyPermission(["task_management", "issue"], "update"), upload.fields([{ name: "image" }, { name: "video" }]), async (req, res) => {
  try {
    const { title, description, assignedTo, status, project, priority, type, startDate, endDate, estimatedHours, calculatedEndDate, subtasks } = req.body;

    // ====== BACKEND VALIDATION ======
    if (title) {
      if (title.length > 100) {
        return res.status(400).json({ error: "Title must be 100 characters or less" });
      }
      const safeRegex = /^[a-zA-Z0-9\s\-_.,()!@?]*$/;
      if (!safeRegex.test(title)) {
        return res.status(400).json({ error: "Title contains potentially unsafe characters" });
      }
    }

    if (description && description.length > 1000) {
      return res.status(400).json({ error: "Description must be 1000 characters or less" });
    }

    const image = req.files?.image?.[0]?.filename || undefined;
    const video = req.files?.video?.[0]?.filename || undefined;

    const update = {
      title,
      description,
      assignedTo,
      startDate: startDate || null,
      endDate: endDate || calculatedEndDate || null,
      estimatedHours,
      calculatedEndDate: calculatedEndDate || endDate || null
    };

    if (subtasks !== undefined) {
      try {
        update.subtasks = typeof subtasks === "string" ? JSON.parse(subtasks) : subtasks;
      } catch (e) {
        if (Array.isArray(subtasks)) update.subtasks = subtasks;
      }
    }

    // Project
    if (project !== undefined) update.project = project || null;

    // Priority
    if (priority) update.priority = priority;

    // Type (task / issue) — preserve existing type
    if (type) update.type = type;

    // Handle status
    if (status) {
      if (typeof status === 'string' && !status.match(/^[0-9a-fA-F]{24}$/)) {
        let statusDoc = await TaskStatus.findOne({ name: status })
          || await TaskStatus.findOne({ name: { $regex: new RegExp(`^${status}$`, 'i') } });
        if (!statusDoc) {
          return res.status(400).json({ error: `Status "${status}" not found` });
        }
        update.status = statusDoc._id;
      } else {
        update.status = status;
      }
    }

    if (image) {
      update.image = image;
    } else if (req.body.image === "") {
      update.image = "";
    }

    if (video) {
      update.video = video;
    } else if (req.body.video === "") {
      update.video = "";
    }

    // Capture current state to see if assignment changes
    const originalTask = await Task.findById(req.params.id);
    if (!originalTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = await Task.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' })
      .populate("assignedTo", "name email")
      .populate("status", "name")
      .populate("project", "name");

    // ===== SEND MAIL ON EDIT =====
    if (Array.isArray(task.assignedTo)) {
      task.assignedTo.forEach(staff => {
        if (staff.email) {
          try {
            sendTaskOrIssueMail(
              staff.email,
              task.title,
              task.description || "No description",
              staff.name,
              task.status?.name || "Pending",
              task.type || "task",
              "updated"
            );
          } catch (err) { console.error("Mail error:", err); }
        }
      });
    }

    // Socket emit
    const io = req.app.get("io");
    if (io) io.emit("task:updated", task);

    res.json(task);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ================= FIX TASK STATUSES =================
router.post("/fix-statuses", async (req, res) => {
  try {
    console.log("🔧 Fixing task statuses...");

    // Get all tasks that need fixing
    const tasksToFix = await Task.find({
      $or: [
        { status: { $exists: false } },
        { status: null },
        { status: { $type: "string" } }
      ]
    });

    console.log(`Found ${tasksToFix.length} tasks to fix`);

    if (tasksToFix.length === 0) {
      return res.json({ message: "All tasks already have proper status" });
    }

    // Get default status
    const defaultStatus = await TaskStatus.findOne({ name: "Active" });

    if (!defaultStatus) {
      return res.status(400).json({ error: "No active status found" });
    }

    // Update all tasks
    const result = await Task.updateMany(
      {
        $or: [
          { status: { $exists: false } },
          { status: null },
          { status: { $type: "string" } }
        ]
      },
      { status: defaultStatus._id }
    );

    console.log(`✅ Fixed ${result.modifiedCount} tasks`);

    res.json({
      message: `Fixed ${result.modifiedCount} tasks with status: ${defaultStatus.name}`,
      fixed: result.modifiedCount
    });

  } catch (err) {
    console.error("Error fixing tasks:", err);
    res.status(500).json({ error: err.message });
  }
});


// ================= BULK UPLOAD (CSV) =================
const { Transform } = require("stream");
const { pipeline } = require("stream/promises"); // For modern async pipeline

// multer for CSV uploads (stored to temp path under uploads/)
const csvStorage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => cb(null, "bulk_" + Date.now() + path.extname(file.originalname)),
});
const csvUpload = multer({
  storage: csvStorage,
  fileFilter: (req, file, cb) => {
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only CSV or Excel files are allowed"), false);
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB — supports 1-2 crore rows
});

// Custom Transform stream for batching and inserting
class BatchInsertTransform extends Transform {
  constructor(options, staffMap, statusMap, defaultStatusId, projectId, companyId, type) {
    super({ ...options, objectMode: true }); // objectMode because csv.parse outputs objects
    this.batch = [];
    this.staffMap = staffMap;
    this.statusMap = statusMap;
    this.defaultStatusId = defaultStatusId;
    this.projectId = projectId;
    this.companyId = companyId;
    this.type = type;
    this.BATCH_SIZE = 1000; // 1000 docs per batch = low memory pressure
    this.insertedCount = 0;
    this.skippedCount = 0;
    this.totalRows = 0;
  }

  _transform(row, encoding, callback) {
    this.totalRows++;
    const title = (row.title || row.Title || "").trim();
    if (!title) {
      this.skippedCount++;
      return callback();
    }

    const assignedToName = (row.assignedTo || row.assigned_to || row["Assigned To"] || "").trim().toLowerCase();
    const statusName = (row.status || row.Status || "").trim().toLowerCase();
    const description = (row.description || row.Description || "").trim();
    const priority = (row.priority || row.Priority || "Medium").trim();

    this.batch.push({
      title,
      description,
      assignedTo: this.staffMap.get(assignedToName) || null,
      status: this.statusMap.get(statusName) || this.defaultStatusId,
      project: this.projectId || null,
      companyId: this.companyId || null,
      priority: ["Low", "Medium", "High", "Critical"].includes(priority) ? priority : "Medium",
      type: this.type,
    });

    // Only flush when we hit the batch limit
    if (this.batch.length >= this.BATCH_SIZE) {
      const toInsert = this.batch;
      this.batch = [];
      Task.insertMany(toInsert, { ordered: false })
        .then(result => {
          this.insertedCount += result.length;
          callback();
        })
        .catch(e => {
          const nInserted = e.result?.result?.nInserted ?? e.result?.nInserted ?? 0;
          this.insertedCount += nInserted;
          this.skippedCount += toInsert.length - nInserted;
          console.error("Batch insert error:", e.message);
          callback(); // Don't pass error — continue processing remaining rows
        });
    } else {
      callback();
    }
  }

  _flush(callback) {
    if (this.batch.length === 0) return callback();
    const toInsert = this.batch;
    this.batch = [];
    Task.insertMany(toInsert, { ordered: false })
      .then(result => {
        this.insertedCount += result.length;
        callback();
      })
      .catch(e => {
        const nInserted = e.result?.result?.nInserted ?? e.result?.nInserted ?? 0;
        this.insertedCount += nInserted;
        this.skippedCount += toInsert.length - nInserted;
        console.error("Final batch insert error:", e.message);
        callback();
      });
  }
}

// ────────── Bulk Upload ──────────
router.post(
  "/bulk-upload",
  authMiddleware,
  checkAnyPermission(["task_management", "issue"], "create"),
  csvUpload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Set a long timeout for large uploads (30 minutes)
    req.setTimeout(30 * 60 * 1000);
    res.setTimeout(30 * 60 * 1000);

    const type = (req.query.type === "issue") ? "issue" : "task";
    const projectId = req.query.project || null;
    const filePath = req.file.path;

    let inserted = 0;
    let skipped = 0;
    let totalRows = 0;

    try {
      // ── Load lookup maps ONCE ──────────────────────────────────────────────
      const [allStaff, allStatuses] = await Promise.all([
        Staff.find({}, "_id name email"),
        TaskStatus.find({}, "_id name"),
      ]);

      const staffMap = new Map();
      allStaff.forEach(s => {
        staffMap.set(s.name.trim().toLowerCase(), s._id);
        if (s.email) staffMap.set(s.email.trim().toLowerCase(), s._id);
      });

      const statusMap = new Map();
      allStatuses.forEach(s => statusMap.set(s.name.trim().toLowerCase(), s._id));
      const defaultStatusId = statusMap.get("active") || null;

      // Create the custom transform stream
      let companyId = req.user.companyId?._id || req.user.companyId;
      const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com";
      const isSuperAdmin = req.user?.email === SUPERADMIN_EMAIL || req.user?.role?.name === "Super Admin";

      if (isSuperAdmin && !companyId) {
        companyId = req.body.companyId || req.query.companyId;
      }

      const batchInsertStream = new BatchInsertTransform(
        {}, staffMap, statusMap, defaultStatusId, projectId, companyId, type
      );

      // Use stream.pipeline for proper error handling and backpressure
      await pipeline(
        fs.createReadStream(filePath),
        csv.parse({ headers: true, trim: true, ignoreEmpty: true }),
        batchInsertStream
      );

      inserted = batchInsertStream.insertedCount;
      skipped = batchInsertStream.skippedCount;
      totalRows = batchInsertStream.totalRows;

      fs.unlink(filePath, () => { }); // Clean up the uploaded file

      res.json({
        success: true,
        message: `Bulk upload complete! ${inserted} ${type}s inserted, ${skipped} rows skipped.`,
        inserted,
        skipped,
        total: totalRows,
      });
    } catch (err) {
      fs.unlink(filePath, () => { }); // Clean up the uploaded file even on error
      console.error("Bulk upload error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ================= SUBTASKS MANAGEMENT =================
router.post("/:id/subtasks", authMiddleware, async (req, res) => {
  try {
    const { title, description, status, assignedTo, startDate, endDate, hours } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Subtask title is required" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    task.subtasks.push({
      title: title.trim(),
      description: description || "",
      status: status || "Pending",
      assignedTo: assignedTo || null,
      startDate: startDate || null,
      endDate: endDate || null,
      hours: parseFloat(hours) || 0
    });

    await task.save();
    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("status", "name")
      .populate("project", "name");

    const io = req.app.get("io");
    if (io) io.emit("task:updated", populated);

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/subtasks/:subtaskId", authMiddleware, async (req, res) => {
  try {
    const { title, description, status, assignedTo, startDate, endDate, hours } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ error: "Subtask not found" });

    if (title !== undefined) subtask.title = title.trim();
    if (description !== undefined) subtask.description = description;
    if (status !== undefined) subtask.status = status;
    if (assignedTo !== undefined) subtask.assignedTo = assignedTo || null;
    if (startDate !== undefined) subtask.startDate = startDate || null;
    if (endDate !== undefined) subtask.endDate = endDate || null;
    if (hours !== undefined) subtask.hours = parseFloat(hours) || 0;

    await task.save();
    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("status", "name")
      .populate("project", "name");

    const io = req.app.get("io");
    if (io) io.emit("task:updated", populated);

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id/subtasks/:subtaskId", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    task.subtasks.pull(req.params.subtaskId);
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("status", "name")
      .populate("project", "name");

    const io = req.app.get("io");
    if (io) io.emit("task:updated", populated);

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;