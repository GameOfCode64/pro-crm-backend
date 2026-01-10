import express from "express";

import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import { getMe, listUsers, toggleUserStatus } from "./user.controller.js";

const router = express.Router();

/**
 * Logged-in user
 */
router.get("/me", authMiddleware, getMe);

/**
 * Admin / Manager
 */
router.get("/", authMiddleware, roleMiddleware("ADMIN", "MANAGER"), listUsers);

/**
 * Admin only
 */
router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("ADMIN"),
  toggleUserStatus
);

export default router;
