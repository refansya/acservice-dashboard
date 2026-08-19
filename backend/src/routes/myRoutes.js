const router = require("express").Router();
const ctrl = require("../controllers/myOrderController");
const upload = require("../config/upload");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate, authorize("TECHNICIAN"));

router.get("/orders", ctrl.myOrders);
router.get("/helpers", ctrl.availableHelpers);
router.post("/helpers", ctrl.createAvailableHelper);
router.post("/orders", ctrl.createMyOrder);
router.get("/orders/:id", ctrl.myOrderDetail);
router.patch("/orders/:id/status", ctrl.updateStatus);
router.patch("/orders/:id/notes", ctrl.updateNotes);
router.patch("/orders/:id/findings", ctrl.updateFindings);
router.patch("/orders/:id/job-details", ctrl.saveJobDetails);
router.post("/orders/:id/items", ctrl.addItem);
router.post("/orders/:id/photos", upload.single("photo"), ctrl.uploadPhoto);
router.post("/orders/:id/checkout", ctrl.checkout);
router.get("/orders/:id/receipt", ctrl.myReceipt);

module.exports = router;
