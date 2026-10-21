const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const { pool } = require("../config/mysqlDb");

// Helper: Super Admin or Leave Manager check
const isSuperAdminOrManager = (req) => {
  if (req.user?.email === "gadanipranav@gmail.com" || req.user?.role?.name === "Super Admin" || req.user?.role === "Super Admin" || req.user?.role?.name === "Company Owner") {
    return true;
  }
  // Check role permissions if available on req.user.role
  const permissions = req.user?.role?.permissions || [];
  const leavePerm = permissions.find(p => p.value === "leave_management");
  return leavePerm ? (leavePerm.all || leavePerm.read || leavePerm.update) : false;
};

// 0. ADMIN LEAVE OVERVIEW / STATS
router.get("/admin-summary", authMiddleware, async (req, res) => {
  try {
    if (!isSuperAdminOrManager(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const today = new Date().toISOString().slice(0, 10);

    // 1. Pending Approvals
    const [[pendingRes]] = await pool.query("SELECT COUNT(*) AS count FROM leave_requests WHERE status = 'Pending'");
    // 2. Approved this month
    const [[approvedRes]] = await pool.query("SELECT COUNT(*) AS count FROM leave_requests WHERE status = 'Approved' AND MONTH(from_date) = MONTH(CURRENT_DATE()) AND YEAR(from_date) = YEAR(CURRENT_DATE())");
    // 3. Rejected
    const [[rejectedRes]] = await pool.query("SELECT COUNT(*) AS count FROM leave_requests WHERE status = 'Rejected'");
    // 4. Employees currently on leave today
    const [[onLeaveTodayRes]] = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS count FROM leave_requests 
       WHERE status = 'Approved' AND (? BETWEEN DATE(from_date) AND DATE(to_date))`,
      [today]
    );

    res.json({
      pendingCount: pendingRes?.count || 0,
      approvedThisMonth: approvedRes?.count || 0,
      rejectedCount: rejectedRes?.count || 0,
      onLeaveToday: onLeaveTodayRes?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 0.1 SUPER ADMIN & MANAGERS: GET ALL EMPLOYEE LEAVE BALANCES
router.get("/admin/balances", authMiddleware, async (req, res) => {
  try {
    if (!isSuperAdminOrManager(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const [rows] = await pool.query(
      `SELECT b.* 
       FROM leave_balances b
       INNER JOIN staff s ON b.user_id = s.id
       ORDER BY b.user_name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 0.2 SUPER ADMIN & MANAGERS: UPDATE ANY EMPLOYEE LEAVE BALANCE DYNAMICALLY
router.put("/admin/balances/:id", authMiddleware, async (req, res) => {
  try {
    if (!isSuperAdminOrManager(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { cl_balance, sl_balance, pl_balance, comp_off } = req.body;
    await pool.query(
      `UPDATE leave_balances 
       SET cl_balance = COALESCE(?, cl_balance),
           sl_balance = COALESCE(?, sl_balance),
           pl_balance = COALESCE(?, pl_balance),
           comp_off = COALESCE(?, comp_off)
       WHERE id = ?`,
      [cl_balance, sl_balance, pl_balance, comp_off, req.params.id]
    );
    res.json({ message: "Employee leave balance updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 0.3 GET COMPANY-WIDE LEAVE POLICY
router.get("/company-policy", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM company_leave_settings WHERE id = 'default_policy' LIMIT 1");
    if (rows.length === 0) {
      return res.json({ cl_default: 12, sl_default: 8, pl_default: 15, comp_off_default: 2 });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 0.4 UPDATE COMPANY-WIDE LEAVE POLICY (Option 1)
router.put("/company-policy", authMiddleware, async (req, res) => {
  try {
    if (!isSuperAdminOrManager(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { cl_default, sl_default, pl_default, comp_off_default, applyToExisting } = req.body;
    
    await pool.query(
      `INSERT INTO company_leave_settings (id, cl_default, sl_default, pl_default, comp_off_default)
       VALUES ('default_policy', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         cl_default = VALUES(cl_default),
         sl_default = VALUES(sl_default),
         pl_default = VALUES(pl_default),
         comp_off_default = VALUES(comp_off_default)`,
      [Number(cl_default) || 12, Number(sl_default) || 8, Number(pl_default) || 15, Number(comp_off_default) || 0]
    );

    // If super admin wants this policy to apply to all current employees
    if (applyToExisting) {
      await pool.query(
        `UPDATE leave_balances 
         SET cl_balance = ?, sl_balance = ?, pl_balance = ?, comp_off = ?`,
        [Number(cl_default) || 12, Number(sl_default) || 8, Number(pl_default) || 15, Number(comp_off_default) || 0]
      );
    }

    res.json({ message: "Company-Wide Leave Policy updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. GET USER LEAVE BALANCE
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userName = req.user.name || "Employee";
    const userEmail = req.user.email || "";

    // Query balance by user_id OR user_email (so seeding or login ID always matches)
    let [rows] = await pool.query(
      "SELECT * FROM leave_balances WHERE user_id = ? OR (user_email = ? AND user_email != '') LIMIT 1",
      [userId, userEmail]
    );

    // If no balance record exists yet, initialize using Company-Wide Policy defaults
    if (rows.length === 0) {
      const [policyRows] = await pool.query("SELECT * FROM company_leave_settings WHERE id = 'default_policy' LIMIT 1");
      const policy = policyRows[0] || { cl_default: 12, sl_default: 8, pl_default: 15, comp_off_default: 2 };

      const id = `bal_${Date.now()}`;
      await pool.query(
        "INSERT INTO leave_balances (id, user_id, user_name, user_email, cl_balance, sl_balance, pl_balance, comp_off) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, userId, userName, userEmail, policy.cl_default, policy.sl_default, policy.pl_default, policy.comp_off_default]
      );
      [rows] = await pool.query("SELECT * FROM leave_balances WHERE id = ?", [id]);
    } else if (rows[0].user_id !== userId && userEmail) {
      // Sync user_id if matched via email
      await pool.query("UPDATE leave_balances SET user_id = ? WHERE id = ?", [userId, rows[0].id]);
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET MY LEAVE REQUESTS
router.get("/my-leaves", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userEmail = req.user.email || "";
    const [rows] = await pool.query(
      "SELECT * FROM leave_requests WHERE user_id = ? OR (user_email = ? AND user_email != '') ORDER BY created_at DESC",
      [userId, userEmail]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. APPLY FOR LEAVE
router.post("/apply", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userName = req.user.name || "Employee";
    const userEmail = req.user.email || "";
    const { leave_type, from_date, to_date, day_type, reason } = req.body;
    if (!from_date || !to_date) {
      return res.status(400).json({ error: "From Date and To Date are required." });
    }

    const start = new Date(from_date);
    const end = new Date(to_date);

    if (end < start) {
      return res.status(400).json({ error: "'To Date' cannot be earlier than 'From Date'!" });
    }

    // Calculate days excluding weekends
    let totalDays = 0;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) { // Skip Sunday(0) and Saturday(6)
        totalDays++;
      }
    }

    if (totalDays === 0) totalDays = 1;
    if (day_type === "Half Day" || day_type === "First Half" || day_type === "Second Half") {
      totalDays = totalDays * 0.5;
    }

    // Check Balance
    const [balRows] = await pool.query("SELECT * FROM leave_balances WHERE user_id = ?", [userId]);
    const balance = balRows[0];
    if (balance) {
      if (leave_type === "Casual Leave" && balance.cl_balance < totalDays) {
        return res.status(400).json({ error: `Insufficient Casual Leave balance! Available: ${balance.cl_balance}` });
      }
      if (leave_type === "Sick Leave" && balance.sl_balance < totalDays) {
        return res.status(400).json({ error: `Insufficient Sick Leave balance! Available: ${balance.sl_balance}` });
      }
      if (leave_type === "Privilege Leave" && balance.pl_balance < totalDays) {
        return res.status(400).json({ error: `Insufficient Privilege Leave balance! Available: ${balance.pl_balance}` });
      }
    }

    const id = `lve_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    await pool.query(
      `INSERT INTO leave_requests (id, user_id, user_name, user_email, leave_type, from_date, to_date, day_type, total_days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [id, userId, userName, userEmail, leave_type, from_date, to_date, day_type || "Full Day", totalDays, reason]
    );

    const [created] = await pool.query("SELECT * FROM leave_requests WHERE id = ?", [id]);
    res.json({ message: "Leave applied successfully!", leave: created[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET ALL LEAVES (FOR SUPER ADMIN / MANAGER APPROVALS)
router.get("/all", authMiddleware, async (req, res) => {
  try {
    if (!isSuperAdminOrManager(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { status } = req.query;
    let query = "SELECT * FROM leave_requests WHERE 1=1";
    const params = [];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    query += " ORDER BY created_at DESC";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. APPROVE OR REJECT LEAVE
router.patch("/:id/action", authMiddleware, checkPermission("leave_management", "update"), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejection_reason } = req.body; // action: 'Approved' | 'Rejected'
    const approved_by = req.user.name || "Admin";

    const [reqRows] = await pool.query("SELECT * FROM leave_requests WHERE id = ?", [id]);
    if (reqRows.length === 0) return res.status(404).json({ error: "Leave request not found" });

    const leave = reqRows[0];

    if (action === "Approved") {
      // 1. Deduct balance
      const days = parseFloat(leave.total_days);
      if (leave.leave_type === "Casual Leave") {
        await pool.query("UPDATE leave_balances SET cl_balance = GREATEST(0, cl_balance - ?) WHERE user_id = ?", [days, leave.user_id]);
      } else if (leave.leave_type === "Sick Leave") {
        await pool.query("UPDATE leave_balances SET sl_balance = GREATEST(0, sl_balance - ?) WHERE user_id = ?", [days, leave.user_id]);
      } else if (leave.leave_type === "Privilege Leave") {
        await pool.query("UPDATE leave_balances SET pl_balance = GREATEST(0, pl_balance - ?) WHERE user_id = ?", [days, leave.user_id]);
      }

      // 2. Automatically sync to Attendance table as "On Leave"
      const start = new Date(leave.from_date);
      const end = new Date(leave.to_date);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        const day = d.getDay();
        if (day !== 0 && day !== 6) { // skip weekend
          const attId = `att_leave_${leave.user_id}_${dateStr}`;
          await pool.query(
            `INSERT INTO attendance (id, user_id, user_name, user_email, date, status, notes)
             VALUES (?, ?, ?, ?, ?, 'On Leave', ?)
             ON DUPLICATE KEY UPDATE status = 'On Leave', notes = VALUES(notes)`,
            [attId, leave.user_id, leave.user_name, leave.user_email, dateStr, `Approved ${leave.leave_type}`]
          );
        }
      }
    }

    await pool.query(
      "UPDATE leave_requests SET status = ?, approved_by = ?, rejection_reason = ? WHERE id = ?",
      [action, approved_by, rejection_reason || null, id]
    );

    res.json({ message: `Leave ${action} successfully!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. APPLY SHORT LEAVE
router.post("/short-leave", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userName = req.user.name || "Employee";
    const userEmail = req.user.email || "";
    const { date, from_time, to_time, hours, reason } = req.body;

    const id = `shl_${Date.now()}`;
    await pool.query(
      `INSERT INTO short_leaves (id, user_id, user_name, date, from_time, to_time, hours, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Approved')`,
      [id, userId, userName, date, from_time, to_time, hours || 2.0, reason]
    );

    res.json({ message: "Short leave approved!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET MY SHORT LEAVES
router.get("/my-short-leaves", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const [rows] = await pool.query("SELECT * FROM short_leaves WHERE user_id = ? ORDER BY date DESC", [userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
