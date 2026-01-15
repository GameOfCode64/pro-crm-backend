import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import {
  createReason,
  getReasons,
  toggleReason,
  getOutcomeReasons,
  createOutcomeReason,
  updateOutcomeReason,
  deleteOutcomeReason,
  getReasonsByOutcome,
} from "./callOutcome.controller.js";

const router = express.Router();

/**
 * MANAGER
 */
router.post("/", authMiddleware, roleMiddleware("MANAGER"), createReason);

router.get("/", authMiddleware, roleMiddleware("MANAGER"), getReasons);

router.patch(
  "/:id/toggle",
  authMiddleware,
  roleMiddleware("MANAGER"),
  toggleReason
);

/**
 * EMPLOYEE + MANAGER
 */
router.get(
  "/reasons/:outcome",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getReasonsByOutcome
);

router.get(
  "/outcome-reasons",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getOutcomeReasons
);

router.post(
  "/outcome-reasons",
  authMiddleware,
  roleMiddleware("MANAGER"),
  createOutcomeReason
);

router.patch(
  "/outcome-reasons/:id",
  authMiddleware,
  roleMiddleware("MANAGER"),
  updateOutcomeReason
);

router.delete(
  "/outcome-reasons/:id",
  authMiddleware,
  roleMiddleware("MANAGER"),
  deleteOutcomeReason
);

export default router;
