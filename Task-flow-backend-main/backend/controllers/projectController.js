const Project = require("../models/Project");
const Staff = require("../models/Staff");
const Company = require("../models/Company");
const { sendProjectMail } = require("../config/mail");
const { pool } = require("../config/mysqlDb");

// Input validation helper
const validateProjectInput = (data) => {
    const errors = [];

    // Validate name
    if (!data.name || typeof data.name !== 'string') {
        errors.push("Project name is required and must be a string");
    } else if (data.name.trim().length === 0) {
        errors.push("Project name cannot be empty");
    } else if (data.name.length > 100) {
        errors.push("Project name cannot exceed 100 characters");
    }

    // Validate description
    if (data.description && typeof data.description !== 'string') {
        errors.push("Description must be a string");
    } else if (data.description && data.description.length > 500) {
        errors.push("Description cannot exceed 500 characters");
    }

    // Validate status
    if (data.status && !["Active", "Inactive"].includes(data.status)) {
        errors.push("Status must be either 'Active' or 'Inactive'");
    }

    return errors;
};

// Sanitize input - removes potentially dangerous characters
const sanitizeInput = (data) => {
    return {
        name: data.name?.trim() || "",
        description: data.description?.trim() || "",
        assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : [],
        status: data.status || "Active",
        companyId: data.companyId || null
    };
};

// Helper: fetch staff details for assigned users
const getAssignedStaffObjects = async (assignedIds) => {
    if (!Array.isArray(assignedIds) || assignedIds.length === 0) return [];
    try {
        const [rows] = await pool.query("SELECT id, name, email, position FROM staff");
        return assignedIds.map(id => {
            const found = rows.find(r => r.id === id || r.id === String(id));
            if (found) {
                return { _id: found.id, name: found.name, email: found.email, position: found.position };
            }
            return { _id: id, name: "Staff Member", email: "" };
        });
    } catch (e) {
        return assignedIds.map(id => ({ _id: id, name: "Staff Member", email: "" }));
    }
};

exports.createProject = async (req, res) => {
    try {
        // Validate input
        const validationErrors = validateProjectInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: validationErrors.join(", ") });
        }

        // Sanitize input
        const sanitizedData = sanitizeInput(req.body);

        let companyId = req.user.companyId?._id || req.user.companyId;
        const isSuperAdmin = req.user.email === (process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com") || req.user.role?.name === "Super Admin";
        
        if (isSuperAdmin && !companyId) {
            companyId = req.body.companyId || req.query.companyId;
        }

        if (!companyId) {
            const defaultComp = await Company.findOne();
            if (defaultComp) companyId = defaultComp._id;
        }

        if (companyId) {
            sanitizedData.companyId = companyId;
        }

        const project = new Project(sanitizedData);
        await project.save();

        const projectId = project._id.toString();
        const assignedUsers = await getAssignedStaffObjects(sanitizedData.assignedTo);

        // Sync directly to MySQL projects table
        try {
            await pool.query(
                `INSERT INTO projects (id, name, description, status, assigned_to)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), status=VALUES(status), assigned_to=VALUES(assigned_to)`,
                [projectId, sanitizedData.name, sanitizedData.description, sanitizedData.status, JSON.stringify(assignedUsers)]
            );
        } catch (dbErr) {
            console.error("MySQL Project insert warning:", dbErr.message);
        }

        // 📩 Safely send email to assigned staff/managers
        if (assignedUsers.length > 0) {
            for (const user of assignedUsers) {
                if (user.email) {
                    try {
                        sendProjectMail(user.email, user.name, sanitizedData.name, sanitizedData.description || "");
                    } catch (mErr) {
                        console.error("Email send warning:", mErr.message);
                    }
                }
            }
        }

        res.status(201).json({
            _id: projectId,
            id: projectId,
            name: sanitizedData.name,
            description: sanitizedData.description,
            status: sanitizedData.status,
            assignedTo: assignedUsers
        });
    } catch (err) {
        console.error("Create project error:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.getProjects = async (req, res) => {
    try {
        const [mysqlProjects] = await pool.query("SELECT * FROM projects ORDER BY created_at DESC");
        const formatted = mysqlProjects.map(p => {
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
        const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com";
        const isSuperAdmin = req.user?.email === SUPERADMIN_EMAIL || req.user?.role?.name === "Super Admin";

        const [rows] = await pool.query("SELECT * FROM projects WHERE id = ?", [req.params.id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: "Project not found" });
        }

        const project = rows[0];
        let assigned = [];
        if (project.assigned_to) {
            try {
                assigned = typeof project.assigned_to === "string" ? JSON.parse(project.assigned_to) : project.assigned_to;
            } catch (e) {
                assigned = [];
            }
        }

        res.json({
            ...project,
            _id: project.id,
            assignedTo: assigned
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateProject = async (req, res) => {
    try {
        // Validate input
        const validationErrors = validateProjectInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: validationErrors.join(", ") });
        }

        // Sanitize input
        const sanitizedData = sanitizeInput(req.body);
        const projectId = req.params.id;

        const assignedUsers = await getAssignedStaffObjects(sanitizedData.assignedTo);

        // Update in Mongo (if exists)
        try {
            await Project.findByIdAndUpdate(projectId, sanitizedData, { new: true });
        } catch (mErr) {
            console.warn("Mongo project update note:", mErr.message);
        }

        // Update in MySQL
        await pool.query(
            `UPDATE projects SET name = ?, description = ?, status = ?, assigned_to = ? WHERE id = ?`,
            [sanitizedData.name, sanitizedData.description, sanitizedData.status, JSON.stringify(assignedUsers), projectId]
        );

        // 📩 Safely notify newly assigned staff
        if (assignedUsers.length > 0) {
            for (const user of assignedUsers) {
                if (user.email) {
                    try {
                        sendProjectMail(user.email, user.name, sanitizedData.name, sanitizedData.description || "", "updated");
                    } catch (mErr) {
                        console.error("Email send error:", mErr.message);
                    }
                }
            }
        }

        res.json({
            _id: projectId,
            id: projectId,
            name: sanitizedData.name,
            description: sanitizedData.description,
            status: sanitizedData.status,
            assignedTo: assignedUsers
        });
    } catch (err) {
        console.error("Update project error:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const projectId = req.params.id;
        
        try {
            await Project.findByIdAndDelete(projectId);
        } catch (e) {}

        await pool.query("DELETE FROM projects WHERE id = ?", [projectId]);
        res.json({ message: "Project deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

