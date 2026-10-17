import React, { useState, useEffect } from "react";
import API from "../api/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionContext";
import { EditIcon, TimerIcon, ShieldIcon } from "../components/common/Icons";
import "../style/main.css";
import "../style/table.css";

export default function LeaveManagement() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();

  const isSuperAdmin = user?.email === "gadanipranav@gmail.com" || user?.role?.name === "Super Admin";
  const isCompanyOwner = user?.role?.name === "Company Owner";

  // Role & Permission based capabilities
  const canRead = isSuperAdmin || isCompanyOwner || hasPermission("leave_management", "read");
  const canCreate = isSuperAdmin || isCompanyOwner || hasPermission("leave_management", "create");
  const canApprove = isSuperAdmin || isCompanyOwner || hasPermission("leave_management", "update");
  const canManagePolicy = isSuperAdmin || isCompanyOwner;

  // Initial tab based on role & permissions
  const [activeTab, setActiveTab] = useState(
    (isSuperAdmin || isCompanyOwner) && canApprove
      ? "approvals"
      : canCreate
      ? "apply"
      : canApprove
      ? "approvals"
      : "apply"
  );
  const [balance, setBalance] = useState({ cl_balance: 12, sl_balance: 8, pl_balance: 15, comp_off: 0 });
  const [adminSummary, setAdminSummary] = useState({ pendingCount: 0, approvedThisMonth: 0, rejectedCount: 0, onLeaveToday: 0 });
  const [myLeaves, setMyLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [allBalances, setAllBalances] = useState([]);
  const [policyForm, setPolicyForm] = useState({ cl_default: 12, sl_default: 8, pl_default: 15, comp_off_default: 2, applyToExisting: true });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [myShortLeaves, setMyShortLeaves] = useState([]);
  const [, setLoading] = useState(false);

  // Leave Form State
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "Casual Leave",
    from_date: new Date().toISOString().slice(0, 10),
    to_date: new Date().toISOString().slice(0, 10),
    day_type: "Full Day",
    reason: ""
  });

  // Short Leave Form State
  const [shortLeaveForm, setShortLeaveForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    from_time: "14:00",
    to_time: "16:00",
    hours: 2,
    reason: ""
  });

  const fetchBalance = async () => {
    try {
      const res = await API.get("/leave/balance");
      if (res.data) setBalance(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminSummary = async () => {
    try {
      const res = await API.get("/leave/admin-summary");
      if (res.data) setAdminSummary(res.data);
    } catch (err) {
      console.error("Admin summary load error:", err);
    }
  };

  const fetchMyLeaves = async () => {
    try {
      setLoading(true);
      const res = await API.get("/leave/my-leaves");
      setMyLeaves(res.data || []);
    } catch {
      showToast("Error loading my leaves", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLeaves = async () => {
    try {
      setLoading(true);
      const res = await API.get("/leave/all");
      setAllLeaves(res.data || []);
    } catch {
      showToast("Error loading leave requests", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyShortLeaves = async () => {
    try {
      const res = await API.get("/leave/my-short-leaves");
      setMyShortLeaves(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCompanyPolicy = async () => {
    try {
      const res = await API.get("/leave/company-policy");
      if (res.data) {
        setPolicyForm(prev => ({
          ...prev,
          cl_default: res.data.cl_default ?? 12,
          sl_default: res.data.sl_default ?? 8,
          pl_default: res.data.pl_default ?? 15,
          comp_off_default: res.data.comp_off_default ?? 2
        }));
      }
    } catch (err) {
      console.error("Policy load error:", err);
    }
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    try {
      setPolicyLoading(true);
      const res = await API.put("/leave/company-policy", policyForm);
      showToast(res.data?.message || "Company Leave Policy saved!");
      fetchAllBalances();
    } catch {
      showToast("Failed to save company policy", "error");
    } finally {
      setPolicyLoading(false);
    }
  };

  const fetchAllBalances = async () => {
    try {
      const res = await API.get("/leave/admin/balances");
      setAllBalances(res.data || []);
    } catch {
      showToast("Error loading balances", "error");
    }
  };

  useEffect(() => {
    if (!canRead) return;

    // Load employee personal data
    fetchBalance();
    fetchMyLeaves();
    fetchMyShortLeaves();

    // Load admin approvals & balances only if user has approval/update permission
    if (canApprove) {
      fetchAllLeaves();
      fetchAdminSummary();
      fetchAllBalances();
    }

    // Load company policy only if superadmin or company owner
    if (canManagePolicy) {
      fetchCompanyPolicy();
    }
  }, [canRead, canApprove, canManagePolicy]);

  // Submit Leave
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/leave/apply", leaveForm);
      showToast(res.data.message || "Leave applied!");
      setLeaveForm({
        leave_type: "Casual Leave",
        from_date: new Date().toISOString().slice(0, 10),
        to_date: new Date().toISOString().slice(0, 10),
        day_type: "Full Day",
        reason: ""
      });
      fetchBalance();
      fetchMyLeaves();
      if (isSuperAdmin) {
        fetchAllLeaves();
        fetchAdminSummary();
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to apply leave", "error");
    }
  };

  // Submit Short Leave
  const handleApplyShortLeave = async (e) => {
    e.preventDefault();
    try {
      await API.post("/leave/short-leave", shortLeaveForm);
      showToast("Short Leave logged successfully!");
      setShortLeaveForm({
        date: new Date().toISOString().slice(0, 10),
        from_time: "14:00",
        to_time: "16:00",
        hours: 2,
        reason: ""
      });
      fetchMyShortLeaves();
    } catch {
      showToast("Failed to apply short leave", "error");
    }
  };

  // Super Admin Action: Approve / Reject
  const handleLeaveAction = async (id, action) => {
    try {
      await API.patch(`/leave/${id}/action`, { action });
      showToast(`Leave request ${action}!`);
      fetchAllLeaves();
      fetchAdminSummary();
      fetchMyLeaves();
      fetchBalance();
    } catch (err) {
      showToast(err?.response?.data?.error || "Action failed", "error");
    }
  };

  if (!canRead) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view Leave Management.</p>
      </div>
    );
  }

  return (
    <div className="task-page" style={{ padding: "24px" }}>
      {/* HEADER */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
          Leave & Absence Management
        </h1>
        <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>
          {canApprove
            ? "Manager / Admin Portal: Review, approve, or reject employee leave applications and monitor company absences."
            : "Employee Portal: Apply for Casual, Sick, Privilege Leave or Short Leaves with automated attendance integration."}
        </p>
      </div>

      {/* TOP SUMMARY CARDS */}
      {(isSuperAdmin || isCompanyOwner) ? (
        /* SUPER ADMIN / OWNER OVERVIEW CARDS */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #fed7aa", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#ea580c", textTransform: "uppercase" }}>Pending Approval</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#c2410c", marginTop: "4px" }}>
              {adminSummary.pendingCount} <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>Requests</span>
            </div>
            <div style={{ fontSize: "12px", color: "#9a3412", marginTop: "4px" }}>Requires your review & decision</div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #bbf7d0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Approved (This Month)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#15803d", marginTop: "4px" }}>
              {adminSummary.approvedThisMonth} <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>Leaves</span>
            </div>
            <div style={{ fontSize: "12px", color: "#166534", marginTop: "4px" }}>Current calendar month</div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #bae6fd", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#0284c7", textTransform: "uppercase" }}>On Leave Today</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#0369a1", marginTop: "4px" }}>
              {adminSummary.onLeaveToday} <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>Staff</span>
            </div>
            <div style={{ fontSize: "12px", color: "#075985", marginTop: "4px" }}>Active on-leave employees today</div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #fecaca", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#dc2626", textTransform: "uppercase" }}>Rejected Leaves</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#b91c1c", marginTop: "4px" }}>
              {adminSummary.rejectedCount} <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>Requests</span>
            </div>
            <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "4px" }}>Disapproved requests</div>
          </div>
        </div>
      ) : (
        /* ALL EMPLOYEES & DEVELOPERS: PERSONAL LEAVE BALANCES (CL, SL, PL, Comp-Off) */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#4f46e5", textTransform: "uppercase" }}>Casual Leave (CL)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>{balance.cl_balance} <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>Days</span></div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Annual quota balance</div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Sick Leave (SL)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>{balance.sl_balance} <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>Days</span></div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Medical certificate if &gt; 2 days</div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#f97316", textTransform: "uppercase" }}>Privilege Leave (PL)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>{balance.pl_balance} <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>Days</span></div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Earned & Planned leaves</div>
          </div>

          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#06b6d4", textTransform: "uppercase" }}>Comp-Off</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>{balance.comp_off} <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>Days</span></div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Against weekend work</div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid #e2e8f0", marginBottom: "20px", flexWrap: "wrap" }}>
        {/* TAB 1: Apply Leave (Requires Create Permission) */}
        {canCreate && (
          <button
            onClick={() => setActiveTab("apply")}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "apply" ? "3px solid #4f46e5" : "none",
              fontWeight: activeTab === "apply" ? "700" : "500",
              color: activeTab === "apply" ? "#4f46e5" : "#64748b",
              cursor: "pointer",
              fontSize: "15px"
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <EditIcon size={15} /> Apply Leave & History
            </span>
          </button>
        )}

        {/* TAB 2: Short Leave (Requires Create Permission) */}
        {canCreate && (
          <button
            onClick={() => setActiveTab("shortleave")}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "shortleave" ? "3px solid #06b6d4" : "none",
              fontWeight: activeTab === "shortleave" ? "700" : "500",
              color: activeTab === "shortleave" ? "#06b6d4" : "#64748b",
              cursor: "pointer",
              fontSize: "15px"
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <TimerIcon size={16} /> Short Leave (2 hrs)
            </span>
          </button>
        )}

        {/* TAB 3: Leave Approvals (Requires Update/Approval Permission) */}
        {canApprove && (
          <button
            onClick={() => setActiveTab("approvals")}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "approvals" ? "3px solid #16a34a" : "none",
              fontWeight: activeTab === "approvals" ? "700" : "500",
              color: activeTab === "approvals" ? "#16a34a" : "#64748b",
              cursor: "pointer",
              fontSize: "15px"
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <ShieldIcon size={16} /> Leave Approvals ({allLeaves.filter(l => l.status === "Pending").length})
            </span>
          </button>
        )}

        {/* TAB 4: Company Leave Policy (Requires Admin/Owner) */}
        {canManagePolicy && (
          <button
            onClick={() => setActiveTab("manage-balances")}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "manage-balances" ? "3px solid #4f46e5" : "none",
              fontWeight: activeTab === "manage-balances" ? "700" : "500",
              color: activeTab === "manage-balances" ? "#4f46e5" : "#64748b",
              cursor: "pointer",
              fontSize: "15px"
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <EditIcon size={15} /> Company Leave Policy (Global Rule)
            </span>
          </button>
        )}
      </div>

      {/* TAB 1: APPLY LEAVE */}
      {activeTab === "apply" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
          {/* FORM */}
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "17px", fontWeight: "700", color: "#1e293b" }}>Apply for Leave</h3>
            <form onSubmit={handleApplyLeave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Leave Type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                >
                  <option value="Casual Leave">Casual Leave (CL)</option>
                  <option value="Sick Leave">Sick Leave (SL)</option>
                  <option value="Privilege Leave">Privilege Leave (PL)</option>
                  <option value="Comp-Off">Comp-Off</option>
                  <option value="Unpaid Leave">Unpaid Leave (LOP)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Day Type</label>
                <select
                  value={leaveForm.day_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, day_type: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                >
                  <option value="Full Day">Full Day</option>
                  <option value="First Half">First Half (Half Day)</option>
                  <option value="Second Half">Second Half (Half Day)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>From Date</label>
                <input
                  type="date"
                  required
                  value={leaveForm.from_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>To Date</label>
                <input
                  type="date"
                  required
                  value={leaveForm.to_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Reason</label>
                <textarea
                  rows="3"
                  required
                  placeholder="State the reason for leave..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: "700",
                  cursor: "pointer",
                  marginTop: "6px"
                }}
              >
                Submit Application
              </button>
            </form>
          </div>

          {/* MY LEAVES TABLE */}
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", fontWeight: "700", color: "#1e293b" }}>
              My Leave History
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "13px" }}>
                  <th style={{ padding: "12px 16px" }}>Leave Type</th>
                  <th style={{ padding: "12px 16px" }}>Dates</th>
                  <th style={{ padding: "12px 16px" }}>Days</th>
                  <th style={{ padding: "12px 16px" }}>Reason</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myLeaves.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>No leaves applied yet.</td></tr>
                ) : (
                  myLeaves.map(l => (
                    <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                      <td style={{ padding: "12px 16px", fontWeight: "600" }}>{l.leave_type}</td>
                      <td style={{ padding: "12px 16px", color: "#334155" }}>
                        {new Date(l.from_date).toLocaleDateString()} - {new Date(l.to_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: "600" }}>{l.total_days} day(s)</td>
                      <td style={{ padding: "12px 16px", color: "#64748b" }}>{l.reason}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700",
                          background: l.status === "Approved" ? "#dcfce7" : l.status === "Pending" ? "#fef3c7" : "#fee2e2",
                          color: l.status === "Approved" ? "#16a34a" : l.status === "Pending" ? "#b45309" : "#b91c1c"
                        }}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SHORT LEAVE */}
      {activeTab === "shortleave" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "17px", fontWeight: "700", color: "#1e293b" }}>Log Short Leave (Max 2 Hrs)</h3>
            <form onSubmit={handleApplyShortLeave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Date</label>
                <input
                  type="date"
                  required
                  value={shortLeaveForm.date}
                  onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, date: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>From Time</label>
                  <input
                    type="time"
                    required
                    value={shortLeaveForm.from_time}
                    onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, from_time: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>To Time</label>
                  <input
                    type="time"
                    required
                    value={shortLeaveForm.to_time}
                    onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, to_time: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Reason</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Doctor, Bank, Personal errand..."
                  value={shortLeaveForm.reason}
                  onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, reason: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: "#06b6d4",
                  color: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: "700",
                  cursor: "pointer",
                  marginTop: "6px"
                }}
              >
                Log Short Leave
              </button>
            </form>
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", fontWeight: "700", color: "#1e293b" }}>
              My Short Leave History
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "13px" }}>
                  <th style={{ padding: "12px 16px" }}>Date</th>
                  <th style={{ padding: "12px 16px" }}>Time Window</th>
                  <th style={{ padding: "12px 16px" }}>Duration</th>
                  <th style={{ padding: "12px 16px" }}>Reason</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myShortLeaves.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>No short leaves taken.</td></tr>
                ) : (
                  myShortLeaves.map(sl => (
                    <tr key={sl.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                      <td style={{ padding: "12px 16px", fontWeight: "600" }}>{new Date(sl.date).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 16px" }}>{sl.from_time} - {sl.to_time}</td>
                      <td style={{ padding: "12px 16px" }}>{sl.hours} hrs</td>
                      <td style={{ padding: "12px 16px", color: "#64748b" }}>{sl.reason}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", background: "#dcfce7", color: "#16a34a" }}>
                          {sl.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN APPROVALS */}
      {activeTab === "approvals" && canApprove && (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", fontWeight: "700", color: "#1e293b" }}>
            All Employee Leave Requests (Approvals & Decision)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "13px" }}>
                <th style={{ padding: "14px 16px" }}>Employee</th>
                <th style={{ padding: "14px 16px" }}>Type</th>
                <th style={{ padding: "14px 16px" }}>Duration</th>
                <th style={{ padding: "14px 16px" }}>Days</th>
                <th style={{ padding: "14px 16px" }}>Reason</th>
                <th style={{ padding: "14px 16px" }}>Status</th>
                <th style={{ padding: "14px 16px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {allLeaves.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No leave requests found.</td></tr>
              ) : (
                allLeaves.map(l => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "14px" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "#1e293b" }}>{l.user_name}</strong>
                      <span style={{ display: "block", fontSize: "12px", color: "#64748b" }}>{l.user_email}</span>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "600" }}>{l.leave_type}</td>
                    <td style={{ padding: "14px 16px" }}>
                      {new Date(l.from_date).toLocaleDateString()} to {new Date(l.to_date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "700" }}>{l.total_days}</td>
                    <td style={{ padding: "14px 16px", color: "#475569" }}>{l.reason}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "14px", fontSize: "12px", fontWeight: "700",
                        background: l.status === "Approved" ? "#dcfce7" : l.status === "Pending" ? "#fef3c7" : "#fee2e2",
                        color: l.status === "Approved" ? "#16a34a" : l.status === "Pending" ? "#b45309" : "#b91c1c"
                      }}>
                        {l.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {l.status === "Pending" ? (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleLeaveAction(l.id, "Approved")}
                            style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "700" }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleLeaveAction(l.id, "Rejected")}
                            style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "700" }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "12px" }}>Decided by {l.approved_by || "Admin"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: COMPANY-WIDE GLOBAL LEAVE POLICY (OPTION 1) */}
      {activeTab === "manage-balances" && canManagePolicy && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* 1. Global Policy Configuration Card */}
          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldIcon size={20} color="#4f46e5" /> Company-Wide Leave Policy
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Define global annual leave quotas for all company employees from a single place.
                </p>
              </div>
              <span style={{ fontSize: "12px", background: "#ecfdf5", color: "#059669", padding: "4px 10px", borderRadius: "12px", fontWeight: "700" }}>
                Active Company Policy
              </span>
            </div>

            <form onSubmit={handleSavePolicy}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
                {/* CL */}
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#4f46e5", display: "block", marginBottom: "6px" }}>
                    Casual Leave (CL)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={policyForm.cl_default}
                      onChange={(e) => setPolicyForm({ ...policyForm, cl_default: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: "90px", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "15px", fontWeight: "700" }}
                    />
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>Days / Year</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>Annual unplanned / personal leaves</div>
                </div>

                {/* SL */}
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#16a34a", display: "block", marginBottom: "6px" }}>
                    Sick Leave (SL)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={policyForm.sl_default}
                      onChange={(e) => setPolicyForm({ ...policyForm, sl_default: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: "90px", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "15px", fontWeight: "700" }}
                    />
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>Days / Year</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>Medical & health recovery leaves</div>
                </div>

                {/* PL */}
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #ea580c", borderLeftWidth: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#ea580c", display: "block", marginBottom: "6px" }}>
                    Privilege Leave (PL)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={policyForm.pl_default}
                      onChange={(e) => setPolicyForm({ ...policyForm, pl_default: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: "90px", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "15px", fontWeight: "700" }}
                    />
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>Days / Year</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>Planned vacations & earned leaves</div>
                </div>

                {/* Comp-Off */}
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#0284c7", display: "block", marginBottom: "6px" }}>
                    Comp-Off
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={policyForm.comp_off_default}
                      onChange={(e) => setPolicyForm({ ...policyForm, comp_off_default: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: "90px", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "15px", fontWeight: "700" }}
                    />
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>Days Base</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>Granted for extra weekend shifts</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={policyForm.applyToExisting}
                    onChange={(e) => setPolicyForm({ ...policyForm, applyToExisting: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "#4f46e5" }}
                  />
                  <span>Apply updated policy quotas to all existing employees</span>
                </label>

                <button
                  type="submit"
                  disabled={policyLoading}
                  style={{
                    padding: "10px 24px",
                    background: "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "14px",
                    boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)"
                  }}
                >
                  {policyLoading ? "Saving..." : "Save Company Policy"}
                </button>
              </div>
            </form>
          </div>

          {/* 2. Overview of Employees & Balances */}
          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
              <strong style={{ fontSize: "16px", color: "#1e293b" }}>Current Staff Leave Overview</strong>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                Employee leave balances allocated via company policy. Deducted automatically upon approved leaves.
              </p>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "13px" }}>
                  <th style={{ padding: "14px 16px" }}>Employee</th>
                  <th style={{ padding: "14px 16px" }}>Casual (CL)</th>
                  <th style={{ padding: "14px 16px" }}>Sick (SL)</th>
                  <th style={{ padding: "14px 16px" }}>Privilege (PL)</th>
                  <th style={{ padding: "14px 16px" }}>Comp-Off</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {allBalances.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>No staff records.</td></tr>
                ) : (
                  allBalances.map(b => (
                    <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "14px" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <strong style={{ color: "#1e293b" }}>{b.user_name}</strong>
                        <span style={{ display: "block", fontSize: "12px", color: "#64748b" }}>{b.user_email || "Company Staff"}</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "700", color: "#4f46e5", background: "#e0e7ff", padding: "3px 10px", borderRadius: "8px" }}>
                          {b.cl_balance} Days
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "700", color: "#16a34a", background: "#dcfce7", padding: "3px 10px", borderRadius: "8px" }}>
                          {b.sl_balance} Days
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "700", color: "#ea580c", background: "#ffedd5", padding: "3px 10px", borderRadius: "8px" }}>
                          {b.pl_balance} Days
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "700", color: "#0284c7", background: "#e0f2fe", padding: "3px 10px", borderRadius: "8px" }}>
                          {b.comp_off} Days
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", background: "#dcfce7", color: "#16a34a" }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
