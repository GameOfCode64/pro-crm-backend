import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";

import {
  createTeam,
  listTeams,
  getTeamById,
  addEmployeeToTeam,
  getEmployeePerformance,
  getTeamAnalytics,
} from "./team.controller.js";

const router = express.Router();

/**
 * ADMIN ONLY
 */
router.post("/", auth, role("ADMIN"), createTeam);

/**
 * ADMIN + MANAGER
 */
router.get("/", auth, role("ADMIN", "MANAGER"), listTeams);
router.get("/:id", auth, role("ADMIN", "MANAGER"), getTeamById);

/**
 * MANAGER FEATURES
 */
router.post("/:id/employees", auth, role("MANAGER"), addEmployeeToTeam);

/**
 * Employee analytics
 */
router.get(
  "/employees/:employeeId/performance",
  auth,
  role("MANAGER"),
  getEmployeePerformance
);

/**
 * Team analytics (unassigned leads, totals)
 */
router.get("/:id/analytics", auth, role("MANAGER"), getTeamAnalytics);

export default router;
