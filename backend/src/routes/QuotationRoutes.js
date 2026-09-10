const router = require("express").Router();
const ctrl = require("../controllers/quotationController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.get("/:id/pdf", ctrl.downloadPdf);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
router.patch("/:id/status", ctrl.updateStatus);
router.post("/:id/convert", ctrl.convertToOrder);
// Hapus dibatasi ADMIN saja - konsisten dengan modul lain (order, invoice, dll).
router.delete("/:id", authorize("ADMIN"), ctrl.remove);

module.exports = router;
