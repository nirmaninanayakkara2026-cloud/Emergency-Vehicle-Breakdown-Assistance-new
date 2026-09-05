const { USER_ROLES } = require("../models/User");
const PUBLIC_REGISTRATION_ROLES = USER_ROLES.filter((role) => role !== "admin");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return emailPattern.test(String(email || "").trim());
}

function validateRegisterInput({ name, email, phone, password, role }) {
  const errors = [];

  if (!name || !String(name).trim()) errors.push("Name is required");
  if (!email || !String(email).trim()) errors.push("Email is required");
  if (email && !isValidEmail(email)) errors.push("Email must be valid");
  if (!phone || !String(phone).trim()) errors.push("Phone number is required");
  if (!password) errors.push("Password is required");
  if (password && password.length < 6) errors.push("Password must be at least 6 characters");
  if (!role) errors.push("Role is required");
  if (role && !PUBLIC_REGISTRATION_ROLES.includes(role)) errors.push(`Role must be one of: ${PUBLIC_REGISTRATION_ROLES.join(", ")}`);

  return errors;
}

function validateLoginInput({ email, password }) {
  const errors = [];

  if (!email || !String(email).trim()) errors.push("Email is required");
  if (email && !isValidEmail(email)) errors.push("Email must be valid");
  if (!password) errors.push("Password is required");

  return errors;
}

function validateProfileInput({ name, email, phone }) {
  const errors = [];

  if (name !== undefined && !String(name).trim()) errors.push("Name cannot be empty");
  if (phone !== undefined && !String(phone).trim()) errors.push("Phone number cannot be empty");
  if (email !== undefined && !isValidEmail(email)) errors.push("Email must be valid");

  return errors;
}

module.exports = {
  isValidEmail,
  validateRegisterInput,
  validateLoginInput,
  validateProfileInput
};
