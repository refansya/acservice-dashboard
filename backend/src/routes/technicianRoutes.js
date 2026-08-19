const router = require("express").Router();
const ctrl = require("../controllers/technicianController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
router.get("/:id/schedule", ctrl.getSchedule);
router.post("/:id/schedule", ctrl.addSchedule);
router.post("/:id/account", ctrl.createAccount);

module.exports = router;
