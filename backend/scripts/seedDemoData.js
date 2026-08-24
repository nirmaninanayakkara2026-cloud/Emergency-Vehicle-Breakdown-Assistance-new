const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { User } = require("../src/models/User");
const ProviderProfile = require("../src/models/ProviderProfile");

const DEMO_PROVIDERS = [
  ["Colombo General Auto Care", "mechanic", "general_mechanic", 6.9271, 79.8612, 4.4, 38, 22, 18],
  ["Lakeview Engine Assist", "mechanic", "engine_mechanic", 6.9155, 79.8636, 4.7, 52, 18, 20],
  ["SafeStop Brake Service", "mechanic", "brake_mechanic", 6.9390, 79.8560, 4.8, 61, 15, 16],
  ["City Battery and Electrical", "mechanic", "battery_electrical_mechanic", 6.9320, 79.8740, 4.6, 47, 12, 15],
  ["Metro Fuel System Care", "mechanic", "fuel_system_mechanic", 6.9100, 79.8700, 4.3, 29, 25, 20],
  ["Precision Transmission Help", "mechanic", "transmission_mechanic", 6.9500, 79.8750, 4.5, 34, 28, 25],
  ["SteadyWheel Steering Service", "mechanic", "steering_mechanic", 6.9200, 79.8450, 4.7, 41, 20, 18],
  ["Rapid Tyre Rescue", "mechanic", "tire_mechanic", 6.9350, 79.8500, 4.6, 56, 14, 20],
  ["Colombo Demo Towing", "towing_service", "towing", 6.9450, 79.8650, 4.2, 25, 20, 30],
  ["Central Multi-Service Garage", "garage", "general_mechanic", 6.9050, 79.8550, 4.5, 44, 24, 25]
];

async function upsertUser({ name, email, phone, role }, password) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name, email, phone, role, password, isActive: true, isVerified: true });
  } else {
    user.name = name;
    user.phone = phone;
    user.role = role;
    user.isActive = true;
    user.isVerified = true;
    user.password = password;
    await user.save();
  }
  return user;
}

async function seedDemoData() {
  const mongoUri = process.env.MONGO_URI;
  const password = process.env.DEMO_PASSWORD;
  if (!mongoUri) throw new Error("MONGO_URI is required for demo seeding");
  if (!password || password.length < 8) {
    throw new Error("DEMO_PASSWORD must be configured with at least 8 characters");
  }

  await mongoose.connect(mongoUri);
  const driver = await upsertUser({
    name: "Demo Driver",
    email: "driver.demo@example.com",
    phone: "000-DEMO-001",
    role: "driver"
  }, password);

  const providerAccounts = [];
  for (let index = 0; index < DEMO_PROVIDERS.length; index += 1) {
    const [businessName, providerType, specialization, latitude, longitude, rating, reviews, response, radius] = DEMO_PROVIDERS[index];
    const email = `provider${index + 1}.demo@example.com`;
    const user = await upsertUser({
      name: `${businessName} Demo User`,
      email,
      phone: `000-DEMO-${String(index + 2).padStart(3, "0")}`,
      role: providerType
    }, password);
    await ProviderProfile.findOneAndUpdate(
      { userId: user._id },
      {
        providerType,
        businessName,
        phone: `000-DEMO-${String(index + 2).padStart(3, "0")}`,
        specializations: [specialization],
        serviceCategories: [specialization],
        supportedVehicleTypes: ["car", "van", "three_wheeler"],
        location: { latitude, longitude, address: "Demo area, Colombo, Sri Lanka" },
        availabilityStatus: "available",
        serviceRadiusKm: radius,
        averageRating: rating,
        totalReviews: reviews,
        averageResponseTimeMinutes: response,
        estimatedPriceRange: { minimum: 2500, maximum: 15000 },
        openingHours: "Demo hours: 7:00 AM - 9:00 PM",
        isApproved: true,
        isActive: true
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    providerAccounts.push(email);
  }

  console.log("DEMO DATA SEED COMPLETE");
  console.log(`Driver: ${driver.email}`);
  console.log(`Providers created/updated: ${providerAccounts.length}`);
  console.log("Password source: DEMO_PASSWORD environment variable");
}

if (require.main === module) {
  seedDemoData()
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
      console.error(`Demo seed failed: ${error.message}`);
      await mongoose.disconnect();
      process.exitCode = 1;
    });
}

module.exports = { DEMO_PROVIDERS, seedDemoData, upsertUser };
