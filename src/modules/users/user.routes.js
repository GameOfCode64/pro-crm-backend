import express from "express";

import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import {
  /* existing */
  getMe,
  listUsers,
  getEmployees,
  toggleUserStatus,
  /* team management */
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  resetMemberPassword,
  setMemberLeaveStatus,
  checkIn,
  checkOut,
  /* self-service attendance */
  getMyAttendance,
  getMyAttendanceHistory,
  selfClockIn,
  selfClockOut,
} from "./user.controller.js";

const router = express.Router();

const auth = authMiddleware;
const mgr = [authMiddleware, roleMiddleware("MANAGER")];
const adminMgr = [authMiddleware, roleMiddleware("ADMIN", "MANAGER")];

/* ────────────────────────────────────────────────────────────────
   SELF  —  /users/me/*
   Must be registered BEFORE  /:id  patterns
──────────────────────────────────────────────────────────────── */

router.get("/me", auth, getMe);
router.get("/me/attendance", auth, getMyAttendance); // GET  today's clock-in/out
router.get("/me/attendance/history", auth, getMyAttendanceHistory); // GET  last 30 days history
router.post("/me/clock-in", auth, selfClockIn); // POST self clock-in
router.post("/me/clock-out", auth, selfClockOut); // POST self clock-out

/* ────────────────────────────────────────────────────────────────
   LIST / DROPDOWNS
──────────────────────────────────────────────────────────────── */

router.get("/", ...adminMgr, listUsers); // admin or manager — all users in scope
router.get("/employees", ...mgr, getEmployees); // active employees for lead dropdowns

/* ────────────────────────────────────────────────────────────────
   TEAM MANAGEMENT  —  /users/team-members/*
   All sub-resource paths registered BEFORE  /team-members/:id
──────────────────────────────────────────────────────────────── */

router.get("/team-members", ...mgr, getTeamMembers); // list with attendance
router.post("/team-members", ...mgr, createTeamMember); // create employee

router.patch("/team-members/:id/reset-password", ...mgr, resetMemberPassword); // reset password
router.patch("/team-members/:id/leave-status", ...mgr, setMemberLeaveStatus); // manual leave/active toggle
router.post("/team-members/:id/check-in", ...mgr, checkIn); // clock in on behalf
router.post("/team-members/:id/check-out", ...mgr, checkOut); // clock out on behalf

router.patch("/team-members/:id", ...mgr, updateTeamMember); // update name/email/role

/* ────────────────────────────────────────────────────────────────
   LEGACY
──────────────────────────────────────────────────────────────── */

router.patch("/:id/status", ...mgr, toggleUserStatus); // legacy status toggle

export default router;
