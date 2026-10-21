const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("fast-csv");

const { pool } = require("../config/mysqlDb");
const { sendTaskOrIssueMail } = require("../config/mail");
const { checkAnyPermission } = require("../middleware/permissions");
const authMiddleware = require("../middleware/auth");
const { checkPlanLimit } = require("../middleware/subscriptionLimits");

// FILE STORAGE
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Helper: map a raw MySQL task row + its subtasks into frontend shape
function formatTask(taskRow, subtasksList = []) {
  const taskSubtasks = subtasksList
    .filter(s => s.task_id === taskRow.id)
    .map(s => ({
      _id: s.id,
      id: s.id,
      title: s.title,
      description: s.description || "",
      status: s.status || "Pending",
      assignedTo: s.assigned_to,
      startDate: s.start_date,
      endDate: s.end_date,
      hours: parseFloat(s.hours) || 0
    }));

  return {
    _id: taskRow.id,
    id: taskRow.id,
    title: taskRow.title,
    description: taskRow.description || "",
    status: {
      _id: taskRow.status_id || taskRow.status,
      id: taskRow.status_id || taskRow.status,
      name: taskRow.status_name || taskRow.status || "Pending"
    },
    priority: taskRow.priority || "Medium",
    project: taskRow.project_id ? {
      _id: taskRow.project_id,
      id: taskRow.project_id,
      name: taskRow.project_name || "Project"
    } : null,
    assignedTo: taskRow.assigned_id ? [{
      _id: taskRow.assigned_id,
      id: taskRow.assigned_id,
      name: taskRow.assigned_name || "Staff",
      email: taskRow.assigned_email || ""
    }] : [],
    type: taskRow.type || "task",
    startDate: taskRow.start_date,
    endDate: taskRow.end_date,
    calculatedEndDate: taskRow.calculated_end_date || taskRow.end_date,
    estimatedHours: parseFloat(taskRow.estimated_hours) || 0,
    subtasks: taskSubtasks,
    image: taskRow.image || "",
    video: taskRow.video || "",
    createdAt: taskRow.created_at
  };
}

// ================= GET TASKS =================
router.get("/", authMiddleware, checkAnyPermission(["task_management", "issue"], "read"), async (req, res) => {
  try {
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com";
    const isSuperAdmin = req.user?.email === SUPERADMIN_EMAIL || req.user?.role?.name === "Super Admin";
    const isCompanyOwner = req.user?.role?.name === "Company Owner";

    let conditions = ["1=1"];
    let params = [];

    // Filter by project
    if (req.query.project && req.query.project !== "undefined") {
      conditions.push("t.project = ?");
      params.push(req.query.project);
    }

    // Role-based scoping for developers
    if (!isSuperAdmin && !isCompanyOwner) {
      // Find projects assigned to this user
      const [projRows] = await pool.query("SELECT id, assigned_to FROM projects");
      const userProjectIds = projRows
        .filter(p => {
          if (!p.assigned_to) return false;
          try {
            const list = typeof p.assigned_to === "string" ? JSON.parse(p.assigned_to) : p.assigned_to;
            return list.some(u => u._id === req.user.id || u.id === req.user.id || u.email === req.user.email);
          } catch (e) { return false; }
        })
        .map(p => p.id);

      if (userProjectIds.length > 0) {
        conditions.push(`(t.project IN (${userProjectIds.map(() => "?").join(",")}) OR t.assigned_to = ?)`);
        params.push(...userProjectIds, req.user.id);
      } else {
        conditions.push("t.assigned_to = ?");
        params.push(req.user.id);
      }
    }

    // Type filter
    if (req.query.type === "issue") {
      conditions.push("t.type = 'issue'");
    } else {
      conditions.push("(t.type = 'task' OR t.type IS NULL)");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT t.*,
             p.id as project_id, p.name as project_name,
             s.id as assigned_id, s.name as assigned_name, s.email as assigned_email,
             ts.id as status_id, ts.name as status_name
      FROM tasks t
      LEFT JOIN projects p ON t.project = p.id
      LEFT JOIN staff s ON t.assigned_to = s.id
      LEFT JOIN task_statuses ts ON t.status = ts.id OR t.status = ts.name
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT 1000
    `;

    const [rows] = await pool.query(query, params);

    // Fetch subtasks for these tasks
    let subtasks = [];
    if (rows.length > 0) {
      const taskIds = rows.map(r => r.id);
      const [subRows] = await pool.query(
        `SELECT * FROM subtasks WHERE task_id IN (${taskIds.map(() => "?").join(",")})`,
        taskIds
      );
      subtasks = subRows;
    }

    const formatted = rows.map(r => formatTask(r, subtasks));

    if (req.query.page && req.query.limit) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const start = (page - 1) * limit;
      const paginated = formatted.slice(start, start + limit);
      return res.json({
        tasks: paginated,
        totalCount: formatted.length,
        totalPages: Math.ceil(formatted.length / limit),
        currentPage: page
      });
    }

    res.json(formatted);
  } catch (err) {
    console.error("GET tasks error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADD TASK =================
router.post(
  "/",
  authMiddleware,
  checkAnyPermission(["task_management", "issue"], "create"),
  checkPlanLimit("task"),
  upload.fields([{ name: "image" }, { name: "video" }]),
  async (req, res) => {
    try {
      const {
        title, description, assignedTo, status, project, priority,
        type, startDate, endDate, estimatedHours, calculatedEndDate, subtasks
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Title is required" });
      }

      const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const image = req.files?.image?.[0]?.filename || null;
      const video = req.files?.video?.[0]?.filename || null;

      let assignedVal = "";
      if (Array.isArray(assignedTo)) {
        assignedVal = assignedTo[0] || "";
      } else if (typeof assignedTo === "string") {
        assignedVal = assignedTo;
      }

      await pool.query(
        `INSERT INTO tasks (
          id, title, description, status, priority, project, assigned_to,
          due_date, start_date, end_date, type, image, video, estimated_hours, calculated_end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          title.trim(),
          description || "",
          status || "In Progress",
          priority || "Medium",
          project || null,
          assignedVal || null,
          endDate || calculatedEndDate || null,
          startDate || null,
          endDate || null,
          type || "task",
          image,
          video,
          parseFloat(estimatedHours) || 0,
          calculatedEndDate || endDate || null
        ]
      );

      // Save subtasks if provided
      let parsedSubtasks = [];
      if (subtasks) {
        try {
          parsedSubtasks = typeof subtasks === "string" ? JSON.parse(subtasks) : subtasks;
        } catch (e) { parsedSubtasks = []; }
      }

      if (Array.isArray(parsedSubtasks) && parsedSubtasks.length > 0) {
        for (const sub of parsedSubtasks) {
          const subId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          await pool.query(
            `INSERT INTO subtasks (id, task_id, title, description, status, assigned_to, start_date, end_date, hours)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              subId, id, sub.title, sub.description || "", sub.status || "Pending",
              sub.assignedTo || null, sub.startDate || null, sub.endDate || null, parseFloat(sub.hours) || 0
            ]
          );
        }
      }

      // Fetch created task
      const [rows] = await pool.query(
        `SELECT t.*,
                p.id as project_id, p.name as project_name,
                s.id as assigned_id, s.name as assigned_name, s.email as assigned_email,
                ts.id as status_id, ts.name as status_name
         FROM tasks t
         LEFT JOIN projects p ON t.project = p.id
         LEFT JOIN staff s ON t.assigned_to = s.id
         LEFT JOIN task_statuses ts ON t.status = ts.id OR t.status = ts.name
         WHERE t.id = ?`,
        [id]
      );

      const [subRows] = await pool.query("SELECT * FROM subtasks WHERE task_id = ?", [id]);
      const formatted = formatTask(rows[0], subRows);

      // Email notification
      if (rows[0].assigned_email) {
        try {
          sendTaskOrIssueMail(
            rows[0].assigned_email,
            title,
            description || "",
            rows[0].assigned_name || "Staff",
            formatted.status?.name,
            type || "task"
          );
        } catch (mErr) {}
      }

      const io = req.app.get("io");
      if (io) io.emit("task:created", formatted);

      res.status(201).json(formatted);
    } catch (err) {
      console.error("Create task error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ================= UPDATE TASK =================
router.put(
  "/:id",
  authMiddleware,
  checkAnyPermission(["task_management", "issue"], "update"),
  upload.fields([{ name: "image" }, { name: "video" }]),
  async (req, res) => {
    try {
      const taskId = req.params.id;
      const {
        title, description, assignedTo, status, project, priority,
        type, startDate, endDate, estimatedHours, calculatedEndDate
      } = req.body;

      let assignedVal = undefined;
      if (Array.isArray(assignedTo)) {
        assignedVal = assignedTo[0];
      } else if (assignedTo !== undefined) {
        assignedVal = assignedTo;
      }

      await pool.query(
        `UPDATE tasks SET
           title = COALESCE(?, title),
           description = COALESCE(?, description),
           status = COALESCE(?, status),
           priority = COALESCE(?, priority),
           project = COALESCE(?, project),
           assigned_to = COALESCE(?, assigned_to),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           type = COALESCE(?, type),
           estimated_hours = COALESCE(?, estimated_hours),
           calculated_end_date = COALESCE(?, calculated_end_date)
         WHERE id = ?`,
        [
          title, description, status, priority, project, assignedVal,
          startDate, endDate, type, estimatedHours, calculatedEndDate, taskId
        ]
      );

      const [rows] = await pool.query(
        `SELECT t.*,
                p.id as project_id, p.name as project_name,
                s.id as assigned_id, s.name as assigned_name, s.email as assigned_email,
                ts.id as status_id, ts.name as status_name
         FROM tasks t
         LEFT JOIN projects p ON t.project = p.id
         LEFT JOIN staff s ON t.assigned_to = s.id
         LEFT JOIN task_statuses ts ON t.status = ts.id OR t.status = ts.name
         WHERE t.id = ?`,
        [taskId]
      );

      if (!rows || rows.length === 0) return res.status(404).json({ error: "Task not found" });

      const [subRows] = await pool.query("SELECT * FROM subtasks WHERE task_id = ?", [taskId]);
      const formatted = formatTask(rows[0], subRows);

      const io = req.app.get("io");
      if (io) io.emit("task:updated", formatted);

      res.json(formatted);
    } catch (err) {
      console.error("Update task error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ================= DELETE TASK =================
router.delete("/:id", authMiddleware, checkAnyPermission(["task_management", "issue"], "delete"), async (req, res) => {
  try {
    const taskId = req.params.id;
    await pool.query("DELETE FROM subtasks WHERE task_id = ?", [taskId]);
    await pool.query("DELETE FROM tasks WHERE id = ?", [taskId]);

    const io = req.app.get("io");
    if (io) io.emit("task:deleted", { _id: taskId, id: taskId });

    res.json({ message: "Task deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SUBTASKS MANAGEMENT =================
router.post("/:id/subtasks", authMiddleware, async (req, res) => {
  try {
    const { title, description, status, assignedTo, startDate, endDate, hours } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "Subtask title is required" });

    const taskId = req.params.id;
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    await pool.query(
      `INSERT INTO subtasks (id, task_id, title, description, status, assigned_to, start_date, end_date, hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subId, taskId, title.trim(), description || "", status || "Pending", assignedTo || null, startDate || null, endDate || null, parseFloat(hours) || 0]
    );

    const [rows] = await pool.query(
      `SELECT t.*,
              p.id as project_id, p.name as project_name,
              s.id as assigned_id, s.name as assigned_name, s.email as assigned_email,
              ts.id as status_id, ts.name as status_name
       FROM tasks t
       LEFT JOIN projects p ON t.project = p.id
       LEFT JOIN staff s ON t.assigned_to = s.id
       LEFT JOIN task_statuses ts ON t.status = ts.id OR t.status = ts.name
       WHERE t.id = ?`,
      [taskId]
    );

    const [subRows] = await pool.query("SELECT * FROM subtasks WHERE task_id = ?", [taskId]);
    const formatted = formatTask(rows[0], subRows);

    const io = req.app.get("io");
    if (io) io.emit("task:updated", formatted);

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/subtasks/:subtaskId", authMiddleware, async (req, res) => {
  try {
    const { title, description, status, assignedTo, startDate, endDate, hours } = req.body;
    const { id: taskId, subtaskId } = req.params;

    await pool.query(
      `UPDATE subtasks SET
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         status = COALESCE(?, status),
         assigned_to = COALESCE(?, assigned_to),
         start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date),
         hours = COALESCE(?, hours)
       WHERE id = ?`,
      [title, description, status, assignedTo, startDate, endDate, hours, subtaskId]
    );

    const [rows] = await pool.query(
      `SELECT t.*,
              p.id as project_id, p.name as project_name,
              s.id as assigned_id, s.name as assigned_name, s.email as assigned_email,
              ts.id as status_id, ts.name as status_name
       FROM tasks t
       LEFT JOIN projects p ON t.project = p.id
       LEFT JOIN staff s ON t.assigned_to = s.id
       LEFT JOIN task_statuses ts ON t.status = ts.id OR t.status = ts.name
       WHERE t.id = ?`,
      [taskId]
    );

    const [subRows] = await pool.query("SELECT * FROM subtasks WHERE task_id = ?", [taskId]);
    const formatted = formatTask(rows[0], subRows);

    const io = req.app.get("io");
    if (io) io.emit("task:updated", formatted);

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id/subtasks/:subtaskId", authMiddleware, async (req, res) => {
  try {
    const { id: taskId, subtaskId } = req.params;
    await pool.query("DELETE FROM subtasks WHERE id = ?", [subtaskId]);

    const [rows] = await pool.query(
      `SELECT t.*,
              p.id as project_id, p.name as project_name,
              s.id as assigned_id, s.name as assigned_name, s.email as assigned_email,
              ts.id as status_id, ts.name as status_name
       FROM tasks t
       LEFT JOIN projects p ON t.project = p.id
       LEFT JOIN staff s ON t.assigned_to = s.id
       LEFT JOIN task_statuses ts ON t.status = ts.id OR t.status = ts.name
       WHERE t.id = ?`,
      [taskId]
    );

    const [subRows] = await pool.query("SELECT * FROM subtasks WHERE task_id = ?", [taskId]);
    const formatted = formatTask(rows[0], subRows);

    const io = req.app.get("io");
    if (io) io.emit("task:updated", formatted);

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;