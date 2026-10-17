const Staff = require("../models/Staff");
const bcrypt = require("bcryptjs");
const { generatePassword, sendMail } = require("../config/mail");

exports.createStaff = async (req, res) => {
  try {
    // Generate random password for new staff
    const password = generatePassword();
    const hash = await bcrypt.hash(password, 10);

    // Find role based on position
    const Role = require("../models/Role");
    let role;
    
    switch(req.body.position) {
      case "Admin":
      case "Super Admin":
        role = await Role.findOne({ name: "Super Admin" });
        break;
      case "Manager":
        role = await Role.findOne({ name: "Manager" });
        break;
      case "Staff":
      default:
        role = await Role.findOne({ name: "Staff" });
        break;
    }

    // Create staff with hashed password and role
    const staff = new Staff({
      ...req.body,
      password: hash,
      role: role ? role._id : null
    });
    await staff.save();

    console.log(`👤 STAFF CREATED: ${staff.name} (${staff.email})`);
    console.log(`📋 Position: ${staff.position}`);
    console.log(`🔐 Role Assigned: ${role ? role.name : 'No role'}`);
    console.log(`📧 Sending emails...`);

    // Send email with login details
    await sendMail(staff.email, staff.name, staff.position || "Staff", password);

    res.json({ 
      message: "Staff Created and email sent", 
      staff,
      assignedRole: role ? role.name : null,
      tempPassword: password // Only for testing, remove in production
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET current user profile
exports.getProfile = async (req, res) => {
  try {
    const staff = await Staff.findById(req.user._id).populate("role").populate("companyId");
    if (!staff) return res.status(404).json({ error: "User not found" });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT update current user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const staff = await Staff.findById(req.user._id);

    if (!staff) return res.status(404).json({ error: "User not found" });

    if (name) staff.name = name;
    if (phone) staff.phone = phone;
    
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      staff.password = await bcrypt.hash(password, salt);
    } else if (password) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    await staff.save();
    res.json({ message: "Profile updated successfully", staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};