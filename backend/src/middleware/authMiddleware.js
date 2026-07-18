const jwt = require("jsonwebtoken");
const { User } = require("../models/User");

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401);
      throw new Error("Not authorized, token missing");
    }

    if (!process.env.JWT_SECRET) {
      res.status(500);
      throw new Error("JWT_SECRET is not configured");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401);
      throw new Error("Not authorized, user not found");
    }

    if (!user.isActive) {
      res.status(403);
      throw new Error("Account is inactive");
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      res.status(401);
      return next(new Error("Not authorized, token invalid or expired"));
    }

    return next(error);
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error("Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      res.status(403);
      return next(new Error("You do not have permission to access this resource"));
    }

    return next();
  };
}

module.exports = {
  protect,
  authorizeRoles
};
