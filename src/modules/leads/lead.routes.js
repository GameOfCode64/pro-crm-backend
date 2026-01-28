import express from "express";
import multer from "multer";

import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";

import {
  getMyLeads,
  getLeads,
  getLeadById,
  logCall,
  changeStatus,
  uploadLeads,
  getKanban,
  getLeaderboard,
  reassignLeads,
  getTodayFollowUps,
  getUpcomingFollowUps,
  getOverdueFollowUps,
  escalateOverdue,
  getLeadGroups,
  getPerformance,
  completeLead,

  // 🔥 NEW – ASSIGN LEADS PAGE
  getAssignLeadsPage,
  getAssignLeadsAnalytics,
} from "./lead.controller.js";

import { followUpSSE } from "./lead.sse.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/**
 * ======================================================
 * EMPLOYEE ROUTES
 * ======================================================
 */

router.get("/my", authMiddleware, roleMiddleware("EMPLOYEE"), getMyLeads);

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getLeadById,
);

router.post(
  "/:id/call",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  logCall,
);

router.post(
  "/:id/status",
  authMiddleware,
  roleMiddleware("EMPLOYEE"),
  changeStatus,
);

router.post(
  "/:id/complete",
  authMiddleware,
  roleMiddleware("EMPLOYEE"),
  completeLead,
);

/**
 * ======================================================
 * FOLLOW-UPS (EMPLOYEE + MANAGER)
 * ======================================================
 */

router.get(
  "/followups/today",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getTodayFollowUps,
);

router.get(
  "/followups/upcoming",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getUpcomingFollowUps,
);

router.get(
  "/followups/overdue",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getOverdueFollowUps,
);

router.post(
  "/escalate/overdue",
  authMiddleware,
  roleMiddleware("MANAGER"),
  escalateOverdue,
);

/**
 * 🔴 FOLLOW-UP LIVE STREAM (SSE)
 */
router.get("/followups/stream", authMiddleware, followUpSSE);

/**
 * ======================================================
 * MANAGER ROUTES
 * ======================================================
 */

router.get("/", authMiddleware, roleMiddleware("MANAGER"), getLeads);

router.post(
  "/upload",
  authMiddleware,
  roleMiddleware("MANAGER"),
  upload.single("file"),
  uploadLeads,
);

router.post(
  "/reassign",
  authMiddleware,
  roleMiddleware("MANAGER"),
  reassignLeads,
);

router.get("/groups", authMiddleware, roleMiddleware("MANAGER"), getLeadGroups);

router.get("/kanban", authMiddleware, roleMiddleware("MANAGER"), getKanban);

router.get(
  "/leaderboard/:range",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getLeaderboard,
);

router.get(
  "/performance/:range",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getPerformance,
);

/**
 * ======================================================
 * 🔥 NEW – ASSIGN LEADS PAGE (MANAGER)
 * ======================================================
 */

/**
 * Leads list for Assign Leads page
 * Supports:
 * - pagination
 * - employee filter
 * - outcome filter
 * - search
 */
router.get(
  "/assign/page",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getAssignLeadsPage,
);

/**
 * Analytics for Assign Leads page
 * Used for charts (by employee / by outcome)
 */
router.get(
  "/assign/analytics",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getAssignLeadsAnalytics,
);

export default router;
