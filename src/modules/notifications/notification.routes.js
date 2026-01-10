import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import {
  getMyNotifications,
  notificationStream,
} from "./notification.controller.js";

const router = express.Router();

/**
 * In-app notifications list
 */
router.get("/my", authMiddleware, getMyNotifications);

/**
 * Real-time stream (SSE)
 */
router.get("/stream", authMiddleware, notificationStream);

export default router;
