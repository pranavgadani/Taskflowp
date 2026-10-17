const router = require("express").Router();
const Staff = require("../models/Staff");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const { sendResetPasswordMail } = require("../config/mail");
const crypto = require("crypto");

const APP_LINK = process.env.APP_URL || "http://localhost:5173";

// ✅ LOGIN — set token as httpOnly cookie
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Staff.findOne({ email }).populate("role").populate("companyId");
    if (!user) return res.status(400).json("User not found");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json("Wrong password");

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "tasksecret", {
      expiresIn: "7d"
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET CURRENT USER — Returns 200 even if not logged in to avoid console errors
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.split(" ")[1]);
    if (!token) return res.json({ user: null });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "tasksecret");
    const user = await Staff.findById(decoded.id).populate("role").populate("companyId");
    
    if (!user) return res.json({ user: null });
    res.json({ user });
  } catch (err) {
    res.json({ user: null });
  }
});

// ✅ LOGOUT
router.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "none", secure: true });
  res.json({ message: "Logged out" });
});

// ✅ FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Staff.findOne({ email });
    if (!user) return res.status(404).json({ error: "No user found with this email" });

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetLink = `${APP_LINK.replace(/\/$/, "")}/reset-password?token=${token}`;
    await sendResetPasswordMail(user.email, user.name, resetLink);

    res.json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ RESET PASSWORD — (Manual Login Required After Success)
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPassword.test(password)) {
      return res.status(400).json({ error: "Password must be 8+ chars with uppercase, lowercase, number, and symbol." });
    }

    const user = await Staff.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: "Token is invalid or has expired" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;