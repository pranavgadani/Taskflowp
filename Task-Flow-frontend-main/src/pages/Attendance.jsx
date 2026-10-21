import React, { useState, useEffect } from "react";
import API from "../api/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionContext";
import FormModal from "../components/common/FormModal";
import "../style/main.css";
import "../style/table.css";

export default function Attendance() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();

  const isSuperAdmin = user?.email === "gadanipranav@gmail.com" || user?.role?.name === "Super Admin";
  const isCompanyOwner = user?.role?.name === "Company Owner";

  const canRead = isSuperAdmin || isCompanyOwner || hasPermission("attendance_management", "read");
  const canCreate = isSuperAdmin || isCompanyOwner || hasPermission("attendance_management", "create");
  const canUpdate = isSuperAdmin || isCompanyOwner || hasPermission("attendance_management", "update");
  const canDelete = isSuperAdmin || isCompanyOwner || hasPermission("attendance_management", "delete");

  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState("");
  
  const [activeTab, setActiveTab] = useState("attendance"); // "attendance" | "schedules"
  const [filterPendingClockOut, setFilterPendingClockOut] = useState(false);

  // Work Schedules (Monday - Sunday)
  const [schedules, setSchedules] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    is_working_day: true,
    clock_in_time: "09:30",
    clock_out_time: "18:30",
    first_half_hours: "4.75",
    second_half_hours: "4.75",
    saturday_rule: "2nd_4th_off"
  });

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [staffList, setStaffList] = useState([]);
  
  const [formData, setFormData] = useState({
    user_id: "",
    user_name: "",
    user_email: "",
    date: new Date().toISOString().slice(0, 10),
    status: "Present",
    total_hours: 8,
    work_mode: "Office",
    notes: "",
    only_admin_clock_out: false
  });

  // Load Attendance
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      let url = "/attendance/all?";
      if (filterDate) url += `date=${filterDate}&`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (filterPendingClockOut && isSuperAdmin) url += `pendingClockOut=true&`;
      
      const res = await API.get(url);
      let data = Array.isArray(res.data) ? res.data : [];
      // Safety filter: if not super admin, strictly filter records by current user
      if (!isSuperAdmin) {
        const myEmail = user?.email?.toLowerCase() || "";
        const myId = user?._id || user?.id || "";
        data = data.filter((item) => {
          const itemEmail = item.user_email?.toLowerCase() || "";
          const itemId = item.user_id ? String(item.user_id) : "";
          return (myEmail && itemEmail === myEmail) || (myId && itemId === String(myId));
        });
      }
      setAttendanceList(data);
    } catch (err) {
      showToast(err.response?.data?.error || "Error loading attendance", "error");
    } finally {
      setLoading(false);
    }
  };

  // Load Work Schedules
  const fetchSchedules = async () => {
    try {
      const res = await API.get("/attendance/schedules");
      setSchedules(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading schedules:", err);
    }
  };

  // Late Instance Policy Settings
  const [attSettings, setAttSettings] = useState({
    monthly_late_instances: 3,
    late_grace_minutes: 30
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchAttSettings = async () => {
    try {
      const res = await API.get("/attendance/settings");
      if (res.data) {
        setAttSettings({
          monthly_late_instances: res.data.monthly_late_instances ?? 3,
          late_grace_minutes: res.data.late_grace_minutes ?? 30
        });
      }
    } catch (err) {
      console.error("Error loading attendance settings:", err);
    }
  };

  const handleSaveAttSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await API.put("/attendance/settings", attSettings);
      showToast("Late Instances Policy updated successfully!", "success");
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to update settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Load Staff for dropdown
  const fetchStaff = async () => {
    try {
      const res = await API.get("/staff");
      setStaffList(res.data || []);
    } catch (err) {
      console.error("Staff loading error:", err);
    }
  };

  useEffect(() => {
    if (canRead) {
      fetchAttendance();
      fetchStaff();
      if (isSuperAdmin) {
        fetchSchedules();
        fetchAttSettings();
      }
    }
  }, [filterDate, filterStatus, filterPendingClockOut, canRead, isSuperAdmin]);

  const handleEdit = (record) => {
    setEditRecord(record);
    setFormData({
      user_id: record.user_id,
      user_name: record.user_name,
      user_email: record.user_email,
      date: record.date ? record.date.slice(0, 10) : "",
      status: record.status || "Present",
      total_hours: record.total_hours || 8,
      work_mode: record.work_mode || "Office",
      notes: record.notes || "",
      only_admin_clock_out: Boolean(record.only_admin_clock_out)
    });
    setShowModal(true);
  };

  // Super Admin: Force Clock Out an Employee
  const handleAdminClockOut = async (id, empName) => {
    if (!window.confirm(`Clock out employee ${empName || ""}?`)) return;
    try {
      const res = await API.put(`/attendance/${id}/clock-out`);
      showToast(res.data.message || "Clocked out successfully!");
      fetchAttendance();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to clock out", "error");
    }
  };

  // Super Admin: Save Schedule
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;
    try {
      await API.put(`/attendance/schedules/${editingSchedule.id}`, scheduleForm);
      showToast(`Work schedule for ${editingSchedule.day_of_week} updated!`);
      setShowScheduleModal(false);
      setEditingSchedule(null);
      fetchSchedules();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to update schedule", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this attendance record?")) return;
    try {
      await API.delete(`/attendance/${id}`);
      showToast("Attendance record deleted");
      fetchAttendance();
    } catch (err) {
      showToast(err.response?.data?.error || "Delete failed", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const defaultHours = formData.status === "Present" ? 8 : formData.status === "Half Day" ? 4 : 0;
      const effectiveHours = formData.total_hours !== undefined && formData.total_hours !== null && formData.total_hours !== "" 
        ? Number(formData.total_hours) 
        : defaultHours;
      const effectiveDate = formData.date || new Date().toISOString().slice(0, 10);
      if (editRecord) {
        await API.put(`/attendance/${editRecord.id}`, {
          status: formData.status,
          total_hours: effectiveHours,
          work_mode: formData.work_mode,
          notes: formData.notes,
          only_admin_clock_out: formData.only_admin_clock_out ? 1 : 0,
          is_regularized: 1
        });
        showToast("Attendance updated successfully!");
      } else {
        await API.post("/attendance/manual", {
          ...formData,
          date: effectiveDate,
          total_hours: effectiveHours,
          only_admin_clock_out: formData.only_admin_clock_out ? 1 : 0
        });
        showToast("Attendance added successfully!");
      }
      setShowModal(false);
      setEditRecord(null);
      fetchAttendance();
    } catch (err) {
      showToast(err.response?.data?.error || "Action failed", "error");
    }
  };

  // Helper: Convert "18:30" to "06:30 PM"
  const format12Hour = (timeStr) => {
    if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return timeStr || "-";
    const parts = timeStr.split(":");
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] || "00";
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = hours < 10 ? `0${hours}` : hours;
    return `${formattedHours}:${minutes} ${ampm}`;
  };

  // Helper: Calculate duration between two time strings like "09:30" and "18:30"
  const calculateShiftHours = (inTime, outTime) => {
    if (!inTime || !outTime) return "0 hrs";
    const [h1, m1] = inTime.split(":").map(Number);
    const [h2, m2] = outTime.split(":").map(Number);
    let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // overnight shift
    const hrs = (diffMinutes / 60).toFixed(1);
    return `${hrs.endsWith(".0") ? parseInt(hrs, 10) : hrs} hrs`;
  };

  // Helper: Get exact time after X hours from clock_in_time (e.g. 09:30 + 4.75 hrs = 14:15 / 02:15 PM)
  const getTimeAfterHours = (inTime, hoursDecimal) => {
    if (!inTime) return "-";
    const [h, m] = inTime.split(":").map(Number);
    const totalMinutes = h * 60 + m + Math.round(parseFloat(hoursDecimal || 0) * 60);
    const finalHours = Math.floor(totalMinutes / 60) % 24;
    const finalMins = totalMinutes % 60;
    const timeStr = `${finalHours < 10 ? `0${finalHours}` : finalHours}:${finalMins < 10 ? `0${finalMins}` : finalMins}`;
    return format12Hour(timeStr);
  };

  // Helper: Detect if a date string is a Saturday and which Saturday of the month it is
  const getSaturdayBadge = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (d.getDay() !== 6) return null; // Not a Saturday
    const satIndex = Math.ceil(d.getDate() / 7);
    const isHoliday = (satIndex === 2 || satIndex === 4);
    return {
      satIndex,
      isHoliday,
      label: isHoliday ? `${satIndex === 2 ? "2nd" : "4th"} Sat (Holiday)` : `${satIndex === 1 ? "1st" : satIndex === 3 ? "3rd" : "5th"} Sat (Working)`
    };
  };

  if (!canRead) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view Attendance Management.</p>
      </div>
    );
  }

  return (
    <div className="task-page" style={{ padding: "24px" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", margin: 0 }}>Attendance Management</h1>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>
            Real-time Clock In / Clock Out tracking, weekday shift schedules & manual regularization.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {activeTab === "attendance" && canCreate && (
            <button 
              className="primary-button"
              onClick={() => {
                setEditRecord(null);
                setFormData({
                  user_id: staffList[0]?._id || "",
                  user_name: staffList[0]?.name || "",
                  user_email: staffList[0]?.email || "",
                  date: new Date().toISOString().slice(0, 10),
                  status: "Present",
                  total_hours: 8,
                  work_mode: "Office",
                  notes: ""
                });
                setShowModal(true);
              }}
              style={{ background: "#4f46e5", color: "#fff", padding: "10px 18px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "600" }}
            >
              + Add Attendance Entry
            </button>
          )}
        </div>
      </div>

      {/* TOP TABS: ATTENDANCE RECORDS vs WEEKDAY SCHEDULES (Schedules tab visible ONLY to Super Admin) */}
      {isSuperAdmin && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--border-color, #e2e8f0)", paddingBottom: "8px" }}>
          <button
            onClick={() => setActiveTab("attendance")}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              fontWeight: "700",
              fontSize: "14px",
              background: activeTab === "attendance" ? "#4f46e5" : "transparent",
              color: activeTab === "attendance" ? "#fff" : "#64748b",
              cursor: "pointer",
              transition: "0.2s"
            }}
          >
            Attendance Records
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              fontWeight: "700",
              fontSize: "14px",
              background: activeTab === "schedules" ? "#4f46e5" : "transparent",
              color: activeTab === "schedules" ? "#fff" : "#64748b",
              cursor: "pointer",
              transition: "0.2s"
            }}
          >
            Weekday Work Shifts & Schedules
          </button>
        </div>
      )}

      {activeTab === "attendance" && (
        <>
          {/* FILTER BAR */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "20px", background: "var(--ui-surface, #fff)", padding: "16px", borderRadius: "10px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #64748b)", display: "block", marginBottom: "4px" }}>Select Date</label>
              <input 
                type="date" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #64748b)", display: "block", marginBottom: "4px" }}>Status</label>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", minWidth: "150px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
              >
                <option value="">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Half Day">Half Day</option>
                <option value="Absent">Absent</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
            {isSuperAdmin && (
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #64748b)", display: "block", marginBottom: "4px" }}>Admin Clock Out Action</label>
                <button
                  type="button"
                  onClick={() => setFilterPendingClockOut(!filterPendingClockOut)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: filterPendingClockOut ? "1px solid #dc2626" : "1px solid var(--ui-border, #cbd5e1)",
                    background: filterPendingClockOut ? "rgba(220, 38, 38, 0.15)" : "var(--ui-bg, #f8fafc)",
                    color: filterPendingClockOut ? "#ef4444" : "var(--text-main, #475569)",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: filterPendingClockOut ? "#dc2626" : "#94a3b8" }} />
                  Pending Clock Out Only
                </button>
              </div>
            )}
            <div>
              <button 
                onClick={() => { setFilterDate(""); setFilterStatus(""); setFilterPendingClockOut(false); }}
                style={{ padding: "8px 16px", border: "1px solid var(--ui-border, #e2e8f0)", background: "var(--ui-bg, #f8fafc)", color: "var(--text-main, #1e293b)", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
              >
                Clear Filters
              </button>
            </div>
          </div>

      {/* ATTENDANCE TABLE */}
      <div className="table-container" style={{ background: "var(--ui-surface, #fff)", borderRadius: "10px", overflowX: "auto", WebkitOverflowScrolling: "touch", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", width: "100%", border: "1px solid var(--ui-border, #e2e8f0)" }}>
        <table style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "var(--ui-bg, #f8fafc)", borderBottom: "1px solid var(--ui-border, #e2e8f0)", color: "var(--text-muted, #475569)", fontSize: "13px" }}>
              <th style={{ padding: "14px 16px" }}>Employee</th>
              <th style={{ padding: "14px 16px" }}>Date</th>
              <th style={{ padding: "14px 16px" }}>Clock In</th>
              <th style={{ padding: "14px 16px" }}>Clock Out</th>
              <th style={{ padding: "14px 16px" }}>Work Mode</th>
              <th style={{ padding: "14px 16px" }}>Total Hours</th>
              <th style={{ padding: "14px 16px" }}>Status</th>
              {(canUpdate || canDelete || isSuperAdmin || isCompanyOwner) && (
                <th style={{ padding: "14px 16px" }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading attendance...</td>
              </tr>
            ) : attendanceList.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No attendance records found.</td>
              </tr>
            ) : (
              attendanceList.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--ui-border, #f1f5f9)", fontSize: "14px" }}>
                  <td style={{ padding: "14px 16px", fontWeight: "600", color: "var(--text-main, #1e293b)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ color: "var(--text-main, #1e293b)" }}>{row.user_name || "Employee"}</span>
                      {Boolean(row.is_regularized) && (
                        <span style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          background: "#e0e7ff",
                          color: "#4338ca",
                          border: "1px solid #c7d2fe",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}>
                          Edited
                        </span>
                      )}
                      {Boolean(row.only_admin_clock_out) && (
                        <span style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          background: "#fef3c7",
                          color: "#b45309",
                          border: "1px solid #fde68a",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}>
                          Admin Clock-Out Only
                        </span>
                      )}
                    </div>
                    <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted, #64748b)", fontWeight: "400" }}>{row.user_email}</span>
                  </td>
                  <td style={{ padding: "14px 16px", color: "var(--text-main, #334155)" }}>
                    <div>
                      {row.date ? new Date(row.date).toLocaleDateString() : "-"}
                      {(() => {
                        const sat = getSaturdayBadge(row.date);
                        if (!sat) return null;
                        return (
                          <span style={{
                            display: "inline-block",
                            marginLeft: "6px",
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: sat.isHoliday ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.12)",
                            color: sat.isHoliday ? "#ef4444" : "#22c55e",
                            border: sat.isHoliday ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid rgba(34, 197, 94, 0.25)"
                          }}>
                            {sat.label}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#16a34a", fontWeight: "500" }}>
                    {row.clock_in ? new Date(row.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#dc2626", fontWeight: "500" }}>
                    {row.clock_out ? new Date(row.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "4px 8px", background: "var(--ui-bg, #f1f5f9)", color: "var(--text-main, #1e293b)", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "4px", fontSize: "12px" }}>
                      {row.work_mode || "Office"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: "600", color: "var(--text-main, #1e293b)" }}>
                    {row.total_hours ? `${row.total_hours} hrs` : "0.00 hrs"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: "600",
                      background: row.status === "Present" ? "#dcfce7" : row.status === "Half Day" ? "#fef3c7" : "#fee2e2",
                      color: row.status === "Present" ? "#15803d" : row.status === "Half Day" ? "#b45309" : "#b91c1c"
                    }}>
                      {row.status}
                    </span>
                  </td>
                  {(canUpdate || canDelete || isSuperAdmin || isCompanyOwner) && (
                    <td style={{ padding: "14px 16px" }}>
                      <div className="action-buttons" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {/* Clock Out by Admin button if employee clocked in but not clocked out (Admin only) */}
                        {(isSuperAdmin || isCompanyOwner) && row.clock_in && !row.clock_out && (
                          <button
                            onClick={() => handleAdminClockOut(row.id, row.user_name)}
                            title="Clock Out for Staff"
                            style={{
                              background: "#fee2e2",
                              border: "1px solid #fecaca",
                              color: "#dc2626",
                              borderRadius: "6px",
                              padding: "5px 10px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Clock Out
                          </button>
                        )}

                        {canUpdate && (
                          <button 
                            className="action-btn"
                            onClick={() => handleEdit(row)} 
                            title="Edit Attendance"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            className="action-btn delete"
                            onClick={() => handleDelete(row.id)} 
                            title="Delete Attendance"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* TAB 2: WEEKDAY WORK SHIFTS / SCHEDULES (SUPERADMIN ONLY) */}
      {activeTab === "schedules" && isSuperAdmin && (
        <div>
          {/* ⚙️ MONTHLY LATE INSTANCES & GRACE POLICY */}
          <div style={{
            background: "var(--card-bg, var(--ui-surface, #fff))",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "28px",
            border: "1px solid var(--ui-border, #e2e8f0)",
            boxShadow: "var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.03))"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: "800", color: "var(--text-main, #1e293b)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⏱️</span> Monthly Late Instances & Grace Time Policy
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", margin: "4px 0 0" }}>
                  Configure employee monthly late arrival allowances and grace period. Once monthly instances are exhausted, late arrivals automatically receive a First Half Day penalty.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAttSettings} style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "var(--text-main, #1e293b)", marginBottom: "6px" }}>
                  Monthly Late Instances Limit (Count)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={attSettings.monthly_late_instances}
                  onChange={(e) => setAttSettings({ ...attSettings, monthly_late_instances: parseInt(e.target.value) || 0 })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--ui-border, #cbd5e1)",
                    fontSize: "14px",
                    fontWeight: "600",
                    background: "var(--ui-bg, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
                    boxSizing: "border-box"
                  }}
                  placeholder="e.g. 3"
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", display: "block", marginTop: "4px" }}>
                  Max late clock-ins allowed per employee per month (e.g. 3 instances)
                </span>
              </div>

              <div style={{ flex: 1, minWidth: "220px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "var(--text-main, #1e293b)", marginBottom: "6px" }}>
                  Late Grace Time (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={attSettings.late_grace_minutes}
                  onChange={(e) => setAttSettings({ ...attSettings, late_grace_minutes: parseInt(e.target.value) || 0 })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--ui-border, #cbd5e1)",
                    fontSize: "14px",
                    fontWeight: "600",
                    background: "var(--ui-bg, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
                    boxSizing: "border-box"
                  }}
                  placeholder="e.g. 30"
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", display: "block", marginTop: "4px" }}>
                  Arrival after Shift Start + Grace (e.g. 10:00 + 30m = 10:31 AM) counts as late instance
                </span>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  padding: "11px 24px",
                  borderRadius: "10px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)"
                }}
              >
                {savingSettings ? "Saving..." : "Save Policy"}
              </button>
            </form>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main, #1e293b)", margin: 0 }}>
              Company Work Shifts (Weekly Hours)
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", margin: "4px 0 0" }}>
              Set standard Clock In & Clock Out per day of the week (Monday, Tuesday, etc.). Applied across all dates automatically.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {schedules.map((item) => (
              <div
                key={item.id}
                className="shift-card"
                style={{
                  background: "var(--card-bg, var(--ui-surface, #fff))",
                  borderRadius: "14px",
                  padding: "20px",
                  border: item.is_working_day ? "1px solid var(--ui-border, #e2e8f0)" : "1px dashed var(--ui-border, #cbd5e1)",
                  boxShadow: "var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.03))",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  opacity: item.is_working_day ? 1 : 0.75
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-main, #1e293b)" }}>
                    {item.day_of_week}
                  </h4>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: "700",
                      background: item.is_working_day ? "rgba(34, 197, 94, 0.15)" : "var(--ui-border, #f1f5f9)",
                      color: item.is_working_day ? "#22c55e" : "var(--text-muted, #64748b)",
                      border: item.is_working_day ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--ui-border, #cbd5e1)"
                    }}
                  >
                    {item.is_working_day ? "Working Day" : "Off Day"}
                  </span>
                </div>

                <div style={{ 
                  background: "var(--ui-bg, #f8fafc)", 
                  padding: "12px 14px", 
                  borderRadius: "10px", 
                  border: "1px solid var(--ui-border, #f1f5f9)" 
                }}>
                  {item.is_working_day ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <div>
                          <span style={{ display: "block", color: "var(--text-muted, #64748b)", fontSize: "11px", fontWeight: "600" }}>CLOCK IN</span>
                          <strong style={{ color: "#22c55e" }}>{format12Hour(item.clock_in_time)}</strong>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ display: "block", color: "var(--text-muted, #64748b)", fontSize: "11px", fontWeight: "600" }}>CLOCK OUT</span>
                          <strong style={{ color: "#ef4444" }}>{format12Hour(item.clock_out_time)}</strong>
                        </div>
                      </div>
                      <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed var(--ui-border, #e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)", fontWeight: "600" }}>Total Shift Hours:</span>
                        <strong style={{ fontSize: "13px", color: "var(--primary-color, #4f46e5)", background: "var(--primary-light, #e0e7ff)", padding: "2px 8px", borderRadius: "6px" }}>
                          {calculateShiftHours(item.clock_in_time, item.clock_out_time)}
                        </strong>
                      </div>

                      {/* Half-Day Shift Breakdown */}
                      <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={{ background: "rgba(59, 130, 246, 0.1)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                          <span style={{ display: "block", color: "#3b82f6", fontSize: "11px", fontWeight: "700" }}>1ST HALF</span>
                          <strong style={{ color: "#60a5fa", fontSize: "12px" }}>
                            {item.first_half_hours || "4.75"} hrs
                          </strong>
                          <span style={{ display: "block", color: "var(--text-muted, #64748b)", fontSize: "11px", marginTop: "2px" }}>
                            Up to {getTimeAfterHours(item.clock_in_time, item.first_half_hours || 4.75)}
                          </span>
                        </div>
                        <div style={{ background: "rgba(217, 70, 239, 0.1)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(217, 70, 239, 0.2)" }}>
                          <span style={{ display: "block", color: "#d946ef", fontSize: "11px", fontWeight: "700" }}>2ND HALF</span>
                          <strong style={{ color: "#f472b6", fontSize: "12px" }}>
                            {item.second_half_hours || "4.75"} hrs
                          </strong>
                          <span style={{ display: "block", color: "var(--text-muted, #64748b)", fontSize: "11px", marginTop: "2px" }}>
                            After {getTimeAfterHours(item.clock_in_time, item.first_half_hours || 4.75)}
                          </span>
                        </div>
                      </div>
                      {/* Saturday Specific Rule Badge */}
                      {item.day_of_week === "Saturday" && (
                        <div style={{ marginTop: "10px", padding: "8px 10px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
                          <span style={{ display: "block", color: "var(--primary-color, #4f46e5)", fontSize: "11px", fontWeight: "700" }}>SATURDAY HOLIDAY POLICY</span>
                          <span style={{ fontSize: "12px", color: "var(--text-main, #1e293b)", fontWeight: "600", display: "block", marginTop: "2px" }}>
                            {item.saturday_rule === "all_working" ? "All Saturdays Working" : item.saturday_rule === "all_off" ? "All Saturdays Off" : "2nd & 4th Saturday Holiday (1st, 3rd, 5th Working)"}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "13px", padding: "4px 0" }}>
                      Weekend / Non-working
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto", paddingTop: "8px" }}>
                  <button
                    className="action-btn"
                    onClick={() => {
                      setEditingSchedule(item);
                      setScheduleForm({
                        is_working_day: Boolean(item.is_working_day),
                        clock_in_time: item.clock_in_time || "09:30",
                        clock_out_time: item.clock_out_time || "18:30",
                        first_half_hours: item.first_half_hours ? String(item.first_half_hours) : "4.75",
                        second_half_hours: item.second_half_hours ? String(item.second_half_hours) : "4.75",
                        saturday_rule: item.saturday_rule || "2nd_4th_off"
                      });
                      setShowScheduleModal(true);
                    }}
                    title={`Edit ${item.day_of_week} Schedule`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT / ADD ATTENDANCE (Status, Work Mode, Notes) */}
      <FormModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setEditRecord(null);
        }}
        title={editRecord ? "Edit / Regularize Attendance" : "Manual Attendance Entry"}
        onSave={handleSubmit}
        saveText={editRecord ? "Update Record" : "Save Record"}
        maxWidth="480px"
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {editRecord ? (
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Employee</span>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", marginTop: "2px" }}>
                {formData.user_name} <span style={{ fontWeight: "400", color: "#64748b", fontSize: "12px" }}>({formData.user_email})</span>
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)", display: "block", marginBottom: "4px" }}>Select Staff</label>
              <select 
                value={formData.user_id} 
                onChange={(e) => {
                  const sel = staffList.find(s => s._id === e.target.value);
                  setFormData({
                    ...formData,
                    user_id: e.target.value,
                    user_name: sel ? sel.name : "",
                    user_email: sel ? sel.email : ""
                  });
                }}
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
              >
                <option value="">-- Choose Employee --</option>
                {staffList.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)", display: "block", marginBottom: "4px" }}>Status</label>
            <select 
              value={formData.status} 
              onChange={(e) => {
                const newStatus = e.target.value;
                const autoHours = newStatus === "Present" ? 8 : newStatus === "Half Day" ? 4 : 0;
                setFormData({ ...formData, status: newStatus, total_hours: autoHours });
              }}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
            >
              <option value="Present">Present</option>
              <option value="Half Day">Half Day</option>
              <option value="Absent">Absent</option>
              <option value="On Leave">On Leave</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)", display: "block", marginBottom: "4px" }}>Work Mode</label>
            <select 
              value={formData.work_mode} 
              onChange={(e) => setFormData({ ...formData, work_mode: e.target.value })}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
            >
              <option value="Office">Office</option>
              <option value="Work From Home">Work From Home</option>
              <option value="On-site">On-site</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)", display: "block", marginBottom: "4px" }}>Admin Notes</label>
            <textarea 
              value={formData.notes} 
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Regularized by Super Admin"
              rows="2"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
            />
          </div>

          <div style={{ background: "var(--ui-bg, #f8fafc)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--ui-border, #e2e8f0)" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", margin: 0 }}>
              <input
                type="checkbox"
                checked={formData.only_admin_clock_out}
                onChange={(e) => setFormData({ ...formData, only_admin_clock_out: e.target.checked })}
                style={{ width: "18px", height: "18px", marginTop: "2px", cursor: "pointer" }}
              />
              <div>
                <strong style={{ fontSize: "13px", color: "var(--text-main, #1e293b)", display: "block" }}>
                  Only Admin Can Clock Out
                </strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                  Employee cannot clock out themselves from the dashboard. Their clock out can only be completed by an Admin.
                </span>
              </div>
            </label>
          </div>
        </form>
      </FormModal>

      {/* MODAL 2: EDIT WORK SCHEDULE / SHIFT (Monday, Tuesday, etc.) */}
      <FormModal
        show={showScheduleModal && !!editingSchedule}
        onClose={() => {
          setShowScheduleModal(false);
          setEditingSchedule(null);
        }}
        title={`Edit Shift: ${editingSchedule?.day_of_week || ""}`}
        onSave={handleSaveSchedule}
        saveText="Update Shift"
        maxWidth="440px"
      >
        <form onSubmit={handleSaveSchedule} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "600", color: "#1e293b", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={scheduleForm.is_working_day}
                onChange={(e) => setScheduleForm({ ...scheduleForm, is_working_day: e.target.checked })}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              Mark as Working Day
            </label>
          </div>

          {editingSchedule?.day_of_week === "Saturday" && (
            <div style={{ background: "rgba(99, 102, 241, 0.08)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-color, #4f46e5)", display: "block", marginBottom: "6px" }}>
                Saturday Holiday Rule
              </label>
              <select
                value={scheduleForm.saturday_rule || "2nd_4th_off"}
                onChange={(e) => setScheduleForm({ ...scheduleForm, saturday_rule: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)", fontWeight: "600" }}
              >
                <option value="2nd_4th_off">2nd & 4th Saturday Off (1st, 3rd, 5th Working)</option>
                <option value="all_working">All Saturdays Working</option>
                <option value="all_off">All Saturdays Off (Holiday)</option>
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted, #64748b)", marginTop: "6px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>
                  {scheduleForm.saturday_rule === "2nd_4th_off" && "The 2nd and 4th Saturday of every month will be treated as company holidays."}
                  {scheduleForm.saturday_rule === "all_working" && "Employees are required to clock in on all Saturdays."}
                  {scheduleForm.saturday_rule === "all_off" && "All Saturdays are non-working company off days."}
                </span>
              </div>
            </div>
          )}

          {scheduleForm.is_working_day && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)", display: "block", marginBottom: "4px" }}>
                  Clock In Time
                </label>
                <input
                  type="time"
                  value={scheduleForm.clock_in_time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, clock_in_time: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", marginTop: "2px", display: "block" }}>
                  {format12Hour(scheduleForm.clock_in_time)}
                </span>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)", display: "block", marginBottom: "4px" }}>
                  Clock Out Time
                </label>
                <input
                  type="time"
                  value={scheduleForm.clock_out_time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, clock_out_time: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", marginTop: "2px", display: "block" }}>
                  {format12Hour(scheduleForm.clock_out_time)}
                </span>
              </div>
            </div>
          )}

          {scheduleForm.is_working_day && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)", display: "block", marginBottom: "4px" }}>
                  First Half Hours (1st Half)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="1"
                  max="12"
                  value={scheduleForm.first_half_hours}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, first_half_hours: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                />
                <span style={{ fontSize: "11px", color: "#3b82f6", marginTop: "2px", display: "block" }}>
                  Ends at: {getTimeAfterHours(scheduleForm.clock_in_time, scheduleForm.first_half_hours)}
                </span>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)", display: "block", marginBottom: "4px" }}>
                  Second Half Hours (2nd Half)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="1"
                  max="12"
                  value={scheduleForm.second_half_hours}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, second_half_hours: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                />
                <span style={{ fontSize: "11px", color: "#d946ef", marginTop: "2px", display: "block" }}>
                  Starts at: {getTimeAfterHours(scheduleForm.clock_in_time, scheduleForm.first_half_hours)}
                </span>
              </div>
            </div>
          )}

          {scheduleForm.is_working_day && (
            <div style={{ background: "rgba(34, 197, 94, 0.1)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.25)", fontSize: "12px", color: "var(--text-main, #166534)", lineHeight: "1.5", display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div>
                <strong>Automatic Leave Integration:</strong> If an employee tries to Clock Out before <strong>{getTimeAfterHours(scheduleForm.clock_in_time, scheduleForm.first_half_hours)}</strong>, they must apply for <strong>First Half Leave</strong>. After this time, they must apply for <strong>Second Half Leave</strong>.
              </div>
            </div>
          )}

          {scheduleForm.is_working_day && (
            <div style={{ background: "var(--ui-bg, #f8fafc)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--ui-border, #e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>Calculated Shift Duration:</span>
              <strong style={{ fontSize: "14px", color: "var(--primary-color, #4f46e5)", background: "var(--primary-light, #e0e7ff)", padding: "4px 10px", borderRadius: "6px" }}>
                {calculateShiftHours(scheduleForm.clock_in_time, scheduleForm.clock_out_time)}
              </strong>
            </div>
          )}
        </form>
      </FormModal>
    </div>
  );
}
