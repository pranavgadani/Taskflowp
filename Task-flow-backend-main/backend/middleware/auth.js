const jwt = require("jsonwebtoken");
const Staff = require("../models/Staff");

module.exports = async (req, res, next) => {
  try {
    // 🍪 Read token from httpOnly cookie first, then Authorization header fallback
    const token =
      req.cookies?.token ||
      (req.headers.authorization && req.headers.authorization.split(" ")[1]);

    if (!token) return res.status(401).json("No token provided");

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "tasksecret");
    const user = await Staff.findById(decoded.id).populate("role").populate("companyId");

    if (!user) {
      return res.status(401).json("User no longer exists");
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json("Invalid Token");
  }
};