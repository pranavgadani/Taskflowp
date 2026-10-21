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

// Helper: Determine if a specific date is working day considering saturday_rule
const isDayWorkingByRule = (dateObj, scheduleRow) => {
  if (!scheduleRow) return false;
  if (scheduleRow.is_working_day === 0) return false;
  
  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 6 = Sat
  if (dayOfWeek === 6) { // Saturday
    const rule = scheduleRow.saturday_rule || "2nd_4th_off";
    if (rule === "all_off") return false;
    if (rule === "all_working") return true;
    
    // "2nd_4th_off": 2nd and 4th Saturday are company holidays
    const dayOfMonth = dateObj.getDate();
    const satIndex = Math.ceil(dayOfMonth / 7); // 1, 2, 3, 4, 5
    if (satIndex === 2 || satIndex === 4) {
      return false; // Holiday
    }
    return true; // 1st, 3rd, 5th Saturday is working
  }

  return scheduleRow.is_working_day !== 0;
};

// Helper: Calculate shift requirements, breaks, and excess break duration
const getShiftAndBreakInfo = async (userId, userEmail, today, now, clockInTime, existingTotalBreak) => {
  // 1. Fetch Today's Work Schedule (default 9 hours)
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayName = daysOfWeek[now.getDay()];
  const [schedRows] = await pool.query(
    "SELECT * FROM work_schedules WHERE day_of_week = ? LIMIT 1",
    [currentDayName]
  );

  let standardShiftMinutes = 9 * 60; // Standard 9 hours (540 mins)
  let shiftTiming = "10:00 AM - 07:00 PM";
  if (schedRows.length > 0 && schedRows[0].clock_in_time && schedRows[0].clock_out_time) {
    const [hIn, mIn] = schedRows[0].clock_in_time.split(":").map(Number);
    const [hOut, mOut] = schedRows[0].clock_out_time.split(":").map(Number);
    let diff = (hOut * 60 + mOut) - (hIn * 60 + mIn);
    if (diff < 0) diff += 24 * 60;
    if (diff > 0) standardShiftMinutes = diff;
    shiftTiming = `${schedRows[0].clock_in_time} - ${schedRows[0].clock_out_time}`;
  }

  // 2. Fetch today's break logs and active break policies
  const [todayBreaks] = await pool.query(
    "SELECT * FROM break_logs WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ?",
    [userId, userEmail, today]
  );
  const [breakTypes] = await pool.query(
    "SELECT * FROM break_types WHERE status = 'Active'"
  );

  const policyMap = {};
  let defaultLunchAllowed = 40; // Default Lunch Break is 40 minutes
  for (const bt of breakTypes) {
    policyMap[bt.name.trim().toLowerCase()] = bt.duration_minutes;
    if (bt.name.toLowerCase().includes("lunch")) {
      defaultLunchAllowed = bt.duration_minutes;
    }
  }

  let totalExcessBreakMinutes = 0;
  const excessBreakBreakdown = [];
  let totalBreakMinutesTaken = 0;

  for (const b of todayBreaks) {
    let dur = b.duration_minutes || 0;
    if (!b.end_time && b.start_time) {
      dur = Math.max(1, Math.round((now - new Date(b.start_time)) / 60000));
    }
    totalBreakMinutesTaken += dur;

    const normReason = (b.reason || "").trim().toLowerCase();
    let allowedForThisBreak = policyMap[normReason];
    if (allowedForThisBreak === undefined) {
      const matchedKey = Object.keys(policyMap).find(k => normReason.includes(k) || k.includes(normReason));
      if (matchedKey) {
        allowedForThisBreak = policyMap[matchedKey];
      } else {
        allowedForThisBreak = defaultLunchAllowed;
      }
    }

    if (dur > allowedForThisBreak) {
      const excess = dur - allowedForThisBreak;
      totalExcessBreakMinutes += excess;
      excessBreakBreakdown.push(`${b.reason || "Break"}: took ${dur}m (allowed ${allowedForThisBreak}m, +${excess}m excess)`);
    }
  }

  // Fallback: check against attendance table total_break_minutes
  const overallBreakTaken = Math.max(totalBreakMinutesTaken, existingTotalBreak || 0);
  if (totalExcessBreakMinutes === 0 && overallBreakTaken > defaultLunchAllowed) {
    totalExcessBreakMinutes = overallBreakTaken - defaultLunchAllowed;
    excessBreakBreakdown.push(`Total breaks took ${overallBreakTaken}m (allowed ${defaultLunchAllowed}m, +${totalExcessBreakMinutes}m excess)`);
  }

  // Shift is extended by any excess break taken (e.g. 9 hours + 20 min excess)
  const requiredTotalShiftMinutes = standardShiftMinutes + totalExcessBreakMinutes;

  let elapsedMinutes = 0;
  let remainingMinutes = requiredTotalShiftMinutes;
  if (clockInTime) {
    elapsedMinutes = Math.max(0, Math.floor((now - new Date(clockInTime)) / (1000 * 60)));
    remainingMinutes = Math.max(0, requiredTotalShiftMinutes - elapsedMinutes);
  }

  const sched = schedRows[0] || null;
  const schedFirstHalfHours = sched && sched.first_half_hours ? parseFloat(sched.first_half_hours) : (standardShiftMinutes / 60) / 2;

  return {
    standardShiftMinutes,
    standardShiftHours: (standardShiftMinutes / 60).toFixed(1),
    shiftTiming,
    sched,
    schedFirstHalfHours,
    totalBreakMinutesTaken: overallBreakTaken,
    totalExcessBreakMinutes,
    excessBreakBreakdown,
    requiredTotalShiftMinutes,
    elapsedMinutes,
    remainingMinutes
  };
};

// 1. GET TODAY'S ATTENDANCE STATUS (For employee Clock In/Out widget)
router.get("/today", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userEmail = req.user.email || "";
    const today = new Date().toISOString().slice(0, 10);

    // Auto close past forgotten clock-ins
    await autoClosePastUnclosedAttendance(userId, userEmail, today);

    // Check if there is any past missed clock out that needs Second Half leave
    const [pendingMissed] = await pool.query(
      `SELECT * FROM attendance 
       WHERE (user_id = ? OR (user_email = ? AND user_email != '')) 
         AND date < ? 
         AND missed_clock_out = 1 
       ORDER BY date DESC LIMIT 1`,
      [userId, userEmail, today]
    );

    let requiredLeaveNotice = null;
    if (pendingMissed.length > 0) {
      const missedDateStr = new Date(pendingMissed[0].date).toISOString().slice(0, 10);
      const [leaveCheck] = await pool.query(
        `SELECT * FROM leave_requests 
         WHERE (user_id = ? OR (user_email = ? AND user_email != '')) 
           AND (? BETWEEN from_date AND to_date)
           AND status != 'Rejected'
           AND (day_type = 'Second Half' OR day_type = 'Half Day' OR day_type = 'Full Day')`,
        [userId, userEmail, missedDateStr]
      );
      if (leaveCheck.length === 0) {
        requiredLeaveNotice = {
          date: missedDateStr,
          message: `You missed clocking out on ${missedDateStr} (auto clocked out at 11:00 PM). Please apply for 'Second Half' leave on ${missedDateStr} before clocking in today!`
        };
      } else {
        await pool.query("UPDATE attendance SET missed_clock_out = 0 WHERE id = ?", [pendingMissed[0].id]);
      }
    }

    const [rows] = await pool.query(
      "SELECT * FROM attendance WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ? ORDER BY (clock_out IS NOT NULL) DESC, updated_at DESC, clock_in DESC LIMIT 1",
      [userId, userEmail, today]
    );

    // Also fetch today's work schedule and calculate break details
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const currentDayName = daysOfWeek[now.getDay()];

    const shiftDetails = await getShiftAndBreakInfo(
      userId,
      userEmail,
      today,
      now,
      rows[0]?.clock_in,
      rows[0]?.total_break_minutes
    );

    const sched = shiftDetails.sched;
    const isWorkingDay = isDayWorkingByRule(now, sched);
    let dayNote = "";
    if (now.getDay() === 6) {
      const satIndex = Math.ceil(now.getDate() / 7);
      if (!isWorkingDay) {
        dayNote = `Company Holiday (${satIndex === 2 ? "2nd" : satIndex === 4 ? "4th" : ""} Saturday)`;
      } else {
        dayNote = `Working Saturday (${satIndex === 1 ? "1st" : satIndex === 3 ? "3rd" : "5th"} Saturday)`;
      }
    }

    // Fetch attendance settings & current month's late instance tracking
    const [settingRows] = await pool.query("SELECT * FROM attendance_settings WHERE id = 'default_settings' LIMIT 1");
    const attSettings = settingRows[0] || { monthly_late_instances: 3, late_grace_minutes: 30 };

    const currentMonthPrefix = today.slice(0, 7);
    const [monthLateRows] = await pool.query(
      `SELECT COUNT(*) as late_count, COALESCE(SUM(first_half_deducted), 0) as half_days_deducted
       FROM attendance 
       WHERE (user_id = ? OR (user_email = ? AND user_email != '')) 
         AND date LIKE ? 
         AND is_late_instance = 1`,
      [userId, userEmail, `${currentMonthPrefix}%`]
    );

    const lateCount = monthLateRows[0]?.late_count || 0;
    const monthlyLimit = attSettings.monthly_late_instances;
    const remainingInstances = Math.max(0, monthlyLimit - lateCount);

    res.json({ 
      attendance: rows[0] || null,
      requiredLeaveNotice,
      late_instances: {
        used: lateCount,
        limit: monthlyLimit,
        remaining: remainingInstances,
        grace_minutes: attSettings.late_grace_minutes,
        is_exhausted: lateCount >= monthlyLimit,
        half_days_deducted: monthLateRows[0]?.half_days_deducted || 0
      },
      schedule: {
        day: currentDayName,
        timing: shiftDetails.shiftTiming,
        standardShiftHours: shiftDetails.standardShiftHours,
        standardShiftMinutes: shiftDetails.standardShiftMinutes,
        requiredShiftMinutes: shiftDetails.requiredTotalShiftMinutes,
        excessBreakMinutes: shiftDetails.totalExcessBreakMinutes,
        excessBreakBreakdown: shiftDetails.excessBreakBreakdown,
        totalBreakMinutes: shiftDetails.totalBreakMinutesTaken,
        clock_in_time: sched?.clock_in_time || "09:30",
        clock_out_time: sched?.clock_out_time || "18:30",
        is_working_day: isWorkingDay,
        saturday_rule: sched?.saturday_rule || "2nd_4th_off",
        day_note: dayNote
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Run auto clock-out for unclosed shifts from previous days
const autoClosePastUnclosedAttendance = async (userId, userEmail, today) => {
  // Find any attendance record before today where user clocked in but never clocked out
  const [unclosed] = await pool.query(
    `SELECT * FROM attendance 
     WHERE (user_id = ? OR (user_email = ? AND user_email != '')) 
       AND date < ? 
       AND clock_in IS NOT NULL 
       AND clock_out IS NULL 
     ORDER BY date DESC`,
    [userId, userEmail, today]
  );

  for (const rec of unclosed) {
    const clockInDate = new Date(rec.clock_in);
    // Auto clock-out set to 11:00 PM (23:00) on the day of attendance
    const autoClockOut = new Date(clockInDate);
    autoClockOut.setHours(23, 0, 0, 0);

    let finalClockOut = autoClockOut;
    if (finalClockOut <= clockInDate) {
      finalClockOut = new Date(clockInDate.getTime() + 30 * 60 * 1000);
    }

    const elapsedMs = Math.max(0, finalClockOut.getTime() - clockInDate.getTime());
    const totalHours = (elapsedMs / (1000 * 60 * 60)).toFixed(2);

    await pool.query(
      `UPDATE attendance 
       SET clock_out = ?, total_hours = ?, status = 'Half Day', auto_clock_out = 1, missed_clock_out = 1,
           notes = CONCAT(COALESCE(notes, ''), ' [Auto clocked out at 11:00 PM due to missed clock out - Second Half Leave Required]')
       WHERE id = ?`,
      [finalClockOut, totalHours, rec.id]
    );
  }
};

// 2. CLOCK IN (Employee)
router.post("/clock-in", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userName = req.user.name || "Employee";
    const userEmail = req.user.email || "";
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const workMode = req.body.workMode || "Office";

    // 1. Automatically close any forgotten / unclosed attendance from previous days (cutoff at 11:00 AM)
    await autoClosePastUnclosedAttendance(userId, userEmail, today);

    // 2. Check if user had an unclosed/missed clock-out from a previous day that was auto-closed as Half Day
    // If so, they must have applied for 'Second Half' or 'Full Day' leave for that date before clocking in today!
    const [missedRecords] = await pool.query(
      `SELECT * FROM attendance 
       WHERE (user_id = ? OR (user_email = ? AND user_email != '')) 
         AND date < ? 
         AND missed_clock_out = 1 
       ORDER BY date DESC LIMIT 1`,
      [userId, userEmail, today]
    );

    if (missedRecords.length > 0) {
      const missedRec = missedRecords[0];
      const missedDateStr = new Date(missedRec.date).toISOString().slice(0, 10);

      // Check if user has an applied leave (Second Half or Full Day) for that missed date
      const [leaveRows] = await pool.query(
        `SELECT * FROM leave_requests 
         WHERE (user_id = ? OR (user_email = ? AND user_email != '')) 
           AND (? BETWEEN from_date AND to_date)
           AND status != 'Rejected'
           AND (day_type = 'Second Half' OR day_type = 'Half Day' OR day_type = 'Full Day')`,
        [userId, userEmail, missedDateStr]
      );

      if (leaveRows.length === 0) {
        return res.status(400).json({
          error: `You forgot to clock out on ${missedDateStr} and were auto clocked out at 11:00 PM. Before clocking in today, you must first apply for 'Second Half' leave on ${missedDateStr} in Leave Management!`,
          requireLeaveDate: missedDateStr,
          requireLeaveType: "Second Half"
        });
      } else {
        // Leave is submitted, clear the missed_clock_out flag so they won't be blocked again
        await pool.query(
          "UPDATE attendance SET missed_clock_out = 0 WHERE id = ?",
          [missedRec.id]
        );
      }
    }

    // Check if already has an attendance entry for today
    const [existing] = await pool.query(
      "SELECT * FROM attendance WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ? ORDER BY only_admin_clock_out DESC LIMIT 1",
      [userId, userEmail, today]
    );

    if (existing.length > 0 && existing[0].clock_in) {
      return res.status(400).json({ error: "Already clocked in for today!" });
    }

    // 3. Late Arrival & Instance Check against Attendance Settings and Work Schedule
    const [settingRows] = await pool.query("SELECT * FROM attendance_settings WHERE id = 'default_settings' LIMIT 1");
    const attSettings = settingRows[0] || { monthly_late_instances: 3, late_grace_minutes: 30 };

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = daysOfWeek[now.getDay()];
    const [schedRows] = await pool.query(
      "SELECT * FROM work_schedules WHERE day_of_week = ? LIMIT 1",
      [currentDayName]
    );

    let isLateInstance = 0;
    let lateMinutes = 0;
    let firstHalfDeducted = 0;
    let attendanceStatus = "Present";
    let lateNoticeMsg = null;

    if (schedRows.length > 0 && schedRows[0].clock_in_time) {
      const [hIn, mIn] = schedRows[0].clock_in_time.split(":").map(Number);
      const shiftStartMinutes = hIn * 60 + mIn;
      const graceMinutes = attSettings.late_grace_minutes;
      const cutoffMinutes = shiftStartMinutes + graceMinutes;

      const clockInMinutes = now.getHours() * 60 + now.getMinutes();

      if (clockInMinutes > cutoffMinutes) {
        // Employee arrived late beyond allowed grace!
        isLateInstance = 1;
        lateMinutes = clockInMinutes - shiftStartMinutes;

        // Count how many late instances employee used this month so far (excluding today)
        const currentMonthPrefix = today.slice(0, 7);
        const [monthLateRows] = await pool.query(
          `SELECT COUNT(*) as late_count 
           FROM attendance 
           WHERE (user_id = ? OR (user_email = ? AND user_email != '')) 
             AND date LIKE ? 
             AND is_late_instance = 1
             AND date != ?`,
          [userId, userEmail, `${currentMonthPrefix}%`, today]
        );

        const usedSoFar = monthLateRows[0]?.late_count || 0;
        const limit = attSettings.monthly_late_instances;

        if (usedSoFar < limit) {
          // Within allowed monthly late instances
          const currentInstanceNumber = usedSoFar + 1;
          const remainingAfterThis = limit - currentInstanceNumber;
          lateNoticeMsg = `Late Arrival Notice: You clocked in at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${lateMinutes} mins late, after ${schedRows[0].clock_in_time} + ${graceMinutes}m grace). Late instance ${currentInstanceNumber} of ${limit} has been used for this month (${remainingAfterThis} remaining).`;
        } else {
          // Monthly late instances EXHAUSTED! First Half Day is applied automatically!
          firstHalfDeducted = 1;
          attendanceStatus = "Half Day";
          lateNoticeMsg = `Late Arrival Penalty: You clocked in at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${lateMinutes} mins late). All your ${limit} monthly late instances were already exhausted! As per company policy, 'Half Day' (First Half) has been applied for today.`;
        }
      }
    }

    if (existing.length > 0) {
      // Update existing record (preserving only_admin_clock_out that admin created!)
      await pool.query(
        `UPDATE attendance 
         SET user_id = ?, user_name = ?, user_email = ?, clock_in = ?, work_mode = ?, status = ?,
             is_late_instance = ?, late_minutes = ?, first_half_deducted = ?,
             notes = CONCAT(COALESCE(notes, ''), ?)
         WHERE id = ?`,
        [userId, userName, userEmail, now, workMode, attendanceStatus, isLateInstance, lateMinutes, firstHalfDeducted, lateNoticeMsg ? ` [${lateNoticeMsg}]` : '', existing[0].id]
      );
    } else {
      const attendanceId = `att_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await pool.query(
        `INSERT INTO attendance (id, user_id, user_name, user_email, date, clock_in, work_mode, status, is_late_instance, late_minutes, first_half_deducted, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [attendanceId, userId, userName, userEmail, today, now, workMode, attendanceStatus, isLateInstance, lateMinutes, firstHalfDeducted, lateNoticeMsg || null]
      );
    }

    const [updated] = await pool.query(
      "SELECT * FROM attendance WHERE (user_id = ? OR (user_email = ? AND user_email != '')) AND date = ? ORDER BY only_admin_clock_out DESC LIMIT 1",
      [userId, userEmail, today]
    );

    res.json({ 
      message: lateNoticeMsg ? lateNoticeMsg : "Clock In successful!", 
      attendance: updated[0],
      lateNotice: lateNoticeMsg,
      is_late: isLateInstance === 1,
      first_half_deducted: firstHalfDeducted === 1
    });
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

    // 1. Calculate shift & break requirements
    const shiftDetails = await getShiftAndBreakInfo(
      userId,
      userEmail,
      today,
      now,
      existing[0].clock_in,
      existing[0].total_break_minutes
    );

    const {
      standardShiftMinutes,
      schedFirstHalfHours,
      totalExcessBreakMinutes,
      excessBreakBreakdown,
      requiredTotalShiftMinutes,
      elapsedMinutes
    } = shiftDetails;

    const remainingMinutes = requiredTotalShiftMinutes - elapsedMinutes;

    // Helper: format minutes into "Xh Ym"
    const formatHrsMins = (mins) => {
      const h = Math.floor(mins / 60);
      const m = Math.round(mins % 60);
      if (h === 0) return `${m} minutes`;
      if (m === 0) return `${h} hours`;
      return `${h} hours ${m} minutes`;
    };

    // 2. If required shift time is NOT yet completed, check leave status FIRST
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

      const firstHalfThresholdMinutes = schedFirstHalfHours * 60;
      const isFirstHalf = elapsedMinutes < firstHalfThresholdMinutes;
      const remainingStr = formatHrsMins(remainingMinutes);

      const excessNote = totalExcessBreakMinutes > 0 
        ? ` (Shift extended: standard ${formatHrsMins(standardShiftMinutes)} + ${totalExcessBreakMinutes}m excess break: ${excessBreakBreakdown.join(", ")})` 
        : "";

      if (!hasAppliedLeave) {
        if (isFirstHalf) {
          return res.status(400).json({
            error: `Shift time is incomplete${excessNote}. Worked: ${formatHrsMins(elapsedMinutes)} / Required: ${schedFirstHalfHours} hrs for half-day. If you are leaving for the rest of today, please apply for "Full Day Leave" (or "First Half Leave") in Leave Management before clocking out. Remaining shift time: ${remainingStr}.`
          });
        } else {
          return res.status(400).json({
            error: `Shift time is incomplete${excessNote}. You must complete ${formatHrsMins(requiredTotalShiftMinutes)} before clocking out. Please apply for "Second Half Leave" or "Full Day Leave" in Leave Management before clocking out. Remaining shift time: ${remainingStr}.`
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
            error: `Early departure during First Half. Please ensure you have applied for "Full Day" or "First Half" leave in Leave Management. Remaining shift time: ${remainingStr}.`
          });
        }
        if (!isFirstHalf && !hasSecondHalfLeave && !hasFullDay) {
          return res.status(400).json({
            error: `Early departure during Second Half. Please apply for "Second Half" or "Full Day" leave in Leave Management. Remaining shift time: ${remainingStr}.`
          });
        }
      }
    }

    // 5. Timesheet Check: When employee completes their shift (or has approved leave to clock out), they must fill their timesheet before leaving
    const [tsRows] = await pool.query(
      "SELECT COALESCE(SUM(hours), 0) AS total_logged FROM timesheets WHERE (user_id = ? OR user_email = ?) AND date = ?",
      [userId, userEmail, today]
    );
    const loggedTimesheetHours = parseFloat(tsRows[0]?.total_logged || 0);
    if (loggedTimesheetHours <= 0) {
      return res.status(400).json({
        error: `Daily Timesheet Incomplete! You must fill your Timesheet entries for today before you can Clock Out. Please open Timesheet and log your project work.`
      });
    }

    // 5. Total Effective Working Hours (elapsed minus excess break)
    const effectiveWorkingMs = Math.max(0, (elapsedMinutes - totalExcessBreakMinutes) * 60 * 1000);
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

    // If user is not superadmin/company owner, restrict to their own records only (e.g. Rahul sees only his records)
    if (!isUserSuperAdmin(req)) {
      const currentUserId = req.user._id ? req.user._id.toString() : req.user.id;
      const currentUserEmail = req.user.email || "";
      query += " AND (user_id = ? OR (user_email = ? AND user_email != ''))";
      params.push(currentUserId, currentUserEmail);
    } else if (userId) {
      query += " AND user_id = ?";
      params.push(userId);
    }

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
    const { is_working_day, clock_in_time, clock_out_time, first_half_hours, second_half_hours, saturday_rule } = req.body;
    await pool.query(
      `UPDATE work_schedules 
       SET is_working_day = COALESCE(?, is_working_day),
           clock_in_time = COALESCE(?, clock_in_time),
           clock_out_time = COALESCE(?, clock_out_time),
           first_half_hours = COALESCE(?, first_half_hours),
           second_half_hours = COALESCE(?, second_half_hours),
           saturday_rule = COALESCE(?, saturday_rule)
       WHERE id = ?`,
      [
        is_working_day !== undefined ? (is_working_day ? 1 : 0) : null,
        clock_in_time,
        clock_out_time,
        first_half_hours !== undefined ? parseFloat(first_half_hours) : null,
        second_half_hours !== undefined ? parseFloat(second_half_hours) : null,
        saturday_rule !== undefined ? saturday_rule : null,
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

// 9. GET ATTENDANCE SETTINGS (Monthly Late Instances, Grace Minutes)
router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM attendance_settings WHERE id = 'default_settings' LIMIT 1");
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json({ monthly_late_instances: 3, late_grace_minutes: 30 });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. UPDATE ATTENDANCE SETTINGS (Admin only)
router.put("/settings", authMiddleware, async (req, res) => {
  try {
    const isSuper = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    const isOwner = req.user.role?.name === "Company Owner";
    if (!isSuper && !isOwner) {
      return res.status(403).json({ error: "Only Admin can update attendance settings." });
    }

    const { monthly_late_instances, late_grace_minutes } = req.body;
    const instances = parseInt(monthly_late_instances) >= 0 ? parseInt(monthly_late_instances) : 3;
    const grace = parseInt(late_grace_minutes) >= 0 ? parseInt(late_grace_minutes) : 30;

    await pool.query(
      `INSERT INTO attendance_settings (id, monthly_late_instances, late_grace_minutes)
       VALUES ('default_settings', ?, ?)
       ON DUPLICATE KEY UPDATE monthly_late_instances = VALUES(monthly_late_instances), late_grace_minutes = VALUES(late_grace_minutes)`,
      [instances, grace]
    );

    res.json({ 
      message: "Attendance settings updated successfully", 
      settings: { monthly_late_instances: instances, late_grace_minutes: grace } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
