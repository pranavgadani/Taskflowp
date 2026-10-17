const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const { pool } = require("../config/mysqlDb");

// Helper: Check if user is Super Admin or Company Owner
const isUserSuperAdmin = (req) => {
  const superEmail = process.env.SUPERADMIN_EMAIL || "gadanipranav@gmail.com";
  return req.user?.email === superEmail || req.user?.role?.name === "Super Admin" || req.user?.role === "Super Admin" || req.user?.role?.name === "Company Owner";
};

// 1. GET TODAY'S ATTENDANCE STATUS (For employee Clock In/Out widget)
router.get("/today", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userEmail = req.user.email || "";
    const today = new Date().toISOString().slice(0, 10);

    const [rows] = await pool.query(
      "SELECT * FROM attendance WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ? ORDER BY (clock_out IS NOT NULL) DESC, updated_at DESC, clock_in DESC LIMIT 1",
      [userId, userEmail, today]
    );

    res.json({ attendance: rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. CLOCK IN (Employee)
router.post("/clock-in", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userName = req.user.name || "Employee";
    const userEmail = req.user.email || "";
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const workMode = req.body.workMode || "Office";

    // Check if already has an attendance entry for today
    const [existing] = await pool.query(
      "SELECT * FROM attendance WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ? ORDER BY only_admin_clock_out DESC LIMIT 1",
      [userId, userEmail, today]
    );

    if (existing.length > 0 && existing[0].clock_in) {
      return res.status(400).json({ error: "Already clocked in for today!" });
    }

    if (existing.length > 0) {
      // Update existing record (preserving only_admin_clock_out that admin created!)
      await pool.query(
        `UPDATE attendance 
         SET user_id = ?, user_name = ?, user_email = ?, clock_in = ?, work_mode = ?, status = 'Present'
         WHERE id = ?`,
        [userId, userName, userEmail, now, workMode, existing[0].id]
      );
    } else {
      const attendanceId = `att_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await pool.query(
        `INSERT INTO attendance (id, user_id, user_name, user_email, date, clock_in, work_mode, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [attendanceId, userId, userName, userEmail, today, now, workMode, "Present"]
      );
    }

    const [updated] = await pool.query(
      "SELECT * FROM attendance WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ? ORDER BY only_admin_clock_out DESC LIMIT 1",
      [userId, userEmail, today]
    );
    res.json({ message: "Clock In successful!", attendance: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. CLOCK OUT (Employee)
router.post("/clock-out", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userEmail = req.user.email || "";
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const [existing] = await pool.query(
      "SELECT * FROM attendance WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ? ORDER BY only_admin_clock_out DESC LIMIT 1",
      [userId, userEmail, today]
    );

    if (!existing.length || !existing[0].clock_in) {
      return res.status(400).json({ error: "No clock-in record found for today!" });
    }

    // Check if clock-out is restricted to Admin only
    if (Boolean(existing[0].only_admin_clock_out)) {
      return res.status(403).json({ 
        error: "Clock-out restricted: Only your Admin / Super Admin can clock you out for today." 
      });
    }

    // 1. Fetch Today's Work Shift Schedule (Monday, Tuesday, etc.)
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = daysOfWeek[now.getDay()];
    const [schedRows] = await pool.query(
      "SELECT * FROM work_schedules WHERE day_of_week = ? LIMIT 1",
      [currentDayName]
    );

    let standardShiftMinutes = 9.5 * 60; // Default 9 hours 30 mins (570 mins)
    if (schedRows.length > 0 && schedRows[0].clock_in_time && schedRows[0].clock_out_time) {
      const [hIn, mIn] = schedRows[0].clock_in_time.split(":").map(Number);
      const [hOut, mOut] = schedRows[0].clock_out_time.split(":").map(Number);
      let diff = (hOut * 60 + mOut) - (hIn * 60 + mIn);
      if (diff < 0) diff += 24 * 60;
      if (diff > 0) standardShiftMinutes = diff;
    }

    // 2. Break calculations: 60 minutes break (40m lunch + 20m tea) is included in shift.
    // If user takes more than 60m (e.g. 90m = 1.30h), excess minutes (30m) get added to required time.
    const totalBreakMinutes = existing[0].total_break_minutes || 0;
    const allowedBreakMinutes = 60;
    const excessBreakMinutes = Math.max(0, totalBreakMinutes - allowedBreakMinutes);
    const requiredTotalShiftMinutes = standardShiftMinutes + excessBreakMinutes;

    // 3. Time elapsed since clock in
    const clockInTime = new Date(existing[0].clock_in);
    const elapsedMinutes = Math.max(0, Math.floor((now - clockInTime) / (1000 * 60)));
    const remainingMinutes = requiredTotalShiftMinutes - elapsedMinutes;

    // Helper: format minutes into "Xh Ym"
    const formatHrsMins = (mins) => {
      const h = Math.floor(mins / 60);
      const m = Math.round(mins % 60);
      if (h === 0) return `${m} minutes`;
      if (m === 0) return `${h} hours`;
      return `${h} hours ${m} minutes`;
    };

    // 4. If required shift time is NOT yet completed, check leave status
    if (remainingMinutes > 0) {
      // Check if employee has an approved or pending leave application for today
      const [leaveRows] = await pool.query(
        `SELECT * FROM leave_requests 
         WHERE (user_id = ? OR (user_email = ? AND user_email != '')) 
           AND (? BETWEEN from_date AND to_date)
           AND status != 'Rejected'
         ORDER BY created_at DESC`,
        [userId, userEmail, today]
      );
      const hasAppliedLeave = leaveRows.length > 0;

      // Determine First Half threshold using schedule first_half_hours (defaults to half the shift)
      const schedFirstHalfHours = schedRows.length > 0 && schedRows[0].first_half_hours ? parseFloat(schedRows[0].first_half_hours) : (standardShiftMinutes / 60) / 2;
      const firstHalfThresholdMinutes = schedFirstHalfHours * 60;
      const isFirstHalf = elapsedMinutes < firstHalfThresholdMinutes;

      const remainingStr = formatHrsMins(remainingMinutes);

      if (!hasAppliedLeave) {
        if (isFirstHalf) {
          return res.status(400).json({
            error: `First Half shift is not complete (Required: ${schedFirstHalfHours} hrs)! You must first apply for "First Half" leave in Leave Management before clocking out. Remaining shift time: ${remainingStr}.`
          });
        } else {
          return res.status(400).json({
            error: `Second Half shift is not complete! You must first apply for "Second Half" leave in Leave Management before clocking out. Remaining shift time: ${remainingStr}.`
          });
        }
      } else {
        // If leave is applied, verify if the appropriate half is covered
        const dayTypes = leaveRows.map(l => l.day_type);
        const hasFullDay = dayTypes.includes("Full Day");
        const hasFirstHalfLeave = dayTypes.includes("First Half") || dayTypes.includes("Half Day");
        const hasSecondHalfLeave = dayTypes.includes("Second Half") || dayTypes.includes("Half Day");

        if (isFirstHalf && !hasFirstHalfLeave && !hasFullDay) {
          return res.status(400).json({
            error: `You clocked out during First Half! Please apply for "First Half (Half Day)" leave today. Remaining shift time: ${remainingStr}.`
          });
        }
        if (!isFirstHalf && !hasSecondHalfLeave && !hasFullDay) {
          return res.status(400).json({
            error: `You clocked out early during Second Half! Please apply for "Second Half (Half Day)" leave today. Remaining shift time: ${remainingStr}.`
          });
        }
      }
    }

    // 5. Total Effective Working Hours (elapsed minus excess break)
    const effectiveWorkingMs = Math.max(0, (elapsedMinutes - excessBreakMinutes) * 60 * 1000);
    const totalHours = (effectiveWorkingMs / (1000 * 60 * 60)).toFixed(2);

    let status = "Present";
    if (parseFloat(totalHours) < (standardShiftMinutes / 60) * 0.5) {
      status = "Half Day";
    }

    await pool.query(
      `UPDATE attendance 
       SET clock_out = ?, total_hours = ?, status = ?
       WHERE id = ?`,
      [now, totalHours, status, existing[0].id]
    );

    const [updated] = await pool.query("SELECT * FROM attendance WHERE id = ?", [existing[0].id]);
    res.json({ message: "Clock Out successful!", attendance: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. BREAK START / END (Employee)
router.post("/break-toggle", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userEmail = req.user.email || "";
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const [existing] = await pool.query(
      "SELECT * FROM attendance WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ? ORDER BY only_admin_clock_out DESC LIMIT 1",
      [userId, userEmail, today]
    );

    if (!existing.length || !existing[0].clock_in) {
      return res.status(400).json({ error: "You must Clock In before taking a break." });
    }

    const record = existing[0];
    if (!record.break_start) {
      // Start break
      await pool.query(
        "UPDATE attendance SET break_start = ? WHERE id = ?",
        [now, record.id]
      );
      res.json({ message: "Break started", isOnBreak: true });
    } else {
      // End break
      const breakStart = new Date(record.break_start);
      const breakDurationMinutes = Math.round((now - breakStart) / 60000);
      const totalBreak = (record.total_break_minutes || 0) + breakDurationMinutes;

      await pool.query(
        "UPDATE attendance SET break_start = NULL, break_end = ?, total_break_minutes = ? WHERE id = ?",
        [now, totalBreak, record.id]
      );
      res.json({ message: "Break ended", isOnBreak: false, totalBreakMinutes: totalBreak });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET ALL ATTENDANCE RECORDS (READ PERMISSION)
router.get("/all", authMiddleware, checkPermission("attendance_management", "read"), async (req, res) => {
  try {
    const { date, month, status, userId, pendingClockOut } = req.query;
    let query = "SELECT * FROM attendance WHERE 1=1";
    const params = [];

    if (date) {
      query += " AND date = ?";
      params.push(date);
    }
    if (month) {
      query += " AND date LIKE ?";
      params.push(`${month}%`);
    }
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    if (userId) {
      query += " AND user_id = ?";
      params.push(userId);
    }
    if (pendingClockOut === "true") {
      // Missing Clock Out: clocked in but clock_out IS NULL
      query += " AND clock_in IS NOT NULL AND clock_out IS NULL";
    }

    query += " ORDER BY date DESC, clock_in DESC";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.5 ADMIN CLOCK OUT AN EMPLOYEE
router.put("/:id/clock-out", authMiddleware, async (req, res) => {
  try {
    if (!isUserSuperAdmin(req)) {
      return res.status(403).json({ error: "Access Denied: Only Admin can clock out staff." });
    }

    const { id } = req.params;
    const now = new Date();

    const [rows] = await pool.query("SELECT * FROM attendance WHERE id = ?", [id]);
    if (!rows.length || !rows[0].clock_in) {
      return res.status(404).json({ error: "Attendance clock-in record not found." });
    }

    const clockIn = new Date(rows[0].clock_in);
    const diffHours = Math.max(0.5, ((now - clockIn) / (1000 * 60 * 60))).toFixed(2);

    await pool.query(
      `UPDATE attendance 
       SET clock_out = ?, total_hours = ?, notes = CONCAT(COALESCE(notes, ''), ' [Clocked out by Admin]')
       WHERE id = ?`,
      [now, diffHours, id]
    );

    res.json({ message: "Employee clocked out successfully by Admin", total_hours: diffHours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.6 WORK SCHEDULES / WEEKDAY SHIFTS (GET & UPDATE)
router.get("/schedules", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM work_schedules ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/schedules/:id", authMiddleware, checkPermission("attendance_management", "update"), async (req, res) => {
  try {
    const { is_working_day, clock_in_time, clock_out_time, first_half_hours, second_half_hours } = req.body;
    await pool.query(
      `UPDATE work_schedules 
       SET is_working_day = COALESCE(?, is_working_day),
           clock_in_time = COALESCE(?, clock_in_time),
           clock_out_time = COALESCE(?, clock_out_time),
           first_half_hours = COALESCE(?, first_half_hours),
           second_half_hours = COALESCE(?, second_half_hours)
       WHERE id = ?`,
      [
        is_working_day !== undefined ? (is_working_day ? 1 : 0) : null,
        clock_in_time,
        clock_out_time,
        first_half_hours !== undefined ? parseFloat(first_half_hours) : null,
        second_half_hours !== undefined ? parseFloat(second_half_hours) : null,
        req.params.id
      ]
    );

    res.json({ message: "Work schedule updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. UPDATE / REGULARIZE ATTENDANCE
router.put("/:id", authMiddleware, checkPermission("attendance_management", "update"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, total_hours, notes, is_regularized, work_mode, only_admin_clock_out } = req.body;

    await pool.query(
      `UPDATE attendance 
       SET status = COALESCE(?, status), 
           total_hours = COALESCE(?, total_hours), 
           notes = COALESCE(?, notes), 
           is_regularized = COALESCE(?, is_regularized),
           work_mode = COALESCE(?, work_mode),
           only_admin_clock_out = COALESCE(?, only_admin_clock_out)
       WHERE id = ?`,
      [status, total_hours, notes, is_regularized, work_mode, only_admin_clock_out !== undefined ? (only_admin_clock_out ? 1 : 0) : null, id]
    );

    res.json({ message: "Attendance updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. MANUAL ATTENDANCE ENTRY
router.post("/manual", authMiddleware, checkPermission("attendance_management", "create"), async (req, res) => {
  try {
    const { user_id, user_name, user_email, date, clock_in, clock_out, status, total_hours, work_mode, notes, only_admin_clock_out } = req.body;
    const id = `att_manual_${Date.now()}`;

    await pool.query(
      `INSERT INTO attendance (id, user_id, user_name, user_email, date, clock_in, clock_out, status, total_hours, work_mode, notes, is_regularized, only_admin_clock_out)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE 
         status = VALUES(status), 
         total_hours = VALUES(total_hours),
         clock_in = VALUES(clock_in),
         clock_out = VALUES(clock_out),
         work_mode = VALUES(work_mode),
         notes = VALUES(notes),
         only_admin_clock_out = VALUES(only_admin_clock_out),
         is_regularized = 1`,
      [id, user_id, user_name, user_email, date, clock_in || null, clock_out || null, status || "Present", total_hours || 8, work_mode || "Office", notes || "Manual entry", only_admin_clock_out ? 1 : 0]
    );

    res.json({ message: "Attendance record added/updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. DELETE ATTENDANCE ENTRY
router.delete("/:id", authMiddleware, checkPermission("attendance_management", "delete"), async (req, res) => {
  try {
    await pool.query("DELETE FROM attendance WHERE id = ?", [req.params.id]);
    res.json({ message: "Attendance record deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
