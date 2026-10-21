import React, { useState, useEffect } from "react";
import API from "../api/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { useProject } from "../contexts/ProjectContext";
import { ClipboardIcon, BugIcon, CheckIcon, CloseIcon } from "../components/common/Icons";
import "../style/main.css";
import "../style/table.css";

export default function QAManagement() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { selectedProject } = useProject();

  const [activeTab, setActiveTab] = useState("testcases"); // "testcases" | "bugs"
  const [testCases, setTestCases] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [showTcModal, setShowTcModal] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const [tcForm, setTcForm] = useState({
    project_id: "",
    project_name: "",
    module_name: "",
    title: "",
    preconditions: "",
    steps: "",
    expected_result: "",
    severity: "Medium"
  });

  const [bugForm, setBugForm] = useState({
    project_id: "",
    project_name: "",
    test_case_id: "",
    title: "",
    description: "",
    steps_to_reproduce: "",
    severity: "Major",
    assigned_to: "",
    environment: "Staging"
  });

  const fetchInitialData = async () => {
    try {
      const [projRes, staffRes] = await Promise.all([
        API.get("/projects"),
        API.get("/staff")
      ]);
      setProjects(projRes.data || []);
      setStaffList(staffRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTestCases = async () => {
    setLoading(true);
    try {
      const url = selectedProject ? `/qa/test-cases?projectId=${selectedProject._id}` : "/qa/test-cases";
      const res = await API.get(url);
      setTestCases(res.data || []);
    } catch (err) {
      showToast("Error loading test cases", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const url = selectedProject ? `/qa/bugs?projectId=${selectedProject._id}` : "/qa/bugs";
      const res = await API.get(url);
      setBugs(res.data || []);
    } catch (err) {
      showToast("Error loading QA bugs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === "testcases") {
      fetchTestCases();
    } else {
      fetchBugs();
    }
  }, [activeTab, selectedProject]);

  // Execute Test Case (Pass / Fail)
  const handleExecuteTestCase = async (id, status) => {
    try {
      await API.put(`/qa/test-cases/${id}`, { status });
      showToast(`Test Case marked as ${status}`);
      fetchTestCases();
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  // Submit Test Case
  const handleSaveTestCase = async (e) => {
    e.preventDefault();
    try {
      const proj = projects.find(p => p._id === tcForm.project_id) || selectedProject;
      const payload = {
        ...tcForm,
        project_id: proj?._id || "",
        project_name: proj?.name || "General Project"
      };

      if (editItem) {
        await API.put(`/qa/test-cases/${editItem.id}`, payload);
        showToast("Test Case updated!");
      } else {
        await API.post("/qa/test-cases", payload);
        showToast("Test Case created successfully!");
      }
      setShowTcModal(false);
      setEditItem(null);
      fetchTestCases();
    } catch (err) {
      showToast("Failed to save test case", "error");
    }
  };

  // Submit Bug
  const handleSaveBug = async (e) => {
    e.preventDefault();
    try {
      const proj = projects.find(p => p._id === bugForm.project_id) || selectedProject;
      const payload = {
        ...bugForm,
        project_id: proj?._id || "",
        project_name: proj?.name || "General Project"
      };

      if (editItem) {
        await API.put(`/qa/bugs/${editItem.id}`, payload);
        showToast("Bug updated!");
      } else {
        await API.post("/qa/bugs", payload);
        showToast("Bug logged successfully!");
      }
      setShowBugModal(false);
      setEditItem(null);
      fetchBugs();
    } catch (err) {
      showToast("Failed to save bug", "error");
    }
  };

  // Delete Handlers
  const handleDeleteTestCase = async (id) => {
    if (!window.confirm("Delete this test case?")) return;
    try {
      await API.delete(`/qa/test-cases/${id}`);
      showToast("Test Case deleted");
      fetchTestCases();
    } catch (err) {
      showToast("Delete failed", "error");
    }
  };

  const handleDeleteBug = async (id) => {
    if (!window.confirm("Delete this bug report?")) return;
    try {
      await API.delete(`/qa/bugs/${id}`);
      showToast("Bug deleted");
      fetchBugs();
    } catch (err) {
      showToast("Delete failed", "error");
    }
  };

  return (
    <div className="task-page" style={{ padding: "24px" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
            Quality Assurance (QA) & Testing
          </h1>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>
            Design test suites, execute test runs, and track defects across software releases.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {activeTab === "testcases" ? (
            <button
              onClick={() => {
                setEditItem(null);
                setTcForm({
                  project_id: selectedProject?._id || projects[0]?._id || "",
                  project_name: selectedProject?.name || projects[0]?.name || "",
                  module_name: "Authentication",
                  title: "",
                  preconditions: "",
                  steps: "",
                  expected_result: "",
                  severity: "Medium"
                });
                setShowTcModal(true);
              }}
              style={{ background: "#4f46e5", color: "#fff", padding: "10px 18px", borderRadius: "8px", border: "none", fontWeight: "600", cursor: "pointer" }}
            >
              + Create Test Case
            </button>
          ) : (
            <button
              onClick={() => {
                setEditItem(null);
                setBugForm({
                  project_id: selectedProject?._id || projects[0]?._id || "",
                  project_name: selectedProject?.name || projects[0]?.name || "",
                  test_case_id: "",
                  title: "",
                  description: "",
                  steps_to_reproduce: "",
                  severity: "Major",
                  assigned_to: staffList[0]?.name || "Unassigned",
                  environment: "Staging"
                });
                setShowBugModal(true);
              }}
              style={{ background: "#dc2626", color: "#fff", padding: "10px 18px", borderRadius: "8px", border: "none", fontWeight: "600", cursor: "pointer" }}
            >
              + Log New Bug
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid #e2e8f0", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("testcases")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "testcases" ? "3px solid #4f46e5" : "none",
            fontWeight: activeTab === "testcases" ? "700" : "500",
            color: activeTab === "testcases" ? "#4f46e5" : "#64748b",
            cursor: "pointer",
            fontSize: "15px"
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ClipboardIcon size={16} /> Test Cases ({testCases.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab("bugs")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "bugs" ? "3px solid #dc2626" : "none",
            fontWeight: activeTab === "bugs" ? "700" : "500",
            color: activeTab === "bugs" ? "#dc2626" : "#64748b",
            cursor: "pointer",
            fontSize: "15px"
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <BugIcon size={16} /> QA Defect Board ({bugs.length})
          </span>
        </button>
      </div>

      {/* CONTENT: TEST CASES TABLE */}
      {activeTab === "testcases" && (
        <div className="table-container" style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontWeight: "700", color: "#1e293b", fontSize: "14px" }}>Test Cases Repository</span>
            <span className="mobile-scroll-hint" style={{ fontSize: "11px", color: "#4f46e5", fontWeight: "600", background: "#eef2ff", padding: "3px 8px", borderRadius: "6px" }}>
              ⇄ Swipe table horizontally
            </span>
          </div>
          <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "13px" }}>
                <th style={{ padding: "14px 16px" }}>Test Case</th>
                <th style={{ padding: "14px 16px" }}>Module / Project</th>
                <th style={{ padding: "14px 16px" }}>Severity</th>
                <th style={{ padding: "14px 16px" }}>Status</th>
                <th style={{ padding: "14px 16px" }}>Execute Run</th>
                <th style={{ padding: "14px 16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ padding: "30px", textAlign: "center" }}>Loading test cases...</td></tr>
              ) : testCases.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No test cases created yet. Click "+ Create Test Case" above.</td></tr>
              ) : (
                testCases.map((tc) => (
                  <tr key={tc.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "14px" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "#1e293b" }}>{tc.title}</strong>
                      <span style={{ display: "block", fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Expected: {tc.expected_result || "N/A"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontWeight: "600", color: "#475569" }}>{tc.module_name || "General"}</span>
                      <span style={{ display: "block", fontSize: "12px", color: "#94a3b8" }}>{tc.project_name}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700",
                        background: tc.severity === "Critical" ? "#fee2e2" : tc.severity === "High" ? "#ffedd5" : "#f1f5f9",
                        color: tc.severity === "Critical" ? "#dc2626" : tc.severity === "High" ? "#c2410c" : "#475569"
                      }}>
                        {tc.severity}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700",
                        background: tc.status === "Passed" ? "#dcfce7" : tc.status === "Failed" ? "#fee2e2" : "#f1f5f9",
                        color: tc.status === "Passed" ? "#16a34a" : tc.status === "Failed" ? "#dc2626" : "#64748b"
                      }}>
                        {tc.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button
                        onClick={() => handleExecuteTestCase(tc.id, "Passed")}
                        style={{
                          padding: "4px 10px", background: "#dcfce7", color: "#15803d", border: "none",
                          borderRadius: "6px", cursor: "pointer", fontWeight: "700", marginRight: "6px",
                          display: "inline-flex", alignItems: "center", gap: "4px"
                        }}
                      >
                        <CheckIcon size={12} color="#15803d" /> Pass
                      </button>
                      <button
                        onClick={() => handleExecuteTestCase(tc.id, "Failed")}
                        style={{
                          padding: "4px 10px", background: "#fee2e2", color: "#b91c1c", border: "none",
                          borderRadius: "6px", cursor: "pointer", fontWeight: "700",
                          display: "inline-flex", alignItems: "center", gap: "4px"
                        }}
                      >
                        <CloseIcon size={12} color="#b91c1c" /> Fail
                      </button>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button
                        onClick={() => handleDeleteTestCase(tc.id)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: "600" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* CONTENT: QA BUGS TABLE */}
      {activeTab === "bugs" && (
        <div className="table-container" style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontWeight: "700", color: "#1e293b", fontSize: "14px" }}>Defect Tracking Board</span>
            <span className="mobile-scroll-hint" style={{ fontSize: "11px", color: "#dc2626", fontWeight: "600", background: "#fef2f2", padding: "3px 8px", borderRadius: "6px" }}>
              ⇄ Swipe table horizontally
            </span>
          </div>
          <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "13px" }}>
                <th style={{ padding: "14px 16px" }}>Bug Details</th>
                <th style={{ padding: "14px 16px" }}>Severity</th>
                <th style={{ padding: "14px 16px" }}>Environment</th>
                <th style={{ padding: "14px 16px" }}>Assigned Developer</th>
                <th style={{ padding: "14px 16px" }}>Bug Status</th>
                <th style={{ padding: "14px 16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ padding: "30px", textAlign: "center" }}>Loading bugs...</td></tr>
              ) : bugs.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No defects logged. Clean build!</td></tr>
              ) : (
                bugs.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "14px" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "#dc2626" }}>{b.title}</strong>
                      <span style={{ display: "block", fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Project: {b.project_name} • Reported by: {b.reported_by}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700",
                        background: b.severity === "Critical" ? "#dc2626" : "#f97316",
                        color: "#fff"
                      }}>
                        {b.severity}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#475569" }}>
                      {b.environment || "Staging"}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "600", color: "#1e293b" }}>
                      {b.assigned_to || "Unassigned"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <select
                        value={b.status}
                        onChange={async (e) => {
                          await API.put(`/qa/bugs/${b.id}`, { status: e.target.value });
                          fetchBugs();
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13px",
                          fontWeight: "600"
                        }}
                      >
                        <option value="Open">Open</option>
                        <option value="In Fixing">In Fixing</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Retest">Retest</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button
                        onClick={() => handleDeleteBug(b.id)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: "600" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TEST CASE */}
      {showTcModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "12px", width: "520px", maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: "700" }}>Create QA Test Case</h3>
            <form onSubmit={handleSaveTestCase} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Project</label>
                <select
                  value={tcForm.project_id}
                  onChange={(e) => setTcForm({ ...tcForm, project_id: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                >
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Test Case Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verify password reset email validation"
                  value={tcForm.title}
                  onChange={(e) => setTcForm({ ...tcForm, title: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Module Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Auth / Dashboard / Tasks"
                    value={tcForm.module_name}
                    onChange={(e) => setTcForm({ ...tcForm, module_name: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Severity</label>
                  <select
                    value={tcForm.severity}
                    onChange={(e) => setTcForm({ ...tcForm, severity: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Steps to Reproduce</label>
                <textarea
                  rows="3"
                  placeholder="1. Enter email&#10;2. Click submit button..."
                  value={tcForm.steps}
                  onChange={(e) => setTcForm({ ...tcForm, steps: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Expected Result</label>
                <input
                  type="text"
                  placeholder="e.g. Email should be received with reset token"
                  value={tcForm.expected_result}
                  onChange={(e) => setTcForm({ ...tcForm, expected_result: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowTcModal(false)} style={{ padding: "8px 16px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "8px 18px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Save Test Case</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG BUG */}
      {showBugModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "12px", width: "520px", maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: "700", color: "#dc2626" }}>Log QA Bug / Defect</h3>
            <form onSubmit={handleSaveBug} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Project</label>
                <select
                  value={bugForm.project_id}
                  onChange={(e) => setBugForm({ ...bugForm, project_id: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                >
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Bug Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500 Internal Error when submitting timesheet"
                  value={bugForm.title}
                  onChange={(e) => setBugForm({ ...bugForm, title: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Severity</label>
                  <select
                    value={bugForm.severity}
                    onChange={(e) => setBugForm({ ...bugForm, severity: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                  >
                    <option value="Critical">Critical (Blocker)</option>
                    <option value="Major">Major</option>
                    <option value="Medium">Medium</option>
                    <option value="Minor">Minor / Cosmetic</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Assign Developer</label>
                  <select
                    value={bugForm.assigned_to}
                    onChange={(e) => setBugForm({ ...bugForm, assigned_to: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                  >
                    <option value="Unassigned">-- Choose Developer --</option>
                    {staffList.map(s => <option key={s._id} value={s.name}>{s.name} ({s.position || "Dev"})</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Bug Description & Steps</label>
                <textarea
                  rows="3"
                  placeholder="Details of the bug and steps taken before failure..."
                  value={bugForm.description}
                  onChange={(e) => setBugForm({ ...bugForm, description: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowBugModal(false)} style={{ padding: "8px 16px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "8px 18px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Log Bug</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
