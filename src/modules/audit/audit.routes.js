import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import { listAuditLogs } from "./audit.controller.js";

const router = express.Router();

/**
 * ADMIN & MANAGER
 */
router.get(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN", "MANAGER"),
  listAuditLogs
);

export default router;
