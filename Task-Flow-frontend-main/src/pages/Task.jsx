import React, { useEffect, useRef, useState } from "react";
import "../style/main.css";
import DataTable from "../components/common/DataTable";
import FormModal from "../components/common/FormModal";
import PageHeader from "../components/common/PageHeader";
import ConfirmModal from "../components/common/ConfirmModal";
import API from "../api/api";
import { useProject } from "../contexts/ProjectContext";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionContext";
import { useCompany } from "../contexts/CompanyContext";
import { FolderIcon, UploadIcon, DownloadIcon, CloudIcon, CheckCircleIcon, CheckIcon, ClipboardIcon, CloseIcon } from "../components/common/Icons";



export default function Task({ isIssue = false }) {
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [viewTask, setViewTask] = useState(null);
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { hasPermission: ctxHasPermission } = usePermissions();

  const isSuperAdmin = user?.email === "gadanipranav@gmail.com" || user?.role?.name === "Super Admin";
  const isCompanyOwner = user?.role?.name === "Company Owner";

  const hasPermission = (module, action = "read") => {
    if (isSuperAdmin || isCompanyOwner) return true;
    // Map generic modules to specific ones if needed
    const actualModule = (isIssue && module === "task_management") ? "issue" : module;
    return ctxHasPermission(actualModule, action);
  };

  // ───── Bulk Upload State ─────
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const bulkInputRef = useRef(null);

  const [mentionQuery, setMentionQuery] = useState(null);
  const [cursorPos, setCursorPos] = useState(0);

  // Get selected project from Header context
  const { selectedProject } = useProject();
  const { selectedCompany } = useCompany();

  // ⚡ Real-time socket
  const { socket } = useSocket();
  const selectedProjectRef = useRef(selectedProject);

  // Keep ref in sync so socket handlers can read latest value
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  const [viewMode, setViewMode] = useState("list"); // Add 'viewMode' state (list or kanban)

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    status: "",
    project: "",
    priority: "Medium",
    image: null,
    video: null,
    oldImage: "",
    oldVideo: "",
    startDate: "",
    endDate: "",
    estimatedHours: 0,
    calculatedEndDate: "",
    subtasks: [],
  });

  const [quickSubtaskModal, setQuickSubtaskModal] = useState({
    show: false,
    taskId: null,
    taskTitle: "",
    title: "",
    startDate: "",
    endDate: "",
    status: "Pending"
  });

  const [memberSearch, setMemberSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Toast notification
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Keep ref in sync so socket handlers can read latest value
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  // Server-side pagination state
  const [serverPage, setServerPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const serverPageSize = 50; // Items per page

  // ================= LOAD =================
  const load = async () => {
    try {
      // 1. Fetch Tasks (Primary)
      try {
        const t = await (selectedProject
          ? API.get(`/tasks?project=${selectedProject._id}&type=${isIssue ? "issue" : "task"}&page=${serverPage}&limit=${serverPageSize}`)
          : API.get(`/tasks?type=${isIssue ? "issue" : "task"}&page=${serverPage}&limit=${serverPageSize}`));
        
        let rawTasks = [];
        if (t.data && t.data.tasks) {
          rawTasks = t.data.tasks;
          setTotalRecords(t.data.totalCount || 0);
        } else {
          rawTasks = Array.isArray(t.data) ? t.data : [];
          setTotalRecords(rawTasks.length);
        }
        const filteredTasks = isIssue
          ? rawTasks.filter(task => task.type === "issue")
          : rawTasks.filter(task => task.type === "task" || !task.type);
        setTasks(filteredTasks);
      } catch (err) { console.error("Error loading tasks:", err); }

      // 2. Fetch Statuses
      try {
        const st = await (selectedProject ? API.get(`/task-status?project=${selectedProject._id}`) : API.get("/task-status"));
        setStatuses(st.data || []);
      } catch (err) { console.error("Error loading statuses:", err); }

      // 3. Fetch Projects
      try {
        const p = await API.get("/projects");
        setProjects(p.data || []);
      } catch (err) { console.error("Error loading projects:", err); }

      // 4. Fetch Staff (The critical part)
      try {
        const s = await API.get("/staff");
        const staffData = s.data.staff || s.data || [];
        console.log("DEBUG: Staff data list is ->", staffData);
        setStaff(staffData);
      } catch (err) { console.error("Error loading staff:", err); }

    } catch (e) {
      console.error("General load error:", e);
    }
  };

  useEffect(() => {
    load();
  }, [selectedProject, isIssue, serverPage, selectedCompany]);

  // Reset to page 1 when project, issue type, or company changes
  useEffect(() => {
    setServerPage(1);
  }, [selectedProject, isIssue, selectedCompany]);

  // ================= CALCULATION LOGIC =================
  useEffect(() => {
    if (form.startDate && form.estimatedHours > 0) {
      const company = selectedCompany || {};
      const holidays = company.holidays || [];
      const workStartTime = company.workingHours?.start || "09:00";
      const workEndTime = company.workingHours?.end || "18:00";
      const breakStartTime = company.breakTime?.start || "13:00";
      const breakEndTime = company.breakTime?.end || "14:00";

      const parseTime = (t) => {
        const [h, m] = t.split(":").map(Number);
        return h + (m || 0) / 60;
      };

      const dailyWorkNet = parseTime(workEndTime) - parseTime(workStartTime) - 
                         (parseTime(breakEndTime) - parseTime(breakStartTime));
      
      let current = new Date(form.startDate);
      let remaining = form.estimatedHours;
      
      const isHoliday = (date) => {
        if (date.getDay() === 0) return true; // Sunday
        return holidays.some(h => new Date(h.date).toDateString() === date.toDateString());
      };

      // Loop to reach end date skipping holidays
      while (remaining > 0) {
        if (isHoliday(current)) {
          current.setDate(current.getDate() + 1);
          current.setHours(parseInt(workStartTime.split(":")[0]), parseInt(workStartTime.split(":")[1]), 0, 0);
          continue;
        }

        // Calculate hours left today
        const [weH, weM] = workEndTime.split(":").map(Number);
        const dayEnd = new Date(current);
        dayEnd.setHours(weH, weM, 0, 0);

        let availableToday = Math.max((dayEnd - current) / (1000 * 60 * 60), 0);
        
        // Adjust for break if needed
        const [bsH, bsM] = breakStartTime.split(":").map(Number);
        const [beH, beM] = breakEndTime.split(":").map(Number);
        const bStart = new Date(current); bStart.setHours(bsH, bsM, 0, 0);
        const bEnd = new Date(current); bEnd.setHours(beH, beM, 0, 0);

        if (current < bStart && dayEnd > bEnd) availableToday -= (parseTime(breakEndTime) - parseTime(breakStartTime));

        if (remaining <= availableToday) {
            current.setMinutes(current.getMinutes() + remaining * 60);
            // If it lands in break, push to end of break
            if (current > bStart && current < bEnd) {
                const diff = (current - bStart) / (1000 * 60);
                current = new Date(bEnd);
                current.setMinutes(current.getMinutes() + diff);
            }
            remaining = 0;
        } else {
            remaining -= availableToday;
            current.setDate(current.getDate() + 1);
            current.setHours(parseInt(workStartTime.split(":")[0]), parseInt(workStartTime.split(":")[1]), 0, 0);
        }
      }

      // Format to YYYY-MM-DDTHH:mm for datetime-local
      const pad = (n) => n.toString().padStart(2, '0');
      const endStr = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}T${pad(current.getHours())}:${pad(current.getMinutes())}`;
      
      if (form.calculatedEndDate !== endStr) {
        setForm(prev => ({ ...prev, calculatedEndDate: endStr }));
      }
    }
  }, [form.startDate, form.estimatedHours, selectedCompany]);


  // ================= SOCKET REAL-TIME =================
  useEffect(() => {
    if (!socket) return;

    // Helper: does this task belong to the current view?
    const isVisible = (task) => {
      // Only show items matching this view's type (task vs issue)
      const taskType = task.type || "task";
      if (taskType !== (isIssue ? "issue" : "task")) return false;

      const proj = selectedProjectRef.current;
      if (!proj) return true; // "All" view
      const taskProjectId = task.project?._id || task.project;
      return taskProjectId === proj._id;
    };

    const onCreated = (task) => {
      if (!isVisible(task)) return;
      setTasks((prev) => {
        // avoid duplicates
        if (prev.find((t) => t._id === task._id)) return prev;
        return [task, ...prev];
      });
    };

    const onUpdated = (task) => {
      if (isVisible(task)) {
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? task : t))
        );
      } else {
        // task moved out of the current project filter — remove it
        setTasks((prev) => prev.filter((t) => t._id !== task._id));
      }
    };

    const onDeleted = ({ _id }) => {
      setTasks((prev) => prev.filter((t) => t._id !== _id));
    };

    socket.on("task:created", onCreated);
    socket.on("task:updated", onUpdated);
    socket.on("task:deleted", onDeleted);

    return () => {
      socket.off("task:created", onCreated);
      socket.off("task:updated", onUpdated);
      socket.off("task:deleted", onDeleted);
    };
  }, [socket]);

  // ================= SAVE =================
  const save = async () => {
    if (loading) return; // Add guards
    // Validation
    if (!form.title.trim()) {
      showToast("Title is required", "error");
      return;
    }
    if (form.title.length > 100) {
      showToast("Title must be 100 characters or less", "error");
      return;
    }
    // Prevent common injection-style characters if strictly requested, 
    // though Mongoose handles this. Let's at least enforce a clean title.
    const titleRegex = /^[a-zA-Z0-9\s\-_.,()]+$/;
    if (!titleRegex.test(form.title)) {
      showToast("Title contains invalid characters", "error");
      return;
    }

    if (!form.description || !form.description.trim()) {
      showToast("Description is required", "error");
      return;
    }
    if (!form.assignedTo || (Array.isArray(form.assignedTo) && form.assignedTo.length === 0)) {
      showToast("Please assign at least one staff member", "error");
      return;
    }
    if (!form.status) {
      showToast("Please select a status", "error");
      return;
    }
    if (!form.project) {
      showToast("Please select a project", "error");
      return;
    }
    if (isIssue && !form.priority) {
      showToast("Please select a priority", "error");
      return;
    }
    if (!editId && !form.image && !form.video) {
      showToast("Please upload at least one image or video", "error");
      return;
    }

    // File Type Validation
    if (form.image && !form.image.type.startsWith("image/")) {
      showToast("Invalid image file format", "error");
      return;
    }
    if (form.video && !form.video.type.startsWith("video/")) {
      showToast("Invalid video file format", "error");
      return;
    }

    const fd = new FormData();

    fd.append("title", form.title);
    fd.append("description", form.description);
    
    if (Array.isArray(form.assignedTo)) {
      form.assignedTo.forEach(id => fd.append("assignedTo", id));
    } else if (form.assignedTo) {
      fd.append("assignedTo", form.assignedTo);
    }

    fd.append("status", form.status);
    fd.append("project", form.project || "");
    fd.append("type", isIssue ? "issue" : "task");
    if (isIssue) fd.append("priority", form.priority);

    if (form.image) {
      fd.append("image", form.image);
    } else if (editId && form.oldImage === "") {
      fd.append("image", "");
    }

    if (form.video) {
      fd.append("video", form.video);
    } else if (editId && form.oldVideo === "") {
      fd.append("video", "");
    }

    if (form.startDate) fd.append("startDate", form.startDate);
    if (form.endDate) fd.append("endDate", form.endDate);
    fd.append("estimatedHours", form.estimatedHours || 0);
    if (form.calculatedEndDate) fd.append("calculatedEndDate", form.calculatedEndDate);
    if (form.subtasks && form.subtasks.length > 0) fd.append("subtasks", JSON.stringify(form.subtasks));

    setLoading(true);
    try {
      if (editId) {
        await API.put(`/tasks/${editId}`, fd);
        showToast(`${isIssue ? "Issue" : "Task"} updated successfully!`);
      } else {
        await API.post("/tasks", fd);
        showToast(`${isIssue ? "Issue" : "Task"} added successfully!`);
      }

      setShowForm(false);
      setEditId(null);
      setForm({
        title: "",
        description: "",
        assignedTo: "",
        status: "",
        project: "",
        priority: "Medium",
        image: null,
        video: null,
        oldVideo: "",
        startDate: "",
        endDate: "",
        estimatedHours: 0,
        calculatedEndDate: "",
        subtasks: []
      });
      load();
    } catch (error) {
      console.error("Save error:", error);
      showToast("Error saving task", "error");
    } finally {
      setLoading(false);
    }
  };

  // ================= EDIT =================
  const edit = (item) => {
    const projectVal = item.project?._id || item.project || (selectedProject ? selectedProject._id : (projects[0]?._id || ""));
    setForm({
      title: item.title,
      description: item.description,
      assignedTo: Array.isArray(item.assignedTo) ? item.assignedTo.map(u => u._id || u) : (item.assignedTo ? [item.assignedTo?._id || item.assignedTo] : []),
      status: item.status?._id || item.status,
      project: projectVal,
      priority: item.priority || "Medium",
      oldImage: item.image,
      oldVideo: item.video,
      startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : "",
      endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : (item.calculatedEndDate ? new Date(item.calculatedEndDate).toISOString().split('T')[0] : ""),
      estimatedHours: item.estimatedHours || 0,
      calculatedEndDate: item.calculatedEndDate ? new Date(item.calculatedEndDate).toISOString().split('T')[0] : "",
      subtasks: Array.isArray(item.subtasks) ? item.subtasks : []
    });
    setEditId(item._id);
    setShowForm(true);
  };

  // Subtask Builder Helpers
  const handleAddSubtaskToForm = () => {
    setForm(prev => ({
      ...prev,
      subtasks: [
        ...(prev.subtasks || []),
        { title: "", startDate: form.startDate || "", endDate: form.endDate || "", status: "Pending" }
      ]
    }));
  };

  const handleSubtaskFieldChange = (idx, field, value) => {
    setForm(prev => {
      const updated = [...(prev.subtasks || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, subtasks: updated };
    });
  };

  const handleRemoveSubtaskFromForm = (idx) => {
    setForm(prev => {
      const updated = [...(prev.subtasks || [])];
      updated.splice(idx, 1);
      return { ...prev, subtasks: updated };
    });
  };

  // Inline Subtask Update from Table
  const handleUpdateSubtaskStatus = async (taskId, subtaskId, status) => {
    try {
      await API.patch(`/tasks/${taskId}/subtasks/${subtaskId}`, { status });
      showToast("Subtask status updated!", "success");
      load();
    } catch (e) {
      showToast("Failed to update subtask", "error");
    }
  };

  // Quick Add Subtask from Table
  const handleQuickAddSubtask = async (e) => {
    if (e) e.preventDefault();
    if (!quickSubtaskModal.title.trim()) {
      showToast("Please enter subtask title", "error");
      return;
    }
    try {
      await API.post(`/tasks/${quickSubtaskModal.taskId}/subtasks`, {
        title: quickSubtaskModal.title.trim(),
        startDate: quickSubtaskModal.startDate || null,
        endDate: quickSubtaskModal.endDate || null,
        status: quickSubtaskModal.status || "Pending"
      });
      showToast("Subtask added successfully!", "success");
      setQuickSubtaskModal({ show: false, taskId: null, taskTitle: "", title: "", startDate: "", endDate: "", status: "Pending" });
      load();
    } catch (e) {
      showToast(e.response?.data?.error || "Failed to add subtask", "error");
    }
  };

  // ================= DELETE =================
  const remove = async (id) => {
    try {
      await API.delete(`/tasks/${id}`);
      showToast("Task deleted successfully!", "delete");
      load();
    } catch (error) {
      console.error("Delete error:", error);
      showToast("Error deleting task", "error");
    }
  };

  // ================= UPDATE INLINE =================
  const updateTaskField = async (taskId, field, value) => {
    const task = tasks.find(t => t._id === taskId);
    if (!task) return;

    const fd = new FormData();
    fd.append("title", task.title || "");
    fd.append("description", task.description || "");
    fd.append("assignedTo", field === "assignedTo" ? value : (task.assignedTo?._id || task.assignedTo || ""));
    fd.append("status", field === "status" ? value : (task.status?._id || task.status || ""));
    fd.append("project", task.project?._id || task.project || "");
    if (isIssue) fd.append("priority", field === "priority" ? value : (task.priority || "Medium"));

    try {
      await API.put(`/tasks/${taskId}`, fd);
      const fieldNames = { assignedTo: "Assignee", status: "Status", priority: "Priority" };
      const displayName = fieldNames[field] || field;
      showToast(`${displayName} updated successfully!`, "success");
      load();
    } catch (error) {
      console.error("Update inline error:", error);
      showToast("Error updating task", "error");
    }
  };

  // ================= HELPER: filter valid staff (Staff + Manager roles) =================
  const getValidStaff = () => {
    return Array.isArray(staff) ? staff : (staff.staff || []);
  };

  // ================= PRIORITY COLOR =================
  const priorityStyle = (p) => {
    const map = {
      Critical: { bg: "rgba(185, 28, 28, 0.15)", color: "#ef4444", border: "1.5px solid rgba(239, 68, 68, 0.3)" },
      High: { bg: "rgba(249, 115, 22, 0.15)", color: "#f97316", border: "1.5px solid rgba(249, 115, 22, 0.3)" },
      Medium: { bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "1.5px solid rgba(59, 130, 246, 0.3)" },
      Low: { bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e", border: "1.5px solid rgba(34, 197, 94, 0.3)" },
    };
    return map[p] || map["Medium"];
  };

  // ================= TABLE =================
  const columns = [
    {
      header: isIssue ? "Issue" : "Task",
      key: "title",
      render: (v, row) => (
        <div style={{ minWidth: "220px", maxWidth: "280px" }}>
          <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "14px", lineHeight: "1.4" }}>{v}</div>
          {row.project?.name && (
            <div style={{ fontSize: "11px", color: "#6366f1", fontWeight: "600", marginTop: "4px", display: "inline-flex", alignItems: "center", background: "#f5f3ff", padding: "2px 8px", borderRadius: "10px", border: "1px solid #ede9fe" }}>
              <FolderIcon size={12} color="#6366f1" style={{ marginRight: "4px" }} />
              {row.project.name}
            </div>
          )}
        </div>
      )
    },
    ...(!isIssue ? [
      {
        header: "Start Date",
        key: "startDate",
        render: (v) => v ? (
          <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569", whiteSpace: "nowrap" }}>
            {new Date(v).toLocaleDateString('en-GB')}
          </span>
        ) : "—"
      },
      {
        header: "End Date",
        key: "endDate",
        render: (v, row) => {
          const d = v || row.calculatedEndDate || row.dueDate;
          return d ? (
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569", whiteSpace: "nowrap" }}>
              {new Date(d).toLocaleDateString('en-GB')}
            </span>
          ) : "—";
        }
      },
      {
        header: "Subtasks",
        key: "subtasks",
        render: (v, row) => {
          const list = Array.isArray(v) ? v : [];
          return (
            <div style={{ minWidth: "250px", maxWidth: "290px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {list.length > 0 ? (
                list.map((st, idx) => (
                  <div
                    key={st._id || idx}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px"
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#334155", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={st.title}>
                      ↳ {st.title}
                    </div>
                    <select
                      value={st.status || "Pending"}
                      onChange={(e) => handleUpdateSubtaskStatus(row._id, st._id, e.target.value)}
                      style={{
                        fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "12px",
                        border: "1px solid #cbd5e1",
                        background: st.status === "Complete" ? "#dcfce7" : st.status === "In Process" ? "#dbeafe" : "#fef3c7",
                        color: st.status === "Complete" ? "#15803d" : st.status === "In Process" ? "#1d4ed8" : "#b45309",
                        cursor: "pointer",
                        outline: "none"
                      }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Process">In Process</option>
                      <option value="Complete">Complete</option>
                    </select>
                  </div>
                ))
              ) : (
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
              )}
              {hasPermission("task_management", "create") && (
                <button
                  type="button"
                  onClick={() => setQuickSubtaskModal({
                    show: true,
                    taskId: row._id,
                    taskTitle: row.title,
                    title: "",
                    startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : "",
                    endDate: (row.endDate || row.calculatedEndDate) ? new Date(row.endDate || row.calculatedEndDate).toISOString().slice(0, 10) : "",
                    status: "Pending"
                  })}
                  style={{
                    background: "#eef2ff", color: "#4f46e5", border: "1px dashed #a5b4fc",
                    borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: "700",
                    cursor: "pointer", width: "fit-content", marginTop: "2px",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#e0e7ff"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#eef2ff"}
                >
                  + Add Subtask
                </button>
              )}
            </div>
          );
        }
      }
    ] : []),
    {
      header: "Description",
      key: "description",
      render: (v) => (
        <div style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px", color: "#64748b" }} title={v}>
          {v || "—"}
        </div>
      )
    },
    {
      header: "Assigned To",
      key: "assignedTo",
      render: (v) => {
        const assignedList = Array.isArray(v) ? v : (v ? [v] : []);
        if (assignedList.length === 0) return <span style={{ color: "#94a3b8", fontSize: "12px" }}>Unassigned</span>;
        return (
          <div style={{ display: "flex", alignItems: "center", minWidth: "90px" }}>
            {assignedList.map((user, idx) => {
              const u = typeof user === 'object' ? user : staff.find(s => s._id === user);
              if (!u) return null;
              return (
                <div key={idx} title={u.name} style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "#4f46e5", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: "800", border: '2px solid #fff',
                  marginLeft: idx > 0 ? "-8px" : "0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)"
                }}>
                  {u.name?.charAt(0).toUpperCase()}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      header: "Status",
      key: "status",
      render: (v, row) => {
        const statusName = v?.name || (typeof v === "string" ? v : "Pending");
        const statusId = v?._id || v || "";
        const isComplete = /complete/i.test(statusName);
        const isInProgress = /progress/i.test(statusName) || /process/i.test(statusName);

        const bg = isComplete ? "#dcfce7" : isInProgress ? "#eff6ff" : "#fffbeb";
        const color = isComplete ? "#15803d" : isInProgress ? "#1d4ed8" : "#b45309";
        const border = isComplete ? "#86efac" : isInProgress ? "#93c5fd" : "#fde68a";

        const canUpdate = hasPermission("task_management", "update");

        return (
          <select
            value={statusId}
            onChange={(e) => updateTaskField(row._id, "status", e.target.value)}
            disabled={!canUpdate}
            style={{
              padding: "5px 10px",
              borderRadius: "20px",
              fontWeight: "700",
              fontSize: "12px",
              background: bg,
              color: color,
              border: `1.5px solid ${border}`,
              cursor: canUpdate ? "pointer" : "default",
              outline: "none",
              minWidth: "120px",
              textAlign: "center"
            }}
          >
            {statuses.length > 0 ? (
              statuses.map((s) => (
                <option key={s._id} value={s._id} style={{ background: "#fff", color: "#1e293b" }}>
                  {s.name}
                </option>
              ))
            ) : (
              <>
                <option value={statusId} style={{ background: "#fff", color: "#1e293b" }}>{statusName}</option>
                <option value="Complete" style={{ background: "#fff", color: "#1e293b" }}>Complete</option>
                <option value="In Progress" style={{ background: "#fff", color: "#1e293b" }}>In Progress</option>
                <option value="Pending" style={{ background: "#fff", color: "#1e293b" }}>Pending</option>
              </>
            )}
          </select>
        );
      },
    },
    // Priority column — only in Issue mode
    ...(isIssue ? [{
      header: "Priority",
      key: "priority",
      render: (v, row) => (
        <select
          className="form-control"
          value={v || "Medium"}
          onChange={(e) => updateTaskField(row._id, "priority", e.target.value)}
          disabled={!hasPermission("task_management", "update")}
          style={{
            background: "var(--neu-bg)",
            color: priorityStyle(v || "Medium").color,
            fontWeight: "800",
            border: priorityStyle(v || "Medium").border,
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            fontSize: "13px",
            boxShadow: "var(--neu-shadow-inner)",
            width: "100%",
            minWidth: "120px",
            cursor: "pointer"
          }}
        >
          {["Low", "Medium", "High", "Critical"].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      ),
    }] : []),
  ];

  const handleDescriptionChange = (e) => {
    const val = e.target.value;
    setForm({ ...form, description: val });
    const cursor = e.target.selectionStart;

    const textBeforeCursor = val.slice(0, cursor);
    const words = textBeforeCursor.split(/\s/);
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith("@")) {
      setMentionQuery(currentWord.slice(1).toLowerCase());
      setCursorPos(cursor);
    } else {
      setMentionQuery(null);
    }
  };

  const handleMentionSelect = (memberName) => {
    const val = form.description || "";
    const textBeforeCursor = val.slice(0, cursorPos);
    const textAfterCursor = val.slice(cursorPos);

    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const newText = val.slice(0, lastAtIndex) + "@" + memberName + " " + textAfterCursor;
      setForm({ ...form, description: newText });
    }
    setMentionQuery(null);
  };

  // ───── Bulk Upload Handler ─────
  const handleBulkUpload = async () => {
    if (!bulkFile) { showToast("Please select a CSV file first", "error"); return; }
    if (!selectedProject) { showToast("Please select a project first", "error"); return; }
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const fd = new FormData();
      fd.append("file", bulkFile);
      // Use API instance (sends httpOnly cookie automatically via withCredentials)
      // timeout: 10 min for large datasets (1 lakh+ rows)
      const res = await API.post(
        `/tasks/bulk-upload?type=${isIssue ? "issue" : "task"}&project=${selectedProject._id}`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 30 * 60 * 1000 } // 30 min for 10 lakh+ rows
      );
      setBulkResult(res.data);
      setBulkFile(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || "Bulk upload failed", "error");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDrop = (e) => {
    e.preventDefault();
    setBulkDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setBulkFile(file);
  };

  const downloadSampleCSV = () => {
    const baseURL = window.location.hostname === "localhost"
      ? "http://localhost:5000/api"
      : "https://mzdhklfk-5000.inc1.devtunnels.ms/api";
    const url = `${baseURL}/tasks/bulk-upload/sample?type=${isIssue ? "issue" : "task"}`;
    // Use fetch with credentials:include so the httpOnly auth cookie is sent
    fetch(url, { credentials: "include" })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = burl;
        a.download = isIssue ? "issues_sample.csv" : "tasks_sample.csv";
        a.click();
        URL.revokeObjectURL(burl);
      })
      .catch(() => showToast("Failed to download sample", "error"));
  };

  return (
    <div className="page">

      {/* ===== PAGE HEADER WITH BULK UPLOAD BUTTON ===== */}
      <div className="header">
        <h2>
          {isIssue
            ? (selectedProject ? `${selectedProject.name} — Issues` : "All Issues")
            : (selectedProject ? `${selectedProject.name} — Tasks` : "All Tasks")}
        </h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          
          {/* View Mode Toggle */}
          <div style={{ display: "flex", background: "var(--table-bg)", borderRadius: "10px", padding: "4px", border: "1px solid var(--ui-border)" }}>
            <button
              title="List View"
              onClick={() => setViewMode("list")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "8px 10px", border: "none", borderRadius: "8px", cursor: "pointer", transition: "0.2s",
                background: viewMode === "list" ? "#fff" : "transparent",
                color: viewMode === "list" ? "var(--primary-color)" : "var(--text-muted)",
                boxShadow: viewMode === "list" ? "var(--shadow-sm)" : "none"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
            <button
              title="Kanban View"
              onClick={() => setViewMode("kanban")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "8px 10px", border: "none", borderRadius: "8px", cursor: "pointer", transition: "0.2s",
                background: viewMode === "kanban" ? "#fff" : "transparent",
                color: viewMode === "kanban" ? "var(--primary-color)" : "var(--text-muted)",
                boxShadow: viewMode === "kanban" ? "var(--shadow-sm)" : "none"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
            </button>
          </div>

          {hasPermission("task_management", "create") && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (!selectedProject) {
                  showToast("Please select a project first", "error");
                  return;
                }
                setBulkFile(null);
                setBulkResult(null);
                setShowBulkModal(true);
              }}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                fontWeight: "700", fontSize: "13px", padding: "9px 16px",
                borderRadius: "10px", border: "2px dashed var(--primary-color)",
                background: "transparent", color: "var(--primary-color)",
                cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--primary-color)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--primary-color)"; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Bulk Upload
            </button>
          )}

          {hasPermission("task_management", "create") && (
            <button
              className="btn btn-primary"
              onClick={() => {
                const defaultProj = selectedProject?._id || (projects[0]?._id || projects[0]?.id || "");
                setForm({
                  title: "",
                  description: "",
                  assignedTo: [],
                  status: statuses[0]?._id || "",
                  project: defaultProj,
                  priority: "Medium",
                  image: null,
                  video: null,
                  oldImage: "",
                  oldVideo: "",
                });
                setEditId(null);
                setShowForm(true);
              }}
            >
              {isIssue ? "+ Add Issue" : "+ Add Task"}
            </button>
          )}
        </div>
      </div>

      {/* ===== BULK UPLOAD MODAL ===== */}
      {showBulkModal && (
        <div
          onClick={() => setShowBulkModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--card-bg, #fff)", borderRadius: "18px",
              padding: "36px 40px", maxWidth: "520px", width: "94%",
              boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <UploadIcon size={20} color="var(--primary-color)" /> Bulk Upload {isIssue ? "Issues" : "Tasks"}
                </h2>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* Sample download */}
            <div style={{
              background: "linear-gradient(135deg,#eff6ff,#dbeafe)", borderRadius: "10px",
              padding: "14px 18px", marginBottom: "20px", border: "1px solid #93c5fd",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontWeight: "700", fontSize: "13px", color: "#1e40af" }}>Required CSV Columns</div>
                <code style={{ fontSize: "12px", color: "#1e3a8a" }}>
                  {isIssue ? "title, description, assignedTo, status, priority" : "title, description, assignedTo, status"}
                </code>
              </div>
              <button
                onClick={downloadSampleCSV}
                style={{
                  background: "#3b82f6", color: "#fff", border: "none",
                  borderRadius: "8px", padding: "8px 14px", cursor: "pointer",
                  fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap",
                  display: "inline-flex", alignItems: "center", gap: "6px"
                }}
              >
                <DownloadIcon size={14} color="#fff" /> Sample CSV
              </button>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setBulkDragOver(true); }}
              onDragLeave={() => setBulkDragOver(false)}
              onDrop={handleBulkDrop}
              onClick={() => bulkInputRef.current?.click()}
              style={{
                border: `2.5px dashed ${bulkDragOver ? "#3b82f6" : bulkFile ? "#10b981" : "#cbd5e1"}`,
                borderRadius: "14px", padding: "40px 20px", textAlign: "center",
                cursor: "pointer", transition: "all 0.2s", marginBottom: "20px",
                background: bulkDragOver ? "#eff6ff" : bulkFile ? "#f0fdf4" : "var(--table-bg,#f8fafc)",
              }}
            >
              <input
                ref={bulkInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: "none" }}
                onChange={e => setBulkFile(e.target.files[0] || null)}
              />
              {bulkFile ? (
                <>
                  <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}>
                    <CheckCircleIcon size={36} color="#10b981" />
                  </div>
                  <div style={{ fontWeight: "700", fontSize: "15px", color: "#059669" }}>{bulkFile.name}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                    {(bulkFile.size / 1024 / 1024).toFixed(2)} MB — click to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}>
                    <CloudIcon size={36} color="#6366f1" />
                  </div>
                  <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-main)" }}>Drag &amp; Drop your CSV here</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>or click to browse — .csv, .xlsx, .xls</div>
                </>
              )}
            </div>

            {/* Result box */}
            {bulkResult && (
              <div style={{
                background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", borderRadius: "12px",
                padding: "16px 20px", marginBottom: "16px", border: "1px solid #86efac",
              }}>
                <div style={{ fontWeight: "800", fontSize: "14px", color: "#15803d", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircleIcon size={16} color="#15803d" /> Upload Complete!
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
                  {[{ label: "Total", value: bulkResult.total, color: "#1e293b" },
                  { label: "Inserted", value: bulkResult.inserted, color: "#059669" },
                  { label: "Skipped", value: bulkResult.skipped, color: "#dc2626" }].map(s => (
                    <div key={s.label} style={{
                      background: "#fff", borderRadius: "10px", padding: "12px 8px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                    }}>
                      <div style={{ fontSize: "22px", fontWeight: "900", color: s.color }}>{s.value?.toLocaleString()}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowBulkModal(false)}
                style={{
                  padding: "10px 24px", background: "var(--table-bg,#f3f4f6)",
                  color: "var(--text-main)", border: "none", borderRadius: "10px",
                  cursor: "pointer", fontSize: "14px", fontWeight: "700",
                }}
              >
                Close
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={bulkLoading || !bulkFile}
                style={{
                  padding: "10px 28px",
                  background: bulkLoading || !bulkFile ? "#cbd5e1" : "linear-gradient(135deg,#6366f1,#3b82f6)",
                  color: "#fff", border: "none", borderRadius: "10px",
                  cursor: bulkLoading || !bulkFile ? "not-allowed" : "pointer",
                  fontSize: "14px", fontWeight: "800",
                  boxShadow: bulkLoading || !bulkFile ? "none" : "0 4px 14px rgba(99,102,241,0.4)",
                  display: "flex", alignItems: "center", gap: "8px",
                  transition: "all 0.2s",
                }}
              >
                {bulkLoading ? (
                  <>
                    <span style={{
                      width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff", borderRadius: "50%",
                      display: "inline-block", animation: "spin 0.8s linear infinite"
                    }} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadIcon size={15} color="#fff" /> Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FORM ================= */}
      <FormModal
        show={showForm}
        onClose={() => setShowForm(false)}
        title={editId ? (isIssue ? "Edit Issue" : "Edit Task") : (isIssue ? "Add Issue" : "Add Task")}
        onSave={save}
        loading={loading}
        maxWidth="850px"
      >
        <div style={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'visible', padding: '10px 10px 40px 10px' }}>
          <div style={{ marginBottom: "20px" }}>

          <label style={{ fontWeight: "700", display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-main)" }}>Title <span style={{ color: "red" }}>*</span></label>
          <input
            className="form-control"
            placeholder="Enter title"
            maxLength={100}
            value={form.title || ""}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={{ color: "var(--text-main)" }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontWeight: "700", display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-main)" }}>Description <span style={{ color: "red" }}>*</span></label>
          <div style={{ position: "relative" }}>
            <textarea
              className="form-control"
              placeholder="Describe the task. Tip: Use @ followed by a name to mention team members."
              value={form.description || ""}
              onChange={handleDescriptionChange}
              rows={4}
            />
            {mentionQuery !== null && (
              <div style={{
                position: "absolute",
                top: "100%", left: 0,
                background: "#ffffff",
                border: "1px solid var(--ui-border)",
                boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                borderRadius: "12px",
                zIndex: 10000,
                width: "250px",
                maxHeight: "150px",
                overflowY: "auto",
                marginTop: "4px"
              }}>
                {getValidStaff()
                  .filter(s => s.name.toLowerCase().includes(mentionQuery))
                  .map(s => (
                    <div
                      key={s._id}
                      onClick={() => handleMentionSelect(s.name)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: "13px",
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.target.style.background = "#f1f5f9"}
                      onMouseLeave={(e) => e.target.style.background = "#fff"}
                    >
                      <span style={{ fontWeight: "600", color: "#1e293b" }}>{s.name}</span>
                      <span style={{ color: "#94a3b8", marginLeft: "6px", fontSize: "11px" }}>
                        ({s.position || s.role?.name || "Staff"})
                      </span>
                    </div>
                  ))}
                {getValidStaff().filter(s => s.name.toLowerCase().includes(mentionQuery)).length === 0 && (
                  <div style={{ padding: "8px 12px", fontSize: "12px", color: "#94a3b8" }}>No members found</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: "700", display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-main)" }}>Assign Staff <span style={{ color: "red" }}>*</span></label>
          <div style={{ position: 'relative', zIndex: 1050 }} ref={dropdownRef}>
            <div
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                background: "#fdfefe",
                border: "1.5px solid #e5e7eb",
                borderRadius: "12px",
                padding: "8px 15px",
                minHeight: "48px",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                alignItems: "center",
                cursor: "pointer"
              }}
            >
              {Array.isArray(form.assignedTo) && form.assignedTo.length > 0 ? (
                form.assignedTo.map(staffId => {
                  const s = getValidStaff().find(u => u._id === staffId);
                  if (!s) return null;
                  return (
                    <div key={staffId} style={{ background: "var(--primary-light)", color: "var(--primary-color)", padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                      {s.name}
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm({ ...form, assignedTo: form.assignedTo.filter(id => id !== staffId) });
                        }}
                        style={{ cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}
                      >×</span>
                    </div>
                  );
                })
              ) : (
                <span style={{ color: "#9ca3af", fontSize: "14px" }}>Choose staff members...</span>
              )}
            </div>

            {isDropdownOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                marginTop: "8px", background: "#ffffff", borderRadius: "12px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)", border: "1px solid var(--ui-border)",
                maxHeight: "250px", overflowY: "auto", zIndex: 1100
              }}>
                <div style={{ padding: "10px", borderBottom: "1px solid #f3f4f6", position: 'sticky', top: 0, background: '#fff' }}>
                  <input
                    className="form-control"
                    placeholder="Search staff..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ height: '35px', fontSize: '13px' }}
                  />
                </div>
                {getValidStaff()
                  .filter(s => s.name?.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map((s) => {
                    const isSelected = Array.isArray(form.assignedTo) && form.assignedTo.includes(s._id);
                    return (
                      <div
                        key={s._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          let currentSelected = Array.isArray(form.assignedTo) ? form.assignedTo : (form.assignedTo ? [form.assignedTo] : []);
                          if (isSelected) {
                            currentSelected = currentSelected.filter(id => id !== s._id);
                          } else {
                            currentSelected = [...currentSelected, s._id];
                          }
                          setForm({ ...form, assignedTo: currentSelected });
                        }}
                        style={{
                          padding: "12px 15px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: isSelected ? "#f0f7ff" : "transparent",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? "#f0f7ff" : "transparent"}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--primary-color)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                            {s.name?.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>{s.name}</div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>{s.role?.name || "Staff Member"}</div>
                          </div>
                        </div>
                        {isSelected && <CheckIcon size={16} color="var(--primary-color)" />}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: "700", display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-main)" }}>
            Project <span style={{ color: "red" }}>*</span>
          </label>
          <select
            className="form-control"
            value={form.project || ""}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
            style={{ color: "var(--text-main)" }}
          >
            <option value="">Select Project...</option>
            {projects.map((p) => (
              <option key={p._id || p.id} value={p._id || p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Task Status <span style={{ color: "red" }}>*</span></label>
          <select className="form-control" value={form.status || ""} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="">Choose status...</option>
            {statuses.map((s) => ( <option key={s._id} value={s._id}>{s.name}</option> ))}
          </select>
        </div>

        <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div className="form-group">
                <label style={{ fontWeight: "700", fontSize: "13px" }}>Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.startDate ? form.startDate.slice(0, 10) : ""}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
            </div>
            <div className="form-group">
                <label style={{ fontWeight: "700", fontSize: "13px" }}>End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.endDate ? form.endDate.slice(0, 10) : (form.calculatedEndDate ? form.calculatedEndDate.slice(0, 10) : "")}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value, calculatedEndDate: e.target.value })}
                />
            </div>
            <div className="form-group">
                <label style={{ fontWeight: "700", fontSize: "13px" }}>Est. Hours</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 40"
                  value={form.estimatedHours || ""}
                  onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) })}
                />
            </div>
        </div>

        {/* ─── SUBTASKS BUILDER IN TASK FORM ─── */}
        <div style={{
          background: "#f8fafc", borderRadius: "12px", border: "1.5px solid #e2e8f0",
          padding: "16px", marginBottom: "20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <span style={{ fontWeight: "800", fontSize: "14px", color: "#1e293b", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <ClipboardIcon size={16} color="#4f46e5" /> Subtasks ({form.subtasks?.length || 0})
              </span>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>
                Break this task down into milestones or sub-items with start & end dates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddSubtaskToForm}
              style={{
                background: "#4f46e5", color: "#fff", border: "none",
                padding: "6px 12px", borderRadius: "6px", fontSize: "12px",
                fontWeight: "700", cursor: "pointer"
              }}
            >
              + Add Subtask
            </button>
          </div>

          {Array.isArray(form.subtasks) && form.subtasks.map((st, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                gap: "8px",
                alignItems: "center",
                marginBottom: "8px"
              }}
            >
              <input
                type="text"
                placeholder="Subtask title..."
                value={st.title || ""}
                onChange={(e) => handleSubtaskFieldChange(idx, "title", e.target.value)}
                className="form-control"
                style={{ fontSize: "13px" }}
                required
              />
              <input
                type="date"
                title="Start Date"
                value={st.startDate ? st.startDate.slice(0, 10) : ""}
                onChange={(e) => handleSubtaskFieldChange(idx, "startDate", e.target.value)}
                className="form-control"
                style={{ fontSize: "12px" }}
              />
              <input
                type="date"
                title="End Date"
                value={st.endDate ? st.endDate.slice(0, 10) : ""}
                onChange={(e) => handleSubtaskFieldChange(idx, "endDate", e.target.value)}
                className="form-control"
                style={{ fontSize: "12px" }}
              />
              <select
                value={st.status || "Pending"}
                onChange={(e) => handleSubtaskFieldChange(idx, "status", e.target.value)}
                className="form-control"
                style={{ fontSize: "12px", fontWeight: "700" }}
              >
                <option value="Pending">Pending</option>
                <option value="In Process">In Process</option>
                <option value="Complete">Complete</option>
              </select>
              <button
                type="button"
                onClick={() => handleRemoveSubtaskFromForm(idx)}
                style={{
                  background: "#fee2e2", color: "#ef4444", border: "none",
                  borderRadius: "6px", padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center"
                }}
                title="Remove subtask"
              >
                <CloseIcon size={13} color="#ef4444" />
              </button>
            </div>
          ))}

          {(!form.subtasks || form.subtasks.length === 0) && (
            <div style={{ textAlign: "center", padding: "12px", color: "#94a3b8", fontSize: "12px" }}>
              No subtasks added yet. Click "+ Add Subtask" to add milestones.
            </div>
          )}
        </div>

        {/* PRIORITY — only in Issue mode */}
        {isIssue && (
          <div className="form-group">
            <label>Priority <span style={{ color: "red" }}>*</span></label>
            <select
              className="form-control"
              value={form.priority || ""}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              style={{
                background: "#fdfefe",
                borderLeft: form.priority ? `4px solid ${priorityStyle(form.priority).color}` : "1.5px solid #e5e7eb",
                fontWeight: "700"
              }}
            >
              <option value="">Select Priority...</option>
              {["Low", "Medium", "High", "Critical"].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        {/* IMAGE */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontWeight: "bold", display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-main)" }}>
            Upload Photo (Max 50MB, Single File) {!editId && <span style={{ color: "red" }}>*</span>}
          </label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="file"
              accept="image/*"
              className="form-control"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file && file.size > 50 * 1024 * 1024) {
                  showToast("File size exceed 50MB limit", "error");
                  e.target.value = "";
                  return;
                }
                if (file && !file.type.startsWith("image/")) {
                  showToast("Only image files are allowed", "error");
                  e.target.value = "";
                  return;
                }
                setForm({ ...form, image: file });
              }}
            />
            {form.image && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => setForm({ ...form, image: null })}
                style={{ padding: "8px 12px", borderRadius: "6px", fontSize: "12px", border: "none", background: "var(--danger-color)", color: "#fff", cursor: "pointer" }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {form.oldImage && (
          <div style={{ position: "relative", display: "inline-block", marginBottom: "20px" }}>
            <img
              src={`http://localhost:5000/uploads/${form.oldImage}`}
              width="120"
              alt=""
              style={{ borderRadius: "8px", border: "1px solid var(--border-color)" }}
            />
            <button
              type="button"
              onClick={() => setForm({ ...form, oldImage: "" })}
              style={{
                position: "absolute",
                top: "-10px",
                right: "-10px",
                background: "var(--danger-color)",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}
              title="Remove existing image"
            >
              ×
            </button>
          </div>
        )}

        {/* VIDEO */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontWeight: "bold", display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-main)" }}>
            Upload Video (Max 50MB, Single File)
          </label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="file"
              accept="video/*"
              className="form-control"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file && file.size > 50 * 1024 * 1024) {
                  showToast("File size exceed 50MB limit", "error");
                  e.target.value = "";
                  return;
                }
                if (file && !file.type.startsWith("video/")) {
                  showToast("Only video files are allowed", "error");
                  e.target.value = "";
                  return;
                }
                setForm({ ...form, video: file });
              }}
            />
            {form.video && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => setForm({ ...form, video: null })}
                style={{ padding: "8px 12px", borderRadius: "6px", fontSize: "12px", border: "none", background: "var(--danger-color)", color: "#fff", cursor: "pointer" }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {form.oldVideo && (
          <div style={{ position: "relative", display: "inline-block", marginBottom: "20px" }}>
            <video
              src={`http://localhost:5000/uploads/${form.oldVideo}`}
              width="200"
              controls
              style={{ borderRadius: "8px", border: "1px solid var(--border-color)" }}
            />
            <button
              type="button"
              onClick={() => setForm({ ...form, oldVideo: "" })}
              style={{
                position: "absolute",
                top: "-10px",
                right: "-10px",
                background: "var(--danger-color)",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}
              title="Remove existing video"
            >
              ×
            </button>
          </div>
        )}
        </div>
      </FormModal>

      {/* ================= DATA VIEW (LIST / KANBAN) ================= */}
      {viewMode === "list" ? (
        <DataTable
          data={tasks}
          columns={columns}
          onView={(task) => setViewTask(task)}
          onEdit={hasPermission("task_management", "update") ? edit : null}
          onDelete={hasPermission("task_management", "delete") ? remove : null}
          serverSide={true}
          totalRecords={totalRecords}
          serverCurrentPage={serverPage}
          pageSize={serverPageSize}
          onPageChange={(p) => setServerPage(p)}
        />
      ) : (
        <div style={{ display: "flex", gap: "20px", overflowX: "auto", paddingBottom: "20px", marginTop: "20px" }}>
          {statuses.map(s => {
            const colTasks = tasks.filter(t => (t.status?._id || t.status) === s._id);
            return (
              <div
                key={s._id}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("taskId");
                  if (taskId) updateTaskField(taskId, "status", s._id);
                }}
                style={{
                  minWidth: "320px", width: "320px", background: "var(--ui-surface)", borderRadius: "12px", border: "1px solid var(--ui-border)", padding: "16px", display: "flex", flexDirection: "column", height: "fit-content", minHeight: "60vh"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                   <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--text-main)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.name}</h3>
                   <span style={{ background: "var(--ui-border)", color: "var(--text-main)", fontSize: "12px", fontWeight: "800", padding: "2px 8px", borderRadius: "12px" }}>{colTasks.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                  {colTasks.map(t => {
                    const assignedList = Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo ? [t.assignedTo] : []);
                    return (
                      <div
                        key={t._id}
                        draggable={hasPermission("task_management", "update")}
                        onDragStart={e => e.dataTransfer.setData("taskId", t._id)}
                        style={{
                          background: "var(--ui-bg)", padding: "16px", borderRadius: "10px", boxShadow: "var(--shadow-sm)", border: "1px solid var(--ui-border)", cursor: hasPermission("task_management", "update") ? "grab" : "default", transition: "transform 0.2s"
                        }}
                        onMouseEnter={e => { if(hasPermission("task_management", "update")) e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { if(hasPermission("task_management", "update")) e.currentTarget.style.transform = "translateY(0)"; }}
                        onClick={() => hasPermission("task_management", "update") && edit(t)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-main)", lineHeight: "1.4" }}>{t.title}</div>
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.5" }}>{t.description}</div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <div style={{ display: "flex" }}>
                             {assignedList.map((user, idx) => {
                               const u = typeof user === 'object' ? user : staff.find(s => s._id === user);
                               if (!u) return null;
                               return (
                                 <div key={idx} title={u.name} style={{ 
                                   width: "26px", height: "26px", borderRadius: "50%", 
                                   background: "var(--primary-light)", color: "var(--primary-color)", 
                                   display: "flex", alignItems: "center", justifyContent: "center", 
                                   fontSize: "11px", fontWeight: "800", border: "1px solid #fff",
                                   marginLeft: idx > 0 ? "-10px" : "0"
                                 }}>
                                   {u.name.charAt(0).toUpperCase()}
                                 </div>
                               );
                             })}
                             {assignedList.length === 0 && <div style={{ height: "26px" }} />}
                           </div>
                          {isIssue && t.priority && (
                             <span style={{ fontSize: "10.5px", fontWeight: "800", padding: "4px 8px", borderRadius: "6px", background: priorityStyle(t.priority).bg, color: priorityStyle(t.priority).color }}>{t.priority}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {
        tasks.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--text-muted)",
            fontSize: "15px",
          }}>
            {hasPermission("task_management", "create") ? (
              selectedProject
                ? `No ${isIssue ? "issues" : "tasks"} found for "${selectedProject.name}". Click "+ Add ${isIssue ? "Issue" : "Task"}" to create one.`
                : `No ${isIssue ? "issues" : "tasks"} found. Click "+ Add ${isIssue ? "Issue" : "Task"}" to create one.`
            ) : (
              selectedProject
                ? `No ${isIssue ? "issues" : "tasks"} assigned for "${selectedProject.name}".`
                : `No ${isIssue ? "issues" : "tasks"} assigned to your account yet.`
            )}

          </div>
        )
      }

      {/* ─── MODAL: QUICK ADD SUBTASK ─── */}
      {quickSubtaskModal.show && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2000, padding: "20px"
        }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "460px", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", margin: "0 0 4px 0" }}>
              + Add Subtask
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
              For Task: <span style={{ fontWeight: "700", color: "#4f46e5" }}>{quickSubtaskModal.taskTitle}</span>
            </p>

            <form onSubmit={handleQuickAddSubtask}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "4px" }}>
                  Subtask Title <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Implement password hash bcrypt logic"
                  value={quickSubtaskModal.title}
                  onChange={(e) => setQuickSubtaskModal({ ...quickSubtaskModal, title: e.target.value })}
                  className="form-control"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "4px" }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={quickSubtaskModal.startDate}
                    onChange={(e) => setQuickSubtaskModal({ ...quickSubtaskModal, startDate: e.target.value })}
                    className="form-control"
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "4px" }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={quickSubtaskModal.endDate}
                    onChange={(e) => setQuickSubtaskModal({ ...quickSubtaskModal, endDate: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "4px" }}>
                  Status
                </label>
                <select
                  value={quickSubtaskModal.status}
                  onChange={(e) => setQuickSubtaskModal({ ...quickSubtaskModal, status: e.target.value })}
                  className="form-control"
                  style={{ fontWeight: "700" }}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Process">In Process</option>
                  <option value="Complete">Complete</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setQuickSubtaskModal({ show: false, taskId: null, taskTitle: "", title: "", startDate: "", endDate: "", status: "Pending" })}
                  style={{ padding: "8px 16px", background: "#f1f5f9", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: "8px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                >
                  Save Subtask
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK VIEW TASK MODAL */}
      {viewTask && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 9999, padding: "20px"
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "600px",
            maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            padding: "24px", position: "relative"
          }}>
            <button
              onClick={() => setViewTask(null)}
              style={{
                position: "absolute", top: "18px", right: "18px", background: "#f1f5f9",
                border: "none", width: "32px", height: "32px", borderRadius: "50%",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#64748b"
              }}
            >
              <CloseIcon size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{
                fontSize: "11px", fontWeight: "800", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: "6px",
                background: viewTask.priority ? priorityStyle(viewTask.priority).bg : "#e0e7ff",
                color: viewTask.priority ? priorityStyle(viewTask.priority).color : "#4338ca"
              }}>
                {viewTask.priority || "Task"}
              </span>
              {viewTask.project?.name && (
                <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: "600", display: "inline-flex", alignItems: "center" }}>
                  <FolderIcon size={13} color="#6366f1" style={{ marginRight: "4px" }} />
                  {viewTask.project.name}
                </span>
              )}
            </div>

            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", marginBottom: "14px" }}>
              {viewTask.title}
            </h2>

            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", marginBottom: "18px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Description</div>
              <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                {viewTask.description || "No description provided."}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Timeline</div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b", marginTop: "4px" }}>
                  {viewTask.startDate ? new Date(viewTask.startDate).toLocaleDateString('en-GB') : "—"} → {viewTask.endDate || viewTask.calculatedEndDate ? new Date(viewTask.endDate || viewTask.calculatedEndDate).toLocaleDateString('en-GB') : "—"}
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Status</div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#4f46e5", marginTop: "4px" }}>
                  {viewTask.status?.name || viewTask.status || "Pending"}
                </div>
              </div>
            </div>

            {/* Subtasks */}
            {Array.isArray(viewTask.subtasks) && viewTask.subtasks.length > 0 && (
              <div style={{ marginBottom: "18px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>
                  Subtasks ({viewTask.subtasks.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {viewTask.subtasks.map((st, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "13px", color: "#1e293b", fontWeight: "600" }}>↳ {st.title}</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px", background: st.status === 'Complete' ? '#dcfce7' : '#fef3c7', color: st.status === 'Complete' ? '#15803d' : '#b45309' }}>
                        {st.status || "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                onClick={() => setViewTask(null)}
                style={{ padding: "8px 18px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`toast toast-${toast.type === 'delete' ? 'error' : (toast.type || 'success')}`}>
          {toast.type === 'success' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          {(toast.type === 'error' || toast.type === 'delete') && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>}
          {toast.msg}
        </div>
      )}
    </div >
  );
}