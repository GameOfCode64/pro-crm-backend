import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";
import {
  getMyCallingReportController,
  getTeamCallingReportController,
  exportTeamCallingReportController,
  getAttendanceController,
  exportAttendanceController,
} from "./report.controller.js";

const router = express.Router();

router.get(
  "/team-calls/export",
  auth,
  role("MANAGER"),
  exportTeamCallingReportController,
);
router.get(
  "/team-calls",
  auth,
  role("MANAGER"),
  getTeamCallingReportController,
);

// ── Attendance ──────────────────────────────────────────────
router.get(
  "/attendance/export",
  auth,
  role("MANAGER"),
  exportAttendanceController,
);
router.get("/attendance", auth, role("MANAGER"), getAttendanceController);

router.get("/my-calls", auth, role("EMPLOYEE"), getMyCallingReportController);

export default router;
