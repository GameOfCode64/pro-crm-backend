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

/**
 * Get full pipeline (EMPLOYEE + MANAGER)
 */
router.get("/", auth, role("MANAGER", "EMPLOYEE"), getPipeline);

/**
 * Create custom outcome (MANAGER only)
 */
router.post("/outcomes", auth, role("MANAGER"), createOutcome);

/**
 * Update outcome + reasons (MANAGER only)
 */
router.put("/outcomes/:id", auth, role("MANAGER"), updateOutcome);

/**
 * Delete non-system outcome (MANAGER only)
 */
router.delete("/outcomes/:id", auth, role("MANAGER"), deleteOutcome);

export default router;
