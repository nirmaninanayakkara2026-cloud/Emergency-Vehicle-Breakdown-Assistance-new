const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { User } = require("../src/models/User");

async function createAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URI } = process.env;
  if (!MONGO_URI) throw new Error("MONGO_URI is required");
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required");
  }
  if (ADMIN_PASSWORD.length < 8) throw new Error("ADMIN_PASSWORD must contain at least 8 characters");

  await mongoose.connect(MONGO_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  let admin = await User.findOne({ email });
  if (!admin) {
    admin = await User.create({
      name: ADMIN_NAME.trim(),
      email,
      phone: "ADMIN",
      password: ADMIN_PASSWORD,
      role: "admin",
      isActive: true,
      isVerified: true
    });
    console.log(`Admin account created: ${admin.email}`);
  } else {
    admin.name = ADMIN_NAME.trim();
    admin.role = "admin";
    admin.isActive = true;
    admin.isVerified = true;
    admin.password = ADMIN_PASSWORD;
    await admin.save();
    console.log(`Admin account updated: ${admin.email}`);
  }
  return admin;
}

if (require.main === module) {
  createAdmin()
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
      console.error(`Admin creation failed: ${error.message}`);
      await mongoose.disconnect();
      process.exitCode = 1;
    });
}

module.exports = { createAdmin };
