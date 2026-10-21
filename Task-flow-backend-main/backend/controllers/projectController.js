const { pool } = require("../config/mysqlDb");
const { sendProjectMail } = require("../config/mail");

// Helper: fetch staff details for assigned users
const getAssignedStaffObjects = async (assignedIds) => {
  if (!Array.isArray(assignedIds) || assignedIds.length === 0) return [];
  try {
    const [rows] = await pool.query("SELECT id, name, email, position FROM staff");
    return assignedIds.map(id => {
      const found = rows.find(r => r.id === id || r.id === String(id) || r.email === id);
      if (found) {
        return { _id: found.id, id: found.id, name: found.name, email: found.email, position: found.position };
      }
      return { _id: id, id: id, name: "Staff Member", email: "" };
    });
  } catch (e) {
    return assignedIds.map(id => ({ _id: id, id: id, name: "Staff Member", email: "" }));
  }
};

exports.createProject = async (req, res) => {
  try {
    const { name, description, assignedTo, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Project name is required" });

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const assignedArray = Array.isArray(assignedTo) ? assignedTo : [];
    const assignedUsers = await getAssignedStaffObjects(assignedArray);

    await pool.query(
      `INSERT INTO projects (id, name, description, status, assigned_to)
       VALUES (?, ?, ?, ?, ?)`,
      [projectId, name.trim(), description || "", status || "Active", JSON.stringify(assignedUsers)]
    );

    // Send emails
    for (const user of assignedUsers) {
      if (user.email) {
        try {
          sendProjectMail(user.email, user.name, name, description || "");
        } catch (e) {}
      }
    }

    res.status(201).json({
      _id: projectId,
      id: projectId,
      name,
      description,
      status: status || "Active",
      assignedTo: assignedUsers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM projects ORDER BY created_at DESC");
    const formatted = rows.map(p => {
      let assigned = [];
      if (p.assigned_to) {
        try {
          assigned = typeof p.assigned_to === "string" ? JSON.parse(p.assigned_to) : p.assigned_to;
        } catch (e) {
          assigned = [];
        }
      }
      return {
        ...p,
        _id: p.id,
        assignedTo: assigned
      };
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProject = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: "Project not found" });

    const p = rows[0];
    let assigned = [];
    if (p.assigned_to) {
      try {
        assigned = typeof p.assigned_to === "string" ? JSON.parse(p.assigned_to) : p.assigned_to;
      } catch (e) {
        assigned = [];
      }
    }

    res.json({
      ...p,
      _id: p.id,
      assignedTo: assigned
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { name, description, assignedTo, status } = req.body;

    const assignedArray = Array.isArray(assignedTo) ? assignedTo : [];
    const assignedUsers = await getAssignedStaffObjects(assignedArray);

    await pool.query(
      `UPDATE projects SET 
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         status = COALESCE(?, status),
         assigned_to = COALESCE(?, assigned_to)
       WHERE id = ?`,
      [name, description, status, JSON.stringify(assignedUsers), projectId]
    );

    const [rows] = await pool.query("SELECT * FROM projects WHERE id = ?", [projectId]);
    const p = rows[0];
    let assigned = [];
    if (p.assigned_to) {
      try {
        assigned = typeof p.assigned_to === "string" ? JSON.parse(p.assigned_to) : p.assigned_to;
      } catch (e) {
        assigned = [];
      }
    }

    res.json({
      ...p,
      _id: p.id,
      assignedTo: assigned
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    await pool.query("DELETE FROM projects WHERE id = ?", [req.params.id]);
    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
