const { User } = require("../models/User");
const generateToken = require("../utils/generateToken");
const {
  validateLoginInput,
  validateProfileInput,
  validateRegisterInput
} = require("../utils/validation");

function sendAuthResponse(res, statusCode, message, user) {
  const token = generateToken(user);

  return res.status(statusCode).json({
    success: true,
    message,
    data: {
      user,
      token
    }
  });
}

async function register(req, res, next) {
  try {
    const { name, email, phone, password, role } = req.body;
    const errors = validateRegisterInput({ name, email, phone, password, role });

    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      res.status(409);
      throw new Error("Email is already registered");
    }

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      password,
      role
    });

    return sendAuthResponse(res, 201, "Registration successful", user);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const errors = validateLoginInput({ email, password });

    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      res.status(401);
      throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
      res.status(403);
      throw new Error("Account is inactive");
    }

    user.password = undefined;
    return sendAuthResponse(res, 200, "Login successful", user);
  } catch (error) {
    return next(error);
  }
}

async function getMe(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      message: "Authenticated user fetched successfully",
      data: {
        user: req.user
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, email, phone } = req.body;
    const errors = validateProfileInput({ name, email, phone });

    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const updates = {};

    if (name !== undefined) updates.name = String(name).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.user._id }
      });

      if (existingUser) {
        res.status(409);
        throw new Error("Email is already registered");
      }

      updates.email = normalizedEmail;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateProfile
};
