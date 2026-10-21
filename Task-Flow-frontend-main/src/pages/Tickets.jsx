import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useSocket } from "../contexts/SocketContext";
import API from "../api/api";
import { TicketIcon, PlusIcon, ClockIcon, GearIcon, CheckCircleIcon, CloseIcon } from "../components/common/Icons";
import "../style/main.css";
import "../style/table.css";

export default function Tickets() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();

  const isSuperAdmin =
    user?.email === "gadanipranav@gmail.com" ||
    user?.role?.name === "Super Admin" ||
    user?.role === "Super Admin" ||
    user?.role?.name === "Company Owner" ||
    user?.role?.name?.toLowerCase().includes("admin");

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });

  // Filtering
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    category: "Hardware",
    item_type: "Mouse",
    title: "",
    description: "",
    priority: "Medium",
  });

  // Admin Resolve Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [targetStatus, setTargetStatus] = useState("In Progress");
  const [resolving, setResolving] = useState(false);

  // Load Tickets & Stats
  const loadTicketData = useCallback(async () => {
    try {
      setLoading(true);
      const [ticketsRes, statsRes] = await Promise.all([
        API.get("/tickets"),
        API.get("/tickets/stats"),
      ]);
      setTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : []);
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error("Error loading tickets:", err);
      showToast(err.response?.data?.error || "Error loading tickets", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTicketData();
  }, [loadTicketData]);

  // Live Socket listeners
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => loadTicketData();
    socket.on("ticketCreated", handleUpdate);
    socket.on("ticketUpdated", handleUpdate);
    return () => {
      socket.off("ticketCreated", handleUpdate);
      socket.off("ticketUpdated", handleUpdate);
    };
  }, [socket, loadTicketData]);

  // Create Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      showToast("Please provide both title and description.", "warning");
      return;
    }
    try {
      setSubmitting(true);
      await API.post("/tickets", formData);
      showToast("Ticket submitted successfully! Admin will review shortly.", "success");
      setShowCreateModal(false);
      setFormData({
        category: "Hardware",
        item_type: "Mouse",
        title: "",
        description: "",
        priority: "Medium",
      });
      loadTicketData();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to submit ticket", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Status update modal
  const openActionModal = (ticket, status) => {
    setSelectedTicket(ticket);
    setTargetStatus(status);
    setAdminRemarks(ticket.admin_remarks || (status === "Resolved" ? "Replacement item provided." : ""));
  };

  // Submit Status update
  const handleUpdateStatus = async () => {
    if (!selectedTicket) return;
    try {
      setResolving(true);
      await API.put(`/tickets/${selectedTicket.id}/status`, {
        status: targetStatus,
        admin_remarks: adminRemarks,
      });
      showToast(`Ticket status changed to ${targetStatus}!`, "success");
      setSelectedTicket(null);
      loadTicketData();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to update ticket", "error");
    } finally {
      setResolving(false);
    }
  };

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    const matchStatus = statusFilter === "All" || t.status === statusFilter;
    const matchSearch =
      !searchQuery.trim() ||
      (t.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.ticket_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.user_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.item_type || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div style={{ padding: "10px 0 40px 0", maxWidth: "1400px", margin: "0 auto" }}>
      {/* 🎫 HERO HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          borderRadius: "24px",
          padding: "32px",
          marginBottom: "30px",
          color: "#fff",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          boxShadow: "0 20px 40px -15px rgba(15, 23, 42, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "900",
                letterSpacing: "1.5px",
                padding: "4px 10px",
                borderRadius: "20px",
                background: "rgba(99, 102, 241, 0.25)",
                color: "#a5b4fc",
                border: "1px solid rgba(99, 102, 241, 0.4)",
              }}
            >
              PADYA SOFT HELPDESK
            </span>
          </div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "900", letterSpacing: "-0.5px" }}>
            Hardware & Workplace Support Tickets
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
            Raise requests for broken mice, keyboards, workstation issues, or equipment replacements.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "#fff",
            border: "none",
            padding: "13px 24px",
            borderRadius: "14px",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <PlusIcon size={16} color="#fff" /> Raise New Ticket
        </button>
      </div>

      {/* 📊 SUMMARY COUNTERS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
          marginBottom: "28px",
        }}
      >
        <StatWidget label="Total Tickets" val={stats.total} color="#6366f1" icon={<TicketIcon size={20} color="#6366f1" />} />
        <StatWidget label="Open / Pending" val={stats.open} color="#f59e0b" icon={<ClockIcon size={20} color="#f59e0b" />} />
        <StatWidget label="In Progress" val={stats.inProgress} color="#3b82f6" icon={<GearIcon size={20} color="#3b82f6" />} />
        <StatWidget label="Resolved" val={stats.resolved} color="#10b981" icon={<CheckCircleIcon size={20} color="#10b981" />} />
      </div>

      {/* 🔍 FILTER & SEARCH BAR */}
      <div
        style={{
          background: "var(--ui-surface, #ffffff)",
          borderRadius: "16px",
          padding: "16px 20px",
          border: "1px solid var(--ui-border, #e2e8f0)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted, #64748b)" }}>
            Status:
          </span>
          {["All", "Open", "In Progress", "Resolved"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                background: statusFilter === s ? "#6366f1" : "var(--ui-bg, #f8fafc)",
                color: statusFilter === s ? "#ffffff" : "var(--text-main, #334155)",
                border: "1px solid var(--ui-border, #e2e8f0)",
                padding: "7px 16px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search ticket #, title, or item..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "1px solid var(--ui-border, #e2e8f0)",
            background: "var(--ui-bg, #f8fafc)",
            color: "var(--text-main, #1e293b)",
            fontSize: "13px",
            minWidth: "260px",
            outline: "none",
          }}
        />
      </div>

      {/* 📋 TICKETS TABLE */}
      <div
        style={{
          background: "var(--ui-surface, #ffffff)",
          borderRadius: "20px",
          border: "1px solid var(--ui-border, #e2e8f0)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted, #64748b)" }}>
            Loading tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted, #64748b)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px", color: "#94a3b8" }}>
              <TicketIcon size={42} color="#94a3b8" />
            </div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main, #1e293b)" }}>
              No tickets found
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px" }}>
              {statusFilter !== "All"
                ? `No tickets currently match the "${statusFilter}" status filter.`
                : "No support tickets have been created yet."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--ui-bg, #f8fafc)", borderBottom: "1px solid var(--ui-border, #e2e8f0)" }}>
                  <th style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-muted, #64748b)" }}>TICKET #</th>
                  <th style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-muted, #64748b)" }}>RAISED BY</th>
                  <th style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-muted, #64748b)" }}>CATEGORY & ITEM</th>
                  <th style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-muted, #64748b)" }}>ISSUE DETAILS</th>
                  <th style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-muted, #64748b)" }}>PRIORITY</th>
                  <th style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-muted, #64748b)" }}>STATUS</th>
                  <th style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-muted, #64748b)" }}>RESOLUTION / REMARKS</th>
                  {isSuperAdmin && <th style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-muted, #64748b)" }}>ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => {
                  const statusColors = {
                    Open: { bg: "rgba(245, 158, 11, 0.12)", text: "#d97706" },
                    "In Progress": { bg: "rgba(59, 130, 246, 0.12)", text: "#2563eb" },
                    Resolved: { bg: "rgba(16, 185, 129, 0.12)", text: "#059669" },
                    Closed: { bg: "rgba(100, 116, 139, 0.12)", text: "#475569" },
                  }[t.status] || { bg: "#f1f5f9", text: "#475569" };

                  const prioColor =
                    t.priority === "Urgent" || t.priority === "High"
                      ? "#ef4444"
                      : t.priority === "Low"
                      ? "#10b981"
                      : "#f59e0b";

                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: "1px solid var(--ui-border, #e2e8f0)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "16px 20px", fontWeight: "800", color: "#6366f1" }}>
                        {t.ticket_number}
                        <div style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", fontWeight: "500", marginTop: "2px" }}>
                          {new Date(t.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ fontWeight: "700", color: "var(--text-main, #1e293b)" }}>{t.user_name}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>{t.user_email}</div>
                      </td>

                      <td style={{ padding: "16px 20px" }}>
                        <span
                          style={{
                            background: "var(--ui-bg, #f1f5f9)",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontWeight: "700",
                            fontSize: "11px",
                            color: "var(--text-main, #334155)",
                            border: "1px solid var(--ui-border, #e2e8f0)",
                          }}
                        >
                          {t.category}
                        </span>
                        <div style={{ fontWeight: "700", color: "var(--text-main, #1e293b)", marginTop: "4px" }}>
                          {t.item_type || "General"}
                        </div>
                      </td>

                      <td style={{ padding: "16px 20px", maxWidth: "300px" }}>
                        <div style={{ fontWeight: "800", color: "var(--text-main, #1e293b)", marginBottom: "4px" }}>
                          {t.title}
                        </div>
                        <div
                          style={{
                            color: "var(--text-muted, #64748b)",
                            fontSize: "12px",
                            lineHeight: "1.4",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {t.description}
                        </div>
                      </td>

                      <td style={{ padding: "16px 20px" }}>
                        <span
                          style={{
                            color: prioColor,
                            fontWeight: "800",
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          ● {t.priority}
                        </span>
                      </td>

                      <td style={{ padding: "16px 20px" }}>
                        <span
                          style={{
                            background: statusColors.bg,
                            color: statusColors.text,
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontWeight: "800",
                            fontSize: "11px",
                          }}
                        >
                          {t.status}
                        </span>
                      </td>

                      <td style={{ padding: "16px 20px", maxWidth: "250px" }}>
                        {t.admin_remarks ? (
                          <div
                            style={{
                              background: "rgba(16, 185, 129, 0.08)",
                              padding: "8px 12px",
                              borderRadius: "10px",
                              border: "1px solid rgba(16, 185, 129, 0.2)",
                              fontSize: "12px",
                              color: "#065f46",
                              fontWeight: "600",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px"
                            }}
                          >
                            <span style={{ fontWeight: "700" }}>Note:</span> {t.admin_remarks}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "12px", fontStyle: "italic" }}>
                            Awaiting admin resolution
                          </span>
                        )}
                      </td>

                      {isSuperAdmin && (
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {t.status === "Open" && (
                              <button
                                onClick={() => openActionModal(t, "In Progress")}
                                style={{
                                  background: "#3b82f6",
                                  color: "#fff",
                                  border: "none",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                }}
                              >
                                Accept & Process
                              </button>
                            )}

                            {t.status !== "Resolved" && (
                              <button
                                onClick={() => openActionModal(t, "Resolved")}
                                style={{
                                  background: "#10b981",
                                  color: "#fff",
                                  border: "none",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                }}
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📝 RAISE TICKET MODAL */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--ui-surface, #ffffff)",
              borderRadius: "24px",
              maxWidth: "520px",
              width: "100%",
              padding: "32px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--ui-border, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "800", color: "var(--text-main, #1e293b)" }}>
                  Raise Support Ticket
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                  Report hardware breakdown or replacement need
                </span>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "var(--text-muted, #64748b)",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-main, #1e293b)", display: "block", marginBottom: "6px" }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid var(--ui-border, #cbd5e1)",
                      background: "var(--ui-bg, #f8fafc)",
                      color: "var(--text-main, #1e293b)",
                      fontWeight: "600",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                      cursor: "pointer"
                    }}
                  >
                    <option value="Hardware">Hardware Equipment</option>
                    <option value="Software">Software & Licenses</option>
                    <option value="Network/Internet">Network & Connectivity</option>
                    <option value="Workstation">Workstation & Furniture</option>
                    <option value="Other">Other Issues</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-main, #1e293b)", display: "block", marginBottom: "6px" }}>
                    Item Type
                  </label>
                  <select
                    value={formData.item_type}
                    onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid var(--ui-border, #cbd5e1)",
                      background: "var(--ui-bg, #f8fafc)",
                      color: "var(--text-main, #1e293b)",
                      fontWeight: "600",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                      cursor: "pointer"
                    }}
                  >
                    <option value="Mouse">Mouse</option>
                    <option value="Keyboard">Keyboard</option>
                    <option value="Monitor">Monitor / Screen</option>
                    <option value="Headset">Headset / Headphones</option>
                    <option value="Charger / Cable">Charger / Cable / Adapter</option>
                    <option value="Laptop / PC">Laptop / PC / CPU</option>
                    <option value="Workstation / Desk">Desk / Office Chair</option>
                    <option value="Other">Other Accessory</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-main, #1e293b)", display: "block", marginBottom: "6px" }}>
                  Issue Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mouse left click not clicking / broken"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--ui-border, #cbd5e1)",
                    background: "var(--ui-bg, #f8fafc)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-main, #1e293b)", display: "block", marginBottom: "6px" }}>
                  Detailed Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Please describe what happened (e.g. mouse cable frayed, scroll wheel stuck, need replacement mouse to work)."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--ui-border, #cbd5e1)",
                    background: "var(--ui-bg, #f8fafc)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-main, #1e293b)", display: "block", marginBottom: "6px" }}>
                  Urgency / Priority
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  {["Low", "Medium", "High", "Urgent"].map((p) => (
                    <label
                      key={p}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={p}
                        checked={formData.priority === p}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    background: "var(--ui-bg, #f1f5f9)",
                    border: "1px solid var(--ui-border, #cbd5e1)",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "10px",
                    background: "#6366f1",
                    color: "#fff",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🛠️ ADMIN RESOLVE / REMARKS MODAL */}
      {selectedTicket && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--ui-surface, #ffffff)",
              borderRadius: "24px",
              maxWidth: "480px",
              width: "100%",
              padding: "28px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--ui-border, #e2e8f0)",
            }}
          >
            <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: "800", color: "var(--text-main, #1e293b)" }}>
              Update Ticket: {selectedTicket.ticket_number}
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--text-muted, #64748b)" }}>
              Update state and record what action or replacement was provided for {selectedTicket.user_name}.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "6px" }}>
                Target Status
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--ui-border, #cbd5e1)",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "6px" }}>
                Resolution Remarks / Action Taken
              </label>
              <textarea
                rows={3}
                placeholder="e.g. New wireless mouse issued from inventory by Admin."
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--ui-border, #cbd5e1)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "10px",
                  background: "var(--ui-bg, #f1f5f9)",
                  border: "1px solid var(--ui-border, #cbd5e1)",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={resolving}
                style={{
                  padding: "9px 20px",
                  borderRadius: "10px",
                  background: targetStatus === "Resolved" ? "#10b981" : "#3b82f6",
                  color: "#fff",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                {resolving ? "Updating..." : "Save Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatWidget({ label, val, color, icon }) {
  return (
    <div
      style={{
        background: "var(--ui-surface, #ffffff)",
        borderRadius: "18px",
        padding: "20px",
        border: "1px solid var(--ui-border, #e2e8f0)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        boxShadow: "0 6px 18px -4px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--text-main, #1e293b)", marginTop: "2px" }}>
          {val ?? 0}
        </div>
      </div>
    </div>
  );
}
