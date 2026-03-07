import prisma from "../../config/db.js";
import * as service from "./user.service.js";

const handleErr = (err, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  next(err);
};

/* ────────────────────────────────────────────────────────────────
   EXISTING
──────────────────────────────────────────────────────────────── */

/** GET /users/me */
export const getMe = async (req, res, next) => {
  try {
    res.json(await service.getMe(req.user.id));
  } catch (err) {
    next(err);
  }
};

/** GET /users — admin/manager list */
export const listUsers = async (req, res, next) => {
  try {
    res.json(await service.listUsers(req.user));
  } catch (err) {
    handleErr(err, res, next);
  }
};

/** GET /users/employees — active employees for lead-assignment dropdowns */
export const getEmployees = async (req, res, next) => {
  try {
    const employees = await prisma.user.findMany({
      where: { teamId: req.user.teamId, role: "EMPLOYEE", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, teamId: true },
    });
    res.json(employees);
  } catch (err) {
    next(err);
  }
};

/** PATCH /users/:id/status — legacy toggle */
export const toggleUserStatus = async (req, res, next) => {
  try {
    res.json(await service.toggleUserStatus(req.params.id));
  } catch (err) {
    handleErr(err, res, next);
  }
};

/* ────────────────────────────────────────────────────────────────
   TEAM MANAGEMENT  — /users/team-members/*
──────────────────────────────────────────────────────────────── */

/** GET /users/team-members */
export const getTeamMembers = async (req, res, next) => {
  try {
    res.json(await service.getTeamMembers({ teamId: req.user.teamId }));
  } catch (err) {
    next(err);
  }
};

/** POST /users/team-members */
export const createTeamMember = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const member = await service.createTeamMember({
      teamId: req.user.teamId,
      name,
      email,
      password,
      role,
    });
    res.status(201).json(member);
  } catch (err) {
    handleErr(err, res, next);
  }
};

/** PATCH /users/team-members/:id */
export const updateTeamMember = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    res.json(
      await service.updateTeamMember({
        id: req.params.id,
        teamId: req.user.teamId,
        name,
        email,
        role,
      }),
    );
  } catch (err) {
    handleErr(err, res, next);
  }
};

/** PATCH /users/team-members/:id/reset-password */
export const resetMemberPassword = async (req, res, next) => {
  try {
    res.json(
      await service.resetMemberPassword({
        id: req.params.id,
        teamId: req.user.teamId,
        password: req.body.password,
      }),
    );
  } catch (err) {
    handleErr(err, res, next);
  }
};

/** PATCH /users/team-members/:id/leave-status  — body: { isActive: boolean } */
export const setMemberLeaveStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean")
      return res.status(400).json({ error: "isActive (boolean) is required" });

    res.json(
      await service.setMemberLeaveStatus({
        id: req.params.id,
        teamId: req.user.teamId,
        isActive,
      }),
    );
  } catch (err) {
    handleErr(err, res, next);
  }
};

/** POST /users/team-members/:id/check-in  — manager clocks in on behalf */
export const checkIn = async (req, res, next) => {
  try {
    res.json(
      await service.checkIn({
        userId: req.params.id,
        teamId: req.user.teamId,
      }),
    );
  } catch (err) {
    handleErr(err, res, next);
  }
};

/** POST /users/team-members/:id/check-out  — manager clocks out on behalf */
export const checkOut = async (req, res, next) => {
  try {
    res.json(
      await service.checkOut({
        userId: req.params.id,
        teamId: req.user.teamId,
      }),
    );
  } catch (err) {
    handleErr(err, res, next);
  }
};

/* ────────────────────────────────────────────────────────────────
   SELF-SERVICE ATTENDANCE  — /users/me/*
──────────────────────────────────────────────────────────────── */

/** GET /users/me/attendance */
export const getMyAttendance = async (req, res) => {
  try {
    res.json(await service.getMyAttendance(req.user.id));
  } catch (e) {
    console.error("[getMyAttendance]", e);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
};

/** GET /users/me/attendance/history — last 30 days */
export const getMyAttendanceHistory = async (req, res) => {
  try {
    res.json(await service.getMyAttendanceHistory(req.user.id));
  } catch (e) {
    console.error("[getMyAttendanceHistory]", e);
    res.status(500).json({ error: "Failed to fetch attendance history" });
  }
};

/** POST /users/me/clock-in */
export const selfClockIn = async (req, res) => {
  try {
    res.json(
      await service.checkIn({ userId: req.user.id, teamId: req.user.teamId }),
    );
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? "Failed to clock in" });
  }
};

/** POST /users/me/clock-out */
export const selfClockOut = async (req, res) => {
  try {
    res.json(
      await service.checkOut({ userId: req.user.id, teamId: req.user.teamId }),
    );
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? "Failed to clock out" });
  }
};
