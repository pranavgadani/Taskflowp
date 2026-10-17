const TaskStatus = require("../models/TaskStatus");

exports.getAll = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.email === "gadanipranav@gmail.com" || req.user?.role?.name === "Super Admin";
    const companyId = req.user?.companyId?._id || req.user?.companyId || null;

    let filter = {};
    const targetCompanyId = isSuperAdmin ? (req.query.companyId && req.query.companyId !== "undefined" ? req.query.companyId : null) : companyId;

    if (targetCompanyId) {
        filter.$or = [
            { companyId: targetCompanyId },
            { companyId: null }
        ];
    } else {
        // If no specifically targeted company, we still want to see global ones
        // but for superadmin we usually want to see EVERYTHING.
        if (!isSuperAdmin) {
            filter.companyId = null; // Should never happen based on auth
        }
    }

    if (req.query.project && req.query.project !== "undefined") {
        const projectQuery = {
            $or: [
                { project: req.query.project },
                { project: null },
                { project: { $exists: false } }
            ]
        };
        
        if (filter.$or) {
            filter = { $and: [ { $or: filter.$or }, projectQuery ] };
        } else {
            filter = projectQuery;
        }
    }

    const data = await TaskStatus.find(filter).populate("project");
    res.json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, status, project } = req.body;
    const isSuperAdmin = req.user.email === (process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com") || req.user.role?.name === "Super Admin";
    let companyId = req.user.companyId?._id || req.user.companyId;

    if (isSuperAdmin && !companyId) {
      companyId = req.body.companyId || req.query.companyId || null;
    }

    if (!name) {
      return res.status(400).json({ message: "Name required" });
    }

    const newStatus = new TaskStatus({
      name,
      status: status || "Active",
      project: project || null,
      companyId: companyId
    });

    await newStatus.save();

    res.json(newStatus);
  } catch (err) {
    console.log("CREATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    const companyId = req.user.companyId?._id || req.user.companyId;

    const query = { _id: req.params.id };
    if (!isSuperAdmin) query.companyId = companyId;

    const data = await TaskStatus.findOneAndUpdate(
      query,
      req.body,
      { returnDocument: 'after' }
    );
    
    if (!data) return res.status(404).json({ error: "Task Status not found" });
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    const companyId = req.user.companyId?._id || req.user.companyId;

    const query = { _id: req.params.id };
    if (!isSuperAdmin) query.companyId = companyId;

    const data = await TaskStatus.findOneAndDelete(query);
    if (!data) return res.status(404).json({ error: "Task Status not found" });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};