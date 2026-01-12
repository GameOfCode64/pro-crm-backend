import express from "express";
import multer from "multer";

import { followUpSSE } from "./lead.sse.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";

import {
  getMyLeads,
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
  getLeads,
} from "./lead.controller.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/**
 * EMPLOYEE
 */
router.get("/my", authMiddleware, roleMiddleware("EMPLOYEE"), getMyLeads);
// router.get("/", authMiddleware, roleMiddleware("MANAGER"), getManagerLeads);
router.get("/", authMiddleware, roleMiddleware("MANAGER"), getLeads);

router.post(
  "/reassign",
  authMiddleware,
  roleMiddleware("MANAGER"),
  reassignLeads
);
router.get("/groups", authMiddleware, roleMiddleware("MANAGER"), getLeadGroups);

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getLeadById
);

/**
 * FOLLOW-UP (EMPLOYEE + MANAGER)
 */
router.get(
  "/followups/today",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getTodayFollowUps
);

router.get(
  "/followups/upcoming",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getUpcomingFollowUps
);

router.get(
  "/followups/overdue",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getOverdueFollowUps
);
router.post(
  "/escalate/overdue",
  authMiddleware,
  roleMiddleware("MANAGER"),
  escalateOverdue
);
router.get("/followups/stream", authMiddleware, followUpSSE);

router.get(
  "/performance/:range",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getPerformance
);

router.post("/:id/call", authMiddleware, roleMiddleware("EMPLOYEE"), logCall);

router.post(
  "/:id/status",
  authMiddleware,
  roleMiddleware("EMPLOYEE"),
  changeStatus
);

/**
 * MANAGER
 */
router.post(
  "/upload",
  authMiddleware,
  roleMiddleware("MANAGER"),
  upload.single("file"),
  uploadLeads
);

router.get("/kanban", authMiddleware, roleMiddleware("MANAGER"), getKanban);

router.get(
  "/leaderboard/:range",
  authMiddleware,
  roleMiddleware("MANAGER"),
  getLeaderboard
);

export default router;
