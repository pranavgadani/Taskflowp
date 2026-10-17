const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Document = require("../models/Document");
const Staff = require("../models/Staff");
const authMiddleware = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const { sendDocumentMail, sendAccessRequestMail } = require("../config/mail");

const APP_LINK = process.env.APP_URL || "http://localhost:5173";
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com";

// File storage
const storage = multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) =>
        cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ================= GET DOCUMENTS =================
router.get("/", authMiddleware, async (req, res) => {
    try {
        const isSuperAdmin =
            req.user?.email === SUPERADMIN_EMAIL ||
            req.user?.role?.name === "Super Admin";

        let companyId = req.user.companyId?._id || req.user.companyId || req.query.companyId;

        let filter = {
            $or: [
                { companyId: companyId },
                { companyId: { $exists: false } },
                { companyId: null }
            ]
        };

        if (req.query.project) filter.project = req.query.project;

        if (!isSuperAdmin) {
            const userRole = req.user?.role?.name?.toLowerCase() || "";
            const isCompanyOwner = userRole.includes("company owner") || userRole.includes("admin");
            const isStaff = userRole.includes("staff");
            const isManager = userRole.includes("manager");

            if (isCompanyOwner) {
                // Company Owner sees ALL documents in their company
                filter = { companyId };
                if (req.query.project) filter.project = req.query.project;
            } else {
                // Staff/Managers see strictly assigned or allowed docs
                filter = { companyId };
                if (req.query.project) filter.project = req.query.project;

                // Get user's assigned projects
                const Project = require("../models/Project");
                const assignedProjects = await Project.find({ assignedTo: req.user._id }).select("_id");
                const projectIds = assignedProjects.map(p => p._id.toString());

                // If a specific project is requested, user MUST be assigned to it
                if (req.query.project && !projectIds.includes(req.query.project.toString())) {
                    return res.json([]);
                }

                const allowedRoles = ["All"];
                if (isStaff) allowedRoles.push("Staff");
                if (isManager) allowedRoles.push("Manager");

                filter.$or = [
                    { assignedTo: req.user._id },
                    { project: { $in: projectIds } },
                    {
                        $and: [
                            { $or: [{ project: { $exists: false } }, { project: null }] },
                            { access: { $in: allowedRoles } }
                        ]
                    }
                ];
            }
        }

        const docs = await Document.find(filter)
            .populate("assignedTo", "name email position")
            .populate("project", "name");

        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= CREATE DOCUMENT =================
router.post("/", authMiddleware, upload.single("file"), async (req, res) => {
    try {
        const { documentType, description, access, project, textType } = req.body;
        let assignedTo = req.body.assignedTo;
        if (assignedTo && !Array.isArray(assignedTo)) assignedTo = [assignedTo];

        // Normalize content to expected array of objects format
        let contentArr = [];
        if (req.body.content) {
            try {
                const parsed = JSON.parse(req.body.content);
                if (Array.isArray(parsed)) {
                    contentArr = parsed;
                } else if (typeof parsed === 'string') {
                    contentArr = [{ content: parsed }];
                }
            } catch (e) {
                // If it's not JSON, treat raw body as a single page content
                contentArr = [{ content: req.body.content }];
            }
        }

        let companyId = req.user.companyId?._id || req.user.companyId;
        const isSuperAdmin = req.user.email === SUPERADMIN_EMAIL || req.user.role?.name === "Super Admin";

        if (isSuperAdmin && !companyId) {
            companyId = req.body.companyId || req.query.companyId;
        }

        const mongoose = require("mongoose");
        if (!companyId && project && mongoose.Types.ObjectId.isValid(project)) {
            const Project = require("../models/Project");
            const p = await Project.findById(project);
            if (p) companyId = p.companyId;
        }

        if (!companyId) {
            // Final fallback: try to get companyId from req.query if still not set
             companyId = req.query.companyId;
        }

        const docValue = {
            documentType: documentType || "Notes",
            description,
            access: access || "All",
            project: (project && mongoose.Types.ObjectId.isValid(project)) ? project : null,
            assignedTo: assignedTo || [],
            file: req.file ? req.file.filename : null,
            accessGranted: req.body.accessGranted === "true",
            textType: textType || "upload",
            content: contentArr,
            companyId: (companyId && mongoose.Types.ObjectId.isValid(companyId)) ? companyId : null
        };

        const doc = await Document.create(docValue);

        const populated = await Document.findById(doc._id)
            .populate("assignedTo", "name email position")
            .populate("project", "name");

        // 📧 Send email to assigned members (fire-and-forget)
        if (populated.assignedTo && populated.assignedTo.length > 0) {
            const redirectPath = encodeURIComponent(`/document?view=${doc._id}`);
            populated.assignedTo.forEach(member => {
                if (member.email) {
                    sendDocumentMail(
                        member.email,
                        member.name,
                        description || "",
                        `${APP_LINK}/login?redirect=${redirectPath}`
                    );
                }
            });
        }

        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= UPDATE DOCUMENT =================
router.put("/:id", authMiddleware, upload.single("file"), async (req, res) => {
    try {
        const { documentType, description, access, project, textType } = req.body;
        let assignedTo = req.body.assignedTo;
        if (assignedTo && !Array.isArray(assignedTo)) assignedTo = [assignedTo];

        // Normalize content specifically for doc/notepad modes
        let contentArr = [];
        if (req.body.content) {
            try {
                const parsed = JSON.parse(req.body.content);
                if (Array.isArray(parsed)) {
                    contentArr = parsed;
                } else if (typeof parsed === 'string') {
                    contentArr = [{ content: parsed }];
                }
            } catch (e) {
                contentArr = [{ content: req.body.content }];
            }
        }

        const oldDoc = await Document.findById(req.params.id);
        if (!oldDoc) return res.status(404).json({ error: "Document not found" });

        const oldAssignedTo = (oldDoc.assignedTo || []).map(id => id.toString());

        const update = {
            documentType,
            description,
            access: access || "All",
            project: project || null,
            assignedTo: assignedTo || [],
            accessGranted: req.body.accessGranted === "true",
            textType: textType || "upload",
            content: contentArr
        };

        if (req.file) update.file = req.file.filename;
        else if (textType && textType !== 'upload') update.file = null; 

        // SuperAdmin might need to fix companyId if it's missing on legacy docs
        if (!oldDoc.companyId) {
            let companyId = req.user.companyId?._id || req.user.companyId || req.query.companyId || req.body.companyId;
            if (companyId) update.companyId = companyId;
        }

        const doc = await Document.findByIdAndUpdate(req.params.id, update, { new: true })
            .populate("assignedTo", "name email position")
            .populate("project", "name");

        // 📧 Send email only to *newly* assigned members
        if (doc.assignedTo && doc.assignedTo.length > 0) {
            const redirectPath = encodeURIComponent(`/document?view=${doc._id}`);
            doc.assignedTo.forEach(member => {
                const memberIdStr = member._id ? member._id.toString() : "";
                if (!oldAssignedTo.includes(memberIdStr) && member.email) {
                    sendDocumentMail(
                        member.email,
                        member.name,
                        doc.description || description || "",
                        `${APP_LINK}/login?redirect=${redirectPath}`
                    );
                }
            });
        }

        res.json(doc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= DELETE DOCUMENT =================
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        await Document.findByIdAndDelete(req.params.id);
        res.json({ message: "Document deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= REQUEST ACCESS (assigned user) =================
// Sends email to superadmin with a one-click grant link
router.post("/:id/request-access", authMiddleware, async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate("assignedTo", "name email position");

        if (!doc) return res.status(404).json({ error: "Document not found" });

        // Check user is actually assigned to this doc
        const userId = req.user._id.toString();
        const isAssigned = doc.assignedTo.some(m => (m._id || m).toString() === userId);
        if (!isAssigned) return res.status(403).json({ error: "Not assigned to this document" });

        if (doc.accessGranted) {
            return res.status(400).json({ error: "Access already granted" });
        }

        // Mark as requested
        doc.accessRequested = true;
        await doc.save();

        // Build a one-click grant link that superadmin clicks from email
        const grantLink = `${APP_LINK}/document?grant=${doc._id}`;

        // 📧 Send email to superadmin
        await sendAccessRequestMail(
            SUPERADMIN_EMAIL,
            req.user.name || req.user.email,
            req.user.email,
            doc.description || doc.documentType || "N/A",
            grantLink
        );

        const populated = await Document.findById(doc._id)
            .populate("assignedTo", "name email position")
            .populate("project", "name");

        res.json({ message: "Access request sent to admin", doc: populated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= GRANT ACCESS (Superadmin only) =================
// Grants access (sets accessGranted = true), does NOT toggle off
router.patch("/:id/access", authMiddleware, async (req, res) => {
    try {
        const isSuperAdmin =
            req.user?.email === SUPERADMIN_EMAIL ||
            req.user?.role?.name === "Super Admin";
        if (!isSuperAdmin) return res.status(403).json({ error: "Only superadmin can grant access" });

        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: "Document not found" });

        doc.accessGranted = true;
        doc.accessRequested = false; // clear request flag
        await doc.save();

        const populated = await Document.findById(doc._id)
            .populate("assignedTo", "name email position")
            .populate("project", "name");

        res.json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= REVOKE ACCESS (Superadmin only) =================
router.patch("/:id/revoke-access", authMiddleware, async (req, res) => {
    try {
        const isSuperAdmin =
            req.user?.email === SUPERADMIN_EMAIL ||
            req.user?.role?.name === "Super Admin";
        if (!isSuperAdmin) return res.status(403).json({ error: "Only superadmin can revoke access" });

        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: "Document not found" });

        doc.accessGranted = false;
        doc.accessRequested = false;
        await doc.save();

        const populated = await Document.findById(doc._id)
            .populate("assignedTo", "name email position")
            .populate("project", "name");

        res.json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
