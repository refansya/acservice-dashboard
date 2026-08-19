const router = require("express").Router();
const ctrl = require("../controllers/invoiceController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.get("/:id/receipt", ctrl.downloadReceipt);
router.post("/from-order/:orderId", ctrl.createFromOrder);
router.patch("/:id/pay", ctrl.markPaid);
router.post("/:id/payments", ctrl.addPayment);

module.exports = router;
