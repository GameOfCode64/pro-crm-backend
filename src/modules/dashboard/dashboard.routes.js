import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import {
  getDashboardSummary,
  getPerformanceOverview,
  getFollowUpAlerts,
  getManagerDashboard,
} from "./dashboard.controller.js";

const router = express.Router();

/**
 * MANAGER DASHBOARD
 */
router.get(
  "/summary",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getDashboardSummary
);

router.get(
  "/manager",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getManagerDashboard
);

router.get(
  "/performance",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getPerformanceOverview
);

router.get(
  "/followups",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getFollowUpAlerts
);

export default router;
