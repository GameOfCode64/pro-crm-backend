import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import {
  leadReport,
  employeeReport,
  followUpReport,
} from "./report.controller.js";

const router = express.Router();

/**
 * MANAGER REPORTS
 */
router.get("/leads", authMiddleware, roleMiddleware("MANAGER"), leadReport);

router.get(
  "/employees",
  authMiddleware,
  roleMiddleware("MANAGER"),
  employeeReport
);

router.get(
  "/followups",
  authMiddleware,
  roleMiddleware("MANAGER"),
  followUpReport
);

export default router;
