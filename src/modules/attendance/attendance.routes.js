import express from "express";

import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import {
  clockIn,
  clockOut,
  myAttendance,
  teamAttendance,
} from "./attendance.controller.js";

const router = express.Router();

/**
 * EMPLOYEE
 */
router.post("/clock-in", authMiddleware, roleMiddleware("EMPLOYEE"), clockIn);

router.post("/clock-out", authMiddleware, roleMiddleware("EMPLOYEE"), clockOut);

router.get("/me", authMiddleware, roleMiddleware("EMPLOYEE"), myAttendance);

/**
 * MANAGER
 */
router.get("/team", authMiddleware, roleMiddleware("MANAGER"), teamAttendance);

export default router;
