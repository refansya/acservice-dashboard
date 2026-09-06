const router = require("express").Router();
const ctrl = require("../controllers/orderController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", ctrl.create);
router.patch("/:id/assign", ctrl.assignTechnician);
router.patch("/:id/status", ctrl.updateStatus);
router.post("/:id/items", ctrl.addItem);
router.post("/:id/checkout", ctrl.checkout);
// Hapus data dibatasi ADMIN saja - aksi destruktif dan permanen, ikut
// menghapus invoice & pembayaran terkait kalau ada.
router.delete("/:id", authorize("ADMIN"), ctrl.remove);

module.exports = router;
