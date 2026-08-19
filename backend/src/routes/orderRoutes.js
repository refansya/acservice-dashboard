const router = require("express").Router();
const ctrl = require("../controllers/orderController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", ctrl.create);
router.patch("/:id/assign", ctrl.assignTechnician);
router.patch("/:id/status", ctrl.updateStatus);
router.post("/:id/items", ctrl.addItem);
router.post("/:id/checkout", ctrl.checkout);

module.exports = router;
