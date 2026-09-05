const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const breakdownRequestRoutes = require("./src/routes/breakdownRequestRoutes");
const healthRoutes = require("./src/routes/healthRoutes");
const providerRoutes = require("./src/routes/providerRoutes");
const providerProfileRoutes = require("./src/routes/providerProfileRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const selfAssistantRoutes = require("./src/routes/selfAssistantRoutes");
const sparePartRoutes = require("./src/routes/sparePartRoutes");
const { notFound, errorHandler } = require("./src/middleware/errorMiddleware");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/provider-profile", providerProfileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/breakdown-requests", breakdownRequestRoutes);
app.use("/api/self-assistant", selfAssistantRoutes);
app.use("/api/spare-parts", sparePartRoutes);

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });

  server.on("error", (error) => {
    console.error(`Server failed to listen on port ${PORT}:`, error.message);
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
