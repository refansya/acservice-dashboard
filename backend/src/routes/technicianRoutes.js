const router = require("express").Router();
const ctrl = require("../controllers/technicianController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
// Hapus data dibatasi ADMIN saja - aksi destruktif dan permanen.
router.delete("/:id", authorize("ADMIN"), ctrl.remove);
router.get("/:id/schedule", ctrl.getSchedule);
router.post("/:id/schedule", ctrl.addSchedule);
router.post("/:id/account", ctrl.createAccount);

module.exports = router;
