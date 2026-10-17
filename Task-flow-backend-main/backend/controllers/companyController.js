const Company = require("../models/Company");
const Staff = require("../models/Staff");
const Role = require("../models/Role");
const Subscription = require("../models/Subscription");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Registration
exports.registerCompany = async (req, res) => {
  try {
    const {
      companyName, gstNumber, panNumber, contactPersonName, contactPersonPhone,
      contactPersonEmail, email, phone, addressLine1, addressLine2, country,
      state, city, pincode, password
    } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const pincodeRegex = /^[0-9]{6}$/;

    if (!companyName) return res.status(400).json({ error: "Company Name is required" });
    if (!email || !emailRegex.test(email)) return res.status(400).json({ error: "Valid Company Email is required" });
    if (!contactPersonName) return res.status(400).json({ error: "Contact Person Name is required" });
    if (!contactPersonPhone || !phoneRegex.test(contactPersonPhone)) return res.status(400).json({ error: "Valid 10-digit Contact Phone is required" });
    if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    if (gstNumber && !gstRegex.test(gstNumber.toUpperCase())) return res.status(400).json({ error: "Invalid GST Number format" });
    if (panNumber && !panRegex.test(panNumber.toUpperCase())) return res.status(400).json({ error: "Invalid PAN Number format" });
    if (phone && !phoneRegex.test(phone)) return res.status(400).json({ error: "Invalid Company Phone (10 digits)" });
    if (pincode && !pincodeRegex.test(pincode)) return res.status(400).json({ error: "Invalid Pincode (6 digits)" });

    const existingCompany = await Company.findOne({ email });
    if (existingCompany) return res.status(400).json({ error: "Company email already exists" });

    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) return res.status(400).json({ error: "Staff email already exists" });

    const freePlan = await Subscription.findOne({ billingCycle: "monthly" });
    const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 1);

    const company = await Company.create({
      companyName, gstNumber, panNumber, contactPersonName, contactPersonPhone,
      contactPersonEmail, email, phone, addressLine1, addressLine2, country,
      state, city, pincode, appLogo: req.file ? `/uploads/${req.file.filename}` : "",
      subscription: freePlan ? freePlan._id : null,
      subscriptionStatus: "trial",
      subscriptionExpiry: expiry
    });

    const ownerRole = await Role.create({
      name: "Company Owner", status: "Active", companyId: company._id,
      permissions: [
        { name: "Staff Management", value: "staff_management", all: true, create: true, read: true, update: true, delete: true },
        { name: "Task Management", value: "task_management", all: true, create: true, read: true, update: true, delete: true },
        { name: "Project Management", value: "project_management", all: true, create: true, read: true, update: true, delete: true },
        { name: "View Dashboard", value: "view_dashboard", all: true, read: true },
        { name: "Issue Management", value: "issue", all: true, create: true, read: true, update: true, delete: true },
        { name: "Task Status Management", value: "task_status_management", all: true, create: true, read: true, update: true, delete: true },
        { name: "Document Management", value: "document", all: true, create: true, read: true, update: true, delete: true },
        { name: "Role Management", value: "role_management", all: true, create: true, read: true, update: true, delete: true },
        { name: "Permission Management", value: "permission_management", all: true, create: true, read: true, update: true, delete: true }
      ]
    });

    await Role.create({
      name: "Staff", status: "Active", companyId: company._id,
      permissions: [
        { name: "Task Management", value: "task_management", all: false, create: true, read: true, update: true, delete: false },
        { name: "View Dashboard", value: "view_dashboard", all: true, read: true },
        { name: "Issue Management", value: "issue", all: false, create: true, read: true, update: true, delete: false },
        { name: "Document Management", value: "document", all: false, create: false, read: true, update: false, delete: false }
      ]
    });

    await Role.create({
      name: "Manager", status: "Active", companyId: company._id,
      permissions: [
        { name: "Staff Management", value: "staff_management", all: false, create: false, read: true, update: false, delete: false },
        { name: "Task Management", value: "task_management", all: true, create: true, read: true, update: true, delete: true },
        { name: "Project Management", value: "project_management", all: false, create: false, read: true, update: false, delete: false },
        { name: "View Dashboard", value: "view_dashboard", all: true, read: true },
        { name: "Issue Management", value: "issue", all: true, create: true, read: true, update: true, delete: true },
        { name: "Task Status Management", value: "task_status_management", all: false, create: false, read: true, update: false, delete: false },
        { name: "Document Management", value: "document", all: false, create: true, read: true, update: true, delete: false }
      ]
    });

    await Role.create({
      name: "Worker", status: "Active", companyId: company._id,
      permissions: [
        { name: "Task Management", value: "task_management", all: false, create: false, read: true, update: true, delete: false },
        { name: "View Dashboard", value: "view_dashboard", all: true, read: true },
        { name: "Issue Management", value: "issue", all: false, create: false, read: true, update: true, delete: false }
      ]
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const staff = await Staff.create({
      name: contactPersonName, email: email, password: hashedPassword, phone: contactPersonPhone,
      role: ownerRole._id, companyId: company._id, status: "Active"
    });

    const populatedStaff = await Staff.findById(staff._id).populate("role").populate("companyId");
    const token = jwt.sign({ id: staff._id }, process.env.JWT_SECRET || "tasksecret", { expiresIn: "7d" });
    res.cookie("token", token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: "none", 
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });
    
    res.status(201).json({ 
      message: "Company and Owner registered successfully", 
      company, 
      staff: populatedStaff, 
      token,
      autoLogin: true 
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Handle JSON parsing for nested objects if sent as strings (e.g. from FormData)
    if (typeof updateData.workingHours === 'string') {
        try { updateData.workingHours = JSON.parse(updateData.workingHours); } catch(e) {}
    }
    if (typeof updateData.breakTime === 'string') {
        try { updateData.breakTime = JSON.parse(updateData.breakTime); } catch(e) {}
    }
    if (typeof updateData.holidays === 'string') {
        try { updateData.holidays = JSON.parse(updateData.holidays); } catch(e) {}
    }

    if (req.file) updateData.appLogo = `/uploads/${req.file.filename}`;
    
    // Remove read-only or sensitive fields from updateData
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });

    Object.assign(company, updateData);

    if (updateData.workingHours) company.markModified("workingHours");
    if (updateData.breakTime) company.markModified("breakTime");
    if (updateData.holidays) company.markModified("holidays");

    await company.save();
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    await Staff.deleteMany({ companyId: req.params.id });
    res.json({ message: "Company and its staff deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET company settings & BIO
exports.getSettings = async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    let companyId = req.user.companyId?._id || req.user.companyId;
    
    if (isSuperAdmin && req.query.companyId) {
      companyId = Array.isArray(req.query.companyId) ? req.query.companyId[0] : req.query.companyId;
    }

    let company = await Company.findById(companyId);
    if (!company) {
      company = await Company.findOne();
    }
    if (!company) return res.status(404).json({ error: "Company not found" });

    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT update company settings & BIO
exports.updateSettings = async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    const isOwnerOrAdmin = req.user.role?.name === "Company Owner" || isSuperAdmin;
    if (!isOwnerOrAdmin) return res.status(403).json({ error: "Permission denied" });

    let companyId = req.user.companyId?._id || req.user.companyId;
    
    if (isSuperAdmin && req.query.companyId) {
      companyId = Array.isArray(req.query.companyId) ? req.query.companyId[0] : req.query.companyId;
    }

    let company = companyId ? await Company.findById(companyId) : await Company.findOne();
    if (!company) return res.status(404).json({ error: "Company not found" });

    const updateData = { ...req.body };

    // Function to parse JSON if string
    const parse = (val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch(e) { return val; }
        }
        return val;
    };

    // Explicitly handle nested objects
    if (updateData.workingHours) {
        company.workingHours = parse(updateData.workingHours);
        company.markModified("workingHours");
        delete updateData.workingHours;
    }
    if (updateData.breakTime) {
        company.breakTime = parse(updateData.breakTime);
        company.markModified("breakTime");
        delete updateData.breakTime;
    }
    if (updateData.holidays) {
        company.holidays = parse(updateData.holidays);
        company.markModified("holidays");
        delete updateData.holidays;
    }
    if (updateData.policies) {
        company.policies = parse(updateData.policies);
        company.markModified("policies");
        delete updateData.policies;
    }

    if (req.file) updateData.appLogo = `/uploads/${req.file.filename}`;

    // Remove read-only or sensitive fields from updateData
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Set remaining fields
    company.set(updateData);

    await company.save();
    res.json({ message: "Settings updated successfully", settings: company });
  } catch (err) {
    console.error("DEBUG: updateSettings error detail:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};

// GET all company policies (Accessible by all staff)
exports.getPolicies = async (req, res) => {
  try {
    let companyId = req.user.companyId?._id || req.user.companyId;
    let company = companyId ? await Company.findById(companyId) : await Company.findOne();
    if (!company) company = await Company.findOne();
    if (!company) return res.json({ policies: [] });

    res.json({ policies: company.policies || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST add new policy (Admin only)
exports.addPolicy = async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    const isOwnerOrAdmin = req.user.role?.name === "Company Owner" || isSuperAdmin;
    if (!isOwnerOrAdmin) return res.status(403).json({ error: "Only Admin can add company policies" });

    const { title, category, summary, content, effectiveDate, status } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Policy title and content are required" });

    let companyId = req.user.companyId?._id || req.user.companyId;
    let company = companyId ? await Company.findById(companyId) : await Company.findOne();
    if (!company) company = await Company.findOne();
    if (!company) return res.status(404).json({ error: "Company not found" });

    const newPolicy = {
      title: title.trim(),
      category: category || "General",
      summary: (summary || "").trim(),
      content: content.trim(),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      status: status || "Active",
      updatedBy: req.user.name || "Admin",
      updatedAt: new Date()
    };

    if (!Array.isArray(company.policies)) company.policies = [];
    company.policies.push(newPolicy);
    await company.save();

    res.status(201).json({ message: "Company policy added successfully", policy: newPolicy, policies: company.policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT update policy (Admin only)
exports.updatePolicy = async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    const isOwnerOrAdmin = req.user.role?.name === "Company Owner" || isSuperAdmin;
    if (!isOwnerOrAdmin) return res.status(403).json({ error: "Only Admin can update company policies" });

    const { policyId } = req.params;
    const { title, category, summary, content, effectiveDate, status } = req.body;

    let companyId = req.user.companyId?._id || req.user.companyId;
    let company = companyId ? await Company.findById(companyId) : await Company.findOne();
    if (!company) company = await Company.findOne();
    if (!company) return res.status(404).json({ error: "Company not found" });

    const policy = company.policies.id(policyId);
    if (!policy) return res.status(404).json({ error: "Policy not found" });

    if (title) policy.title = title.trim();
    if (category) policy.category = category;
    if (summary !== undefined) policy.summary = summary.trim();
    if (content) policy.content = content.trim();
    if (effectiveDate) policy.effectiveDate = new Date(effectiveDate);
    if (status) policy.status = status;
    policy.updatedBy = req.user.name || "Admin";
    policy.updatedAt = new Date();

    await company.save();
    res.json({ message: "Policy updated successfully", policy, policies: company.policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE policy (Admin only)
exports.deletePolicy = async (req, res) => {
  try {
    const isSuperAdmin = req.user.email === "gadanipranav@gmail.com" || req.user.role?.name === "Super Admin";
    const isOwnerOrAdmin = req.user.role?.name === "Company Owner" || isSuperAdmin;
    if (!isOwnerOrAdmin) return res.status(403).json({ error: "Only Admin can delete company policies" });

    const { policyId } = req.params;
    let companyId = req.user.companyId?._id || req.user.companyId;
    let company = companyId ? await Company.findById(companyId) : await Company.findOne();
    if (!company) company = await Company.findOne();
    if (!company) return res.status(404).json({ error: "Company not found" });

    company.policies = company.policies.filter(p => p._id.toString() !== policyId);
    await company.save();

    res.json({ message: "Policy deleted successfully", policies: company.policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
