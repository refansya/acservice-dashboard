const router = require("express").Router();
const ctrl = require("../controllers/serviceTypeController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
