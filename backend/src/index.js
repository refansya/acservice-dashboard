require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const path = require("path");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const technicianRoutes = require("./routes/technicianRoutes");
const serviceTypeRoutes = require("./routes/serviceTypeRoutes");
const orderRoutes = require("./routes/orderRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const myRoutes = require("./routes/myRoutes");
const helperRoutes = require("./routes/helperRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const errorHandler = require("./middleware/errorHandler");
const { startMaintenanceReminderJob } = require("./services/maintenanceReminderService");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/technicians", technicianRoutes);
app.use("/api/service-types", serviceTypeRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/my", myRoutes);
app.use("/api/helpers", helperRoutes);
app.use("/api/reminders", reminderRoutes);

app.use((req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan" }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
  startMaintenanceReminderJob();
});
