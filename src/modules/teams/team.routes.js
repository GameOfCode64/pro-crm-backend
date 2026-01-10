import express from "express";

import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import { createTeam, listTeams, getTeamById } from "./team.controller.js";

const router = express.Router();

/**
 * ADMIN ONLY
 */
router.post("/", authMiddleware, roleMiddleware("ADMIN"), createTeam);

/**
 * ADMIN + MANAGER
 */
router.get("/", authMiddleware, roleMiddleware("ADMIN", "MANAGER"), listTeams);

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "MANAGER"),
  getTeamById
);

export default router;
