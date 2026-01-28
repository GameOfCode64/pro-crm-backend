import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";
import {
  getPipeline,
  createOutcome,
  updateOutcome,
  deleteOutcome,
} from "./pipeline.controller.js";

const router = express.Router();

router.get("/", auth, role("MANAGER", "EMPLOYEE"), getPipeline);
router.post("/outcomes", auth, role("MANAGER"), createOutcome);
router.put("/outcomes/:id", auth, role("MANAGER"), updateOutcome);
router.delete("/reasons/:id", auth, role("MANAGER"), deleteOutcome);

export default router;
