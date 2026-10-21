import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
    isSuperAdmin
      ? "approvals"
      : isCompanyOwner && canApprove
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

  const [searchParams] = useSearchParams();

  // Auto pre-fill if redirected from missed clock-out notice
  useEffect(() => {
    const qDate = searchParams.get("date");
    const qType = searchParams.get("type");
    if (qDate) {
      setActiveTab("apply");
      setLeaveForm(prev => ({
        ...prev,
        from_date: qDate,
        to_date: qDate,
        day_type: qType || "Second Half",
        reason: `Auto Clock Out on ${qDate} - Applied for Second Half Leave`
      }));
    }
  }, [searchParams]);

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
    if (new Date(leaveForm.to_date) < new Date(leaveForm.from_date)) {
      showToast("'To Date' cannot be earlier than 'From Date'!", "error");
      return;
    }
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
          <div style={{ background: "var(--ui-surface, #ffffff)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--ui-border, #fed7aa)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#f97316", textTransform: "uppercase" }}>Pending Approval</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#fb923c", marginTop: "4px" }}>
              {adminSummary.pendingCount} <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500" }}>Requests</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #9a3412)", marginTop: "4px" }}>Requires your review & decision</div>
          </div>

          <div style={{ background: "var(--ui-surface, #ffffff)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--ui-border, #bbf7d0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#10b981", textTransform: "uppercase" }}>Approved (This Month)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#34d399", marginTop: "4px" }}>
              {adminSummary.approvedThisMonth} <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500" }}>Leaves</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #166534)", marginTop: "4px" }}>Current calendar month</div>
          </div>

          <div style={{ background: "var(--ui-surface, #ffffff)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--ui-border, #bae6fd)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#0ea5e9", textTransform: "uppercase" }}>On Leave Today</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#38bdf8", marginTop: "4px" }}>
              {adminSummary.onLeaveToday} <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500" }}>Staff</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #075985)", marginTop: "4px" }}>Active on-leave employees today</div>
          </div>

          <div style={{ background: "var(--ui-surface, #ffffff)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--ui-border, #fecaca)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#ef4444", textTransform: "uppercase" }}>Rejected Leaves</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#f87171", marginTop: "4px" }}>
              {adminSummary.rejectedCount} <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500" }}>Requests</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #991b1b)", marginTop: "4px" }}>Disapproved requests</div>
          </div>
        </div>
      ) : (
        /* ALL EMPLOYEES & DEVELOPERS: PERSONAL LEAVE BALANCES (CL, SL, PL, Comp-Off) */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          <div style={{ background: "var(--ui-surface, #ffffff)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#4f46e5", textTransform: "uppercase" }}>Casual Leave (CL)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-main, #1e293b)", marginTop: "4px" }}>{balance.cl_balance} <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500" }}>Days</span></div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "4px" }}>Annual quota balance</div>
          </div>

          <div style={{ background: "var(--ui-surface, #ffffff)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Sick Leave (SL)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-main, #1e293b)", marginTop: "4px" }}>{balance.sl_balance} <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500" }}>Days</span></div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "4px" }}>Medical certificate if &gt; 2 days</div>
          </div>

          <div style={{ background: "var(--ui-surface, #ffffff)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#f97316", textTransform: "uppercase" }}>Privilege Leave (PL)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-main, #1e293b)", marginTop: "4px" }}>{balance.pl_balance} <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500" }}>Days</span></div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "4px" }}>Earned & Planned leaves</div>
          </div>

          <div style={{ background: "var(--ui-surface, #ffffff)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#06b6d4", textTransform: "uppercase" }}>Comp-Off</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-main, #1e293b)", marginTop: "4px" }}>{balance.comp_off} <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500" }}>Days</span></div>
            <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "4px" }}>Against weekend work</div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--ui-border, #e2e8f0)", marginBottom: "20px", flexWrap: "wrap" }}>
        {/* TAB 1: Apply Leave (Employees/Managers only — Super Admin does not apply leave) */}
        {!isSuperAdmin && canCreate && (
          <button
            onClick={() => setActiveTab("apply")}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "apply" ? "3px solid #4f46e5" : "none",
              fontWeight: activeTab === "apply" ? "700" : "500",
              color: activeTab === "apply" ? "#818cf8" : "var(--text-muted, #64748b)",
              cursor: "pointer",
              fontSize: "15px"
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <EditIcon size={15} /> Apply Leave & History
            </span>
          </button>
        )}

        {/* TAB 2: Short Leave (Employees/Managers only — Super Admin does not apply leave) */}
        {!isSuperAdmin && canCreate && (
          <button
            onClick={() => setActiveTab("shortleave")}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "shortleave" ? "3px solid #06b6d4" : "none",
              fontWeight: activeTab === "shortleave" ? "700" : "500",
              color: activeTab === "shortleave" ? "#22d3ee" : "var(--text-muted, #64748b)",
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
              color: activeTab === "approvals" ? "#34d399" : "var(--text-muted, #64748b)",
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
              color: activeTab === "manage-balances" ? "#818cf8" : "var(--text-muted, #64748b)",
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          {/* FORM */}
          <div style={{ background: "var(--ui-surface, #fff)", padding: "24px", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "17px", fontWeight: "700", color: "var(--text-main, #1e293b)" }}>Apply for Leave</h3>
            <form onSubmit={handleApplyLeave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>Leave Type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                >
                  <option value="Casual Leave">Casual Leave (CL)</option>
                  <option value="Sick Leave">Sick Leave (SL)</option>
                  <option value="Privilege Leave">Privilege Leave (PL)</option>
                  <option value="Comp-Off">Comp-Off</option>
                  <option value="Unpaid Leave">Unpaid Leave (LOP)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>Day Type</label>
                <select
                  value={leaveForm.day_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, day_type: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                >
                  <option value="Full Day">Full Day</option>
                  <option value="First Half">First Half (Half Day)</option>
                  <option value="Second Half">Second Half (Half Day)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>From Date</label>
                <input
                  type="date"
                  required
                  value={leaveForm.from_date}
                  onChange={(e) => {
                    const newFrom = e.target.value;
                    setLeaveForm(prev => ({
                      ...prev,
                      from_date: newFrom,
                      to_date: prev.to_date < newFrom ? newFrom : prev.to_date
                    }));
                  }}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>To Date</label>
                <input
                  type="date"
                  required
                  min={leaveForm.from_date}
                  value={leaveForm.to_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>Reason</label>
                <textarea
                  rows="3"
                  required
                  placeholder="State the reason for leave..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
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
          <div className="table-container" style={{ background: "var(--ui-surface, #fff)", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", overflowX: "auto", WebkitOverflowScrolling: "touch", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", width: "100%" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ui-border, #e2e8f0)", fontWeight: "700", color: "var(--text-main, #1e293b)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <span>My Leave History</span>
              <span className="mobile-scroll-hint" style={{ fontSize: "11px", color: "var(--primary-color, #4f46e5)", fontWeight: "600", background: "rgba(79, 70, 229, 0.12)", padding: "3px 8px", borderRadius: "6px" }}>
                ⇄ Swipe table for full info
              </span>
            </div>
            <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--ui-bg, #f8fafc)", borderBottom: "1px solid var(--ui-border, #e2e8f0)", color: "var(--text-muted, #475569)", fontSize: "13px" }}>
                  <th style={{ padding: "12px 16px" }}>Leave Type</th>
                  <th style={{ padding: "12px 16px" }}>Dates</th>
                  <th style={{ padding: "12px 16px" }}>Days</th>
                  <th style={{ padding: "12px 16px" }}>Reason</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myLeaves.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>No leaves applied yet.</td></tr>
                ) : (
                  myLeaves.map(l => (
                    <tr key={l.id} style={{ borderBottom: "1px solid var(--ui-border, #f1f5f9)", fontSize: "13px" }}>
                      <td style={{ padding: "12px 16px", fontWeight: "600", color: "var(--text-main, #1e293b)" }}>{l.leave_type}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-main, #334155)" }}>
                        {new Date(l.from_date).toLocaleDateString()} - {new Date(l.to_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: "600", color: "var(--text-main, #1e293b)" }}>{l.total_days} day(s)</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted, #94a3b8)" }}>{l.reason}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700",
                          background: l.status === "Approved" ? "rgba(16, 185, 129, 0.15)" : l.status === "Pending" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: l.status === "Approved" ? "#10b981" : l.status === "Pending" ? "#f59e0b" : "#ef4444"
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          <div style={{ background: "var(--ui-surface, #fff)", padding: "24px", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "17px", fontWeight: "700", color: "var(--text-main, #1e293b)" }}>Log Short Leave (Max 2 Hrs)</h3>
            <form onSubmit={handleApplyShortLeave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>Date</label>
                <input
                  type="date"
                  required
                  value={shortLeaveForm.date}
                  onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, date: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>From Time</label>
                  <input
                    type="time"
                    required
                    value={shortLeaveForm.from_time}
                    onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, from_time: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>To Time</label>
                  <input
                    type="time"
                    required
                    value={shortLeaveForm.to_time}
                    onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, to_time: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted, #475569)" }}>Reason</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Doctor, Bank, Personal errand..."
                  value={shortLeaveForm.reason}
                  onChange={(e) => setShortLeaveForm({ ...shortLeaveForm, reason: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", marginTop: "4px", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
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

          <div className="table-container" style={{ background: "var(--ui-surface, #fff)", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", width: "100%", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ui-border, #e2e8f0)", fontWeight: "700", color: "var(--text-main, #1e293b)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <span>My Short Leave History</span>
              <span className="mobile-scroll-hint" style={{ fontSize: "11px", color: "#06b6d4", fontWeight: "600", background: "rgba(6, 182, 212, 0.12)", padding: "3px 8px", borderRadius: "6px" }}>
                ⇄ Swipe table for full info
              </span>
            </div>
            <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "650px", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--ui-bg, #f8fafc)", borderBottom: "1px solid var(--ui-border, #e2e8f0)", color: "var(--text-muted, #475569)", fontSize: "13px" }}>
                  <th style={{ padding: "12px 16px" }}>Date</th>
                  <th style={{ padding: "12px 16px" }}>Time Window</th>
                  <th style={{ padding: "12px 16px" }}>Duration</th>
                  <th style={{ padding: "12px 16px" }}>Reason</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myShortLeaves.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>No short leaves taken.</td></tr>
                ) : (
                  myShortLeaves.map(sl => (
                    <tr key={sl.id} style={{ borderBottom: "1px solid var(--ui-border, #f1f5f9)", fontSize: "13px" }}>
                      <td style={{ padding: "12px 16px", fontWeight: "600", color: "var(--text-main, #1e293b)" }}>{new Date(sl.date).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-main, #334155)" }}>{sl.from_time} - {sl.to_time}</td>
                      <td style={{ padding: "12px 16px", fontWeight: "600", color: "var(--text-main, #1e293b)" }}>{sl.hours} hrs</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted, #94a3b8)" }}>{sl.reason}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
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
        </div>
      )}

      {/* TAB 3: ADMIN APPROVALS */}
      {activeTab === "approvals" && canApprove && (
        <div className="table-container" style={{ background: "var(--ui-surface, #fff)", borderRadius: "12px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ui-border, #e2e8f0)", fontWeight: "700", color: "var(--text-main, #1e293b)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <span>All Employee Leave Requests (Approvals & Decision)</span>
            <span className="mobile-scroll-hint" style={{ fontSize: "11px", color: "#16a34a", fontWeight: "600", background: "rgba(16, 185, 129, 0.15)", padding: "3px 8px", borderRadius: "6px" }}>
              ⇄ Swipe table horizontally to view actions
            </span>
          </div>
          <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--ui-bg, #f8fafc)", borderBottom: "1px solid var(--ui-border, #e2e8f0)", color: "var(--text-muted, #475569)", fontSize: "13px" }}>
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
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--ui-border, #f1f5f9)", fontSize: "14px" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "var(--text-main, #1e293b)" }}>{l.user_name}</strong>
                      <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted, #64748b)" }}>{l.user_email}</span>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "600", color: "var(--text-main, #1e293b)" }}>{l.leave_type}</td>
                    <td style={{ padding: "14px 16px", color: "var(--text-main, #334155)" }}>
                      {new Date(l.from_date).toLocaleDateString()} to {new Date(l.to_date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "700", color: "var(--text-main, #1e293b)" }}>{l.total_days}</td>
                    <td style={{ padding: "14px 16px", color: "var(--text-muted, #475569)" }}>{l.reason}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "14px", fontSize: "12px", fontWeight: "700",
                        background: l.status === "Approved" ? "rgba(16, 185, 129, 0.2)" : l.status === "Pending" ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: l.status === "Approved" ? "#10b981" : l.status === "Pending" ? "#f59e0b" : "#ef4444"
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
                        <span style={{ color: "var(--text-muted, #64748b)", fontSize: "12px" }}>Decided by {l.approved_by || "Admin"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMPANY-WIDE GLOBAL LEAVE POLICY (OPTION 1) */}
      {activeTab === "manage-balances" && canManagePolicy && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* 1. Global Policy Configuration Card */}
          <div style={{ background: "var(--ui-surface, #ffffff)", borderRadius: "14px", border: "1px solid var(--ui-border, #e2e8f0)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main, #1e293b)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldIcon size={20} color="var(--primary-color, #4f46e5)" /> Company-Wide Leave Policy
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted, #64748b)" }}>
                  Define global annual leave quotas for all company employees from a single place.
                </p>
              </div>
              <span style={{ fontSize: "12px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "4px 10px", borderRadius: "12px", fontWeight: "700" }}>
                Active Company Policy
              </span>
            </div>

            <form onSubmit={handleSavePolicy}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
                {/* CL */}
                <div style={{ background: "var(--ui-bg, #f8fafc)", padding: "16px", borderRadius: "10px", border: "1px solid var(--ui-border, #e2e8f0)" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#6366f1", display: "block", marginBottom: "6px" }}>
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
                      style={{ width: "90px", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", fontSize: "15px", fontWeight: "700", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", fontWeight: "600" }}>Days / Year</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>Annual unplanned / personal leaves</div>
                </div>

                {/* SL */}
                <div style={{ background: "var(--ui-bg, #f8fafc)", padding: "16px", borderRadius: "10px", border: "1px solid var(--ui-border, #e2e8f0)" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#10b981", display: "block", marginBottom: "6px" }}>
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
                      style={{ width: "90px", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", fontSize: "15px", fontWeight: "700", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", fontWeight: "600" }}>Days / Year</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>Medical & health recovery leaves</div>
                </div>

                {/* PL */}
                <div style={{ background: "var(--ui-bg, #f8fafc)", padding: "16px", borderRadius: "10px", border: "1px solid #f97316", borderLeftWidth: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#f97316", display: "block", marginBottom: "6px" }}>
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
                      style={{ width: "90px", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", fontSize: "15px", fontWeight: "700", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", fontWeight: "600" }}>Days / Year</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>Planned vacations & earned leaves</div>
                </div>

                {/* Comp-Off */}
                <div style={{ background: "var(--ui-bg, #f8fafc)", padding: "16px", borderRadius: "10px", border: "1px solid var(--ui-border, #e2e8f0)" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#0ea5e9", display: "block", marginBottom: "6px" }}>
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
                      style={{ width: "90px", padding: "8px 12px", border: "1px solid var(--ui-border, #cbd5e1)", borderRadius: "6px", fontSize: "15px", fontWeight: "700", background: "var(--ui-surface, #fff)", color: "var(--text-main, #1e293b)" }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", fontWeight: "600" }}>Days Base</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>Granted for extra weekend shifts</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--ui-border, #f1f5f9)", paddingTop: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-main, #475569)", cursor: "pointer" }}>
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
          <div className="table-container" style={{ background: "var(--ui-surface, #ffffff)", borderRadius: "14px", border: "1px solid var(--ui-border, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ui-border, #e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <strong style={{ fontSize: "16px", color: "var(--text-main, #1e293b)" }}>Current Staff Leave Overview</strong>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                  Employee leave balances allocated via company policy. Deducted automatically upon approved leaves.
                </p>
              </div>
              <span className="mobile-scroll-hint" style={{ fontSize: "11px", color: "var(--primary-color, #4f46e5)", fontWeight: "600", background: "rgba(79, 70, 229, 0.12)", padding: "3px 8px", borderRadius: "6px" }}>
                ⇄ Swipe table to view all quotas
              </span>
            </div>

            <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "650px", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--ui-bg, #f8fafc)", borderBottom: "1px solid var(--ui-border, #e2e8f0)", color: "var(--text-muted, #475569)", fontSize: "13px" }}>
                  <th style={{ padding: "14px 16px" }}>Employee</th>
                  <th style={{ padding: "14px 16px" }}>Casual (CL)</th>
                  <th style={{ padding: "14px 16px" }}>Sick (SL)</th>
                  <th style={{ padding: "14px 16px" }}>Privilege (PL)</th>
                  <th style={{ padding: "14px 16px" }}>Comp-Off</th>
                  <th style={{ padding: "14px 16px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Deduplicate staff records by email/user_id so each employee displays exactly once
                  const uniqueBalances = Array.from(
                    new Map(allBalances.map(b => [b.user_email || b.user_id || b.id, b])).values()
                  );
                  if (uniqueBalances.length === 0) {
                    return <tr><td colSpan="6" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>No staff records.</td></tr>;
                  }
                  return uniqueBalances.map(b => (
                    <tr key={b.id || b.user_id} style={{ borderBottom: "1px solid var(--ui-border, #f1f5f9)", fontSize: "14px" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <strong style={{ color: "var(--text-main, #1e293b)" }}>{b.user_name}</strong>
                        <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted, #64748b)" }}>{b.user_email || "Company Staff"}</span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "700", color: "#6366f1", background: "rgba(99, 102, 241, 0.15)", padding: "3px 10px", borderRadius: "8px" }}>
                          {b.cl_balance} Days
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "700", color: "#10b981", background: "rgba(16, 185, 129, 0.15)", padding: "3px 10px", borderRadius: "8px" }}>
                          {b.sl_balance} Days
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "700", color: "#f97316", background: "rgba(249, 115, 22, 0.15)", padding: "3px 10px", borderRadius: "8px" }}>
                          {b.pl_balance} Days
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "700", color: "#0ea5e9", background: "rgba(14, 165, 233, 0.15)", padding: "3px 10px", borderRadius: "8px" }}>
                          {b.comp_off} Days
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
