const router = require("express").Router();
const ctrl = require("../controllers/reportController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/revenue", ctrl.revenueSummary);
router.get("/top-services", ctrl.topServices);
router.get("/technician-performance", ctrl.technicianPerformance);
router.get("/category-breakdown", ctrl.categoryBreakdown);
router.get("/helper-commissions", ctrl.helperCommissions);
router.get("/preventive-reminders", ctrl.preventiveReminders);

module.exports = router;
