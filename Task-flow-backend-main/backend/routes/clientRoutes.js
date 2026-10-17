const express = require("express");
const router = express.Router();
const Client = require("../models/Client");
const authMiddleware = require("../middleware/auth");

// ─── Simple Helper ──────────────────────────────────────────
const resolveCid = (req) => {
  if (req.query?.companyId && req.query.companyId !== "undefined") return req.query.companyId;
  if (req.body?.companyId && req.body.companyId !== "undefined") return req.body.companyId;
  const userCid = req.user?.companyId?._id || req.user?.companyId;
  return userCid ? userCid.toString() : null;
};

// ─── GET ALL (Simplified) ────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const cid = resolveCid(req);
    console.log("🔍 Checking clients for CID:", cid);

    const isSuperAdmin = req.user?.email === "gadanipranav@gmail.com" || req.user?.role?.name === "Super Admin";
    
    let query = {};
    if (cid) {
      query.companyId = cid;
    } else if (!isSuperAdmin) {
      return res.json([]);
    }

    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .populate("projects", "name");
    res.json(clients);
  } catch (err) {
    console.error("❌ CLIENT_GET_ERROR:", err);
    res.status(500).json({ message: "DB Error: " + err.message });
  }
});

// ─── CREATE (Simplified) ─────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  try {
    const cid = resolveCid(req);
    const { name, email } = req.body;

    if (!name || !email || !cid) {
      return res.status(400).json({ message: "Name, Email, and CompanyID are required" });
    }

    const newClient = new Client({
      ...req.body,
      companyId: cid,
      createdBy: req.user?._id
    });

    await newClient.save();
    res.status(201).json(newClient);
  } catch (err) {
    console.error("❌ CLIENT_POST_ERROR:", err);
    res.status(500).json({ message: "Save Error: " + err.message });
  }
});

// Re-adding other basic routes
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const cid = resolveCid(req);
    const updated = await Client.findOneAndUpdate({ _id: req.params.id, companyId: cid }, req.body, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const cid = resolveCid(req);
    await Client.findOneAndDelete({ _id: req.params.id, companyId: cid });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
