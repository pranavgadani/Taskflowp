import React, { useEffect, useState } from "react";
import "../style/main.css";
import DataTable from "../components/common/DataTable";
import FormModal from "../components/common/FormModal";
import PageHeader from "../components/common/PageHeader";
import ProtectedRoute from "../components/ProtectedRoute";
import API from "../api/api";
import { SelectField, TextInput } from "../components/common/FormFields";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionContext";
import { useCompany } from "../contexts/CompanyContext";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const { user } = useAuth();
  const { hasPermission: ctxHasPermission } = usePermissions();
  const { selectedCompany } = useCompany();

  const isSuperAdmin = user?.email === "gadanipranav@gmail.com" || user?.role?.name === "Super Admin";
  const isCompanyOwner = user?.role?.name === "Company Owner";

  const hasPermission = (module, action = "read") => {
    if (isSuperAdmin || isCompanyOwner) return true;
    return ctxHasPermission(module, action);
  };

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    status: "Active",
    role: "",
  });

  // Toast notification
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  };

  const [ratingMap, setRatingMap] = useState({});

  // LOAD STAFF
  const load = async () => {
    const res = await API.get("/staff");
    setStaff(res.data.staff || res.data);
  };

  // LOAD ROLES
  const loadRoles = async () => {
    const res = await API.get("/roles");
    setRoles(Array.isArray(res.data) ? res.data : []);
  };

  // LOAD RATINGS
  const loadRatings = async () => {
    try {
      const res = await API.get("/ratings/summary");
      if (Array.isArray(res.data)) {
        const map = {};
        res.data.forEach((item) => {
          if (item.employee?._id) {
            map[item.employee._id] = item.averageScore;
          }
        });
        setRatingMap(map);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
    loadRoles();
    loadRatings();
  }, [selectedCompany]);

  // SAVE
  const save = async () => {
    // Validation
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!form.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    if (!nameRegex.test(form.name.trim())) {
      showToast("Name must contain only letters and spaces", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim()) {
      showToast("Email is required", "error");
      return;
    }
    if (form.email.length > 255) {
      showToast("Email must be less than 255 characters", "error");
      return;
    }
    if (!emailRegex.test(form.email.trim())) {
      showToast("Please enter a valid email address", "error");
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!form.phone || !String(form.phone).trim()) {
      showToast("Phone is required", "error");
      return;
    }
    if (!phoneRegex.test(String(form.phone).trim())) {
      showToast("Phone must contain 10 digits only", "error");
      return;
    }

    if (!form.status) {
      showToast("Please select a status", "error");
      return;
    }

    if (!form.role) {
      showToast("Please assign a role", "error");
      return;
    }

    if (!editId && (!form.password || form.password.trim().length < 6)) {
      showToast("Password is required (minimum 6 characters)", "error");
      return;
    }

    if (editId && form.password && form.password.trim().length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    try {
      if (editId) {
        const originalStaff = staff.find(s => s._id === editId);
        if (originalStaff) {
          const isSameName = originalStaff.name === form.name.trim();
          const isSameEmail = originalStaff.email === form.email.trim();
          const isSamePhone = String(originalStaff.phone || "").trim() === String(form.phone || "").trim();
          const isSameStatus = originalStaff.status === form.status;
          const isSameRole = (originalStaff.role?._id || originalStaff.role || "") === form.role;
          const hasNoPasswordChange = !form.password || !form.password.trim();

          if (isSameName && isSameEmail && isSamePhone && isSameStatus && isSameRole && hasNoPasswordChange) {
            showToast("No changes detected.", "info");
            resetForm();
            setShowForm(false);
            return;
          }
        }
        await API.put(
          `/staff/${editId}`,
          form
        );
        showToast("Staff updated successfully!");
      } else {
        await API.post(
          "/staff",
          form
        );
        showToast("Staff added successfully!");
      }

      resetForm();
      setShowForm(false);
      load();
    } catch (error) {
      console.error("Error saving staff:", error);
      showToast("Error saving staff", "error");
    }
  };

  // RESET FORM
  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      status: "Active",
      role: "",
    });
    setEditId(null);
  };

  // EDIT
  const edit = (item) => {
    if (item.email === "gadanipranav@gmail.com" || (item.role && item.role.name === "Super Admin")) {
      showToast("Super Admin cannot be edited", "error");
      return;
    }
    setForm({
      ...item,
      password: "",
      role: item.role ? (item.role._id || item.role.id || item.role) : ""
    });
    setEditId(item._id);
    setShowForm(true);
  };

  // DELETE
  const remove = async (id) => {
    const item = staff.find(s => s._id === id);
    if (item && (item.email === "gadanipranav@gmail.com" || (item.role && item.role.name === "Super Admin"))) {
      showToast("Super Admin cannot be deleted", "error");
      return;
    }
    try {
      await API.delete(`/staff/${id}`);
      showToast("Staff deleted successfully!", "delete");
      load();
    } catch (error) {
      console.error("Error deleting staff:", error);
      showToast("Error deleting staff", "error");
    }
  };

  // TABLE COLUMNS
  const columns = [
    { header: "Name", key: "name" },
    { header: "Email", key: "email" },
    { header: "Phone", key: "phone" },
    {
      header: "Status",
      key: "status",
      render: (v) => (
        <span className={`badge badge-${v?.toLowerCase() === 'active' ? 'active' : 'inactive'}`}>
          {v || "Active"}
        </span>
      )
    },
    { header: "Role", key: "role" },
    {
      header: "Rating",
      key: "_id",
      render: (id) => {
        const score = ratingMap[id];
        if (!score) return <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>No reviews</span>;
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "700", color: "#f59e0b" }}>
            ★ {score}
          </span>
        );
      }
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Staff Management"
        buttonText={hasPermission("staff_management", "create") ? "+ Add Staff" : null}
        onButtonClick={() => setShowForm(true)}
      />

      {/* FORM MODAL */}

        <FormModal
          show={showForm}
          onClose={() => {
            setShowForm(false);
            resetForm();
          }}
          title={editId ? "Edit Staff" : "Add Staff"}
          onSave={save}
          saveText={editId ? "Update" : "Save"}
        >
          <form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <TextInput
              label="Name"
              type="text"
              placeholder="Enter name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            <TextInput
              label="Email"
              type="email"
              placeholder="Enter email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
              required
            />

            <TextInput
              label="Phone"
              type="text"
              placeholder="Enter phone (10 digits)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
              maxLength={10}
              required
            />

            <TextInput
              label={editId ? "Password (Leave blank to keep current)" : "Password"}
              type="password"
              placeholder={editId ? "Enter new password (optional)" : "Enter password (min 6 characters)"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editId}
            />

            <SelectField
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: "", label: "Select Status" },
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
              ]}
              required
            />

            <SelectField
              label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              required
            >
              <option value="">Select a Role</option>
              {roles.filter(r => r.name !== "Super Admin").map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
          </form>
        </FormModal>


      {/* DATA TABLE */}

        <DataTable
          data={staff}
          columns={columns}
          onEdit={hasPermission("staff_management", "update") ? edit : null}
          onDelete={hasPermission("staff_management", "delete") ? remove : null}
        />


      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '16px 24px',
          borderRadius: '8px',
          background: toast.type === 'success' ? '#4CAF50' : toast.type === 'delete' ? '#f44336' : toast.type === 'error' ? '#f44336' : '#ff9800',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          zIndex: 9999,
          animation: 'slideInRight 0.3s ease-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}