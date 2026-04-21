import prisma from "../../config/db.js";
import * as service from "./user.service.js";

const handleErr = (err, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  next(err);
};

/**
 * Resolve the team a manager controls.
 * Manager User.teamId is often NULL — they own the team via Team.managerId.
 */
const resolveTeamId = async (user) => {
  if (user.teamId) return user.teamId;
  const managed = await prisma.team.findUnique({
    where: { managerId: user.id },
    select: { id: true },
  });
  if (!managed)
    throw Object.assign(new Error("Manager has no team."), { status: 400 });
  return managed.id;
};

/* EXISTING */

export const getMe = async (req, res, next) => {
  try {
    res.json(await service.getMe(req.user.id));
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    res.json(await service.listUsers(req.user));
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const getEmployees = async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req.user);
    const employees = await prisma.user.findMany({
      where: { teamId, role: "EMPLOYEE", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, teamId: true },
    });
    res.json(employees);
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const toggleUserStatus = async (req, res, next) => {
  try {
    res.json(await service.toggleUserStatus(req.params.id));
  } catch (err) {
    handleErr(err, res, next);
  }
};

/* TEAM MANAGEMENT */

export const getTeamMembers = async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req.user);
    res.json(await service.getTeamMembers({ teamId }));
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const createTeamMember = async (req, res, next) => {
  try {
    const { name, email, username, password, role } = req.body;
    if (!name?.trim())
      return res.status(400).json({ error: "Name is required" });
    if (!email?.trim())
      return res.status(400).json({ error: "Email is required" });
    if (!password || password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });

    const teamId = await resolveTeamId(req.user);
    const member = await service.createTeamMember({
      teamId,
      name,
      email,
      username,
      password,
      role,
    });
    res.status(201).json(member);
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const updateTeamMember = async (req, res, next) => {
  try {
    const { name, email, username, role } = req.body;
    const teamId = await resolveTeamId(req.user);
    res.json(
      await service.updateTeamMember({
        id: req.params.id,
        teamId,
        name,
        email,
        username,
        role,
      }),
    );
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const resetMemberPassword = async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req.user);
    res.json(
      await service.resetMemberPassword({
        id: req.params.id,
        teamId,
        password: req.body.password,
      }),
    );
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const setMemberLeaveStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean")
      return res.status(400).json({ error: "isActive (boolean) is required" });
    const teamId = await resolveTeamId(req.user);
    res.json(
      await service.setMemberLeaveStatus({
        id: req.params.id,
        teamId,
        isActive,
      }),
    );
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const checkIn = async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req.user);
    res.json(await service.checkIn({ userId: req.params.id, teamId }));
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const checkOut = async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req.user);
    res.json(await service.checkOut({ userId: req.params.id, teamId }));
  } catch (err) {
    handleErr(err, res, next);
  }
};

/* SELF-SERVICE ATTENDANCE */

export const getMyAttendance = async (req, res) => {
  try {
    res.json(await service.getMyAttendance(req.user.id));
  } catch (e) {
    console.error("[getMyAttendance]", e);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
};

export const getMyAttendanceHistory = async (req, res) => {
  try {
    res.json(await service.getMyAttendanceHistory(req.user.id));
  } catch (e) {
    console.error("[getMyAttendanceHistory]", e);
    res.status(500).json({ error: "Failed to fetch attendance history" });
  }
};

export const selfClockIn = async (req, res) => {
  try {
    const teamId = await resolveTeamId(req.user).catch(() => req.user.teamId);
    res.json(await service.checkIn({ userId: req.user.id, teamId }));
  } catch (e) {
    res
      .status(e.status ?? 500)
      .json({ error: e.message ?? "Failed to clock in" });
  }
};

export const selfClockOut = async (req, res) => {
  try {
    const teamId = await resolveTeamId(req.user).catch(() => req.user.teamId);
    res.json(await service.checkOut({ userId: req.user.id, teamId }));
  } catch (e) {
    res
      .status(e.status ?? 500)
      .json({ error: e.message ?? "Failed to clock out" });
  }
};
