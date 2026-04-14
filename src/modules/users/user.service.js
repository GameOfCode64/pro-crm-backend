import prisma from "../../config/db.js";
import bcrypt from "bcryptjs";
import { ROLES } from "../auth/auth.constants.js";

/* ────────────────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────────────────── */

const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const err = (msg, status) => Object.assign(new Error(msg), { status });

/* ────────────────────────────────────────────────────────────────
   EXISTING SERVICES
──────────────────────────────────────────────────────────────── */

export const getMe = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
};

export const listUsers = async (requester) => {
  if (requester.role === ROLES.ADMIN) {
    return prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  if (requester.role === ROLES.MANAGER) {
    return prisma.user.findMany({
      where: { teamId: requester.teamId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  throw err("Access denied", 403);
};

export const toggleUserStatus = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw err("User not found", 404);

  return prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
};

/* ────────────────────────────────────────────────────────────────
   TEAM MANAGEMENT
──────────────────────────────────────────────────────────────── */

/**
 * GET /users/team-members
 * All team members enriched with today's attendance state.
 * attendanceToday: "checked-in" | "checked-out" | null
 */
export const getTeamMembers = async ({ teamId }) => {
  const { start, end } = todayRange();

  const [users, todayAttendance] = await Promise.all([
    prisma.user.findMany({
      where: { teamId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { assignedLeads: true } },
      },
    }),
    prisma.attendance.findMany({
      where: {
        user: { teamId },
        date: { gte: start, lte: end },
      },
      select: {
        userId: true,
        clockIn: true,
        clockOut: true,
      },
    }),
  ]);

  const attMap = new Map(todayAttendance.map((a) => [a.userId, a]));

  return users.map((u) => {
    const att = attMap.get(u.id) ?? null;
    const checkedIn = !!att?.clockIn;
    const checkedOut = !!att?.clockOut;

    return {
      ...u,
      attendanceToday: checkedIn
        ? checkedOut
          ? "checked-out"
          : "checked-in"
        : null,
      checkIn: att?.clockIn ?? null,
      checkOut: att?.clockOut ?? null,
    };
  });
};

/**
 * POST /users/team-members
 * Create a new employee inside the manager's team.
 */
export const createTeamMember = async ({
  teamId,
  name,
  email,
  username,
  password,
  role = "EMPLOYEE",
}) => {
  if (!name?.trim()) throw err("Name is required", 400);
  if (!email?.trim()) throw err("Email is required", 400);
  if (!password || password.length < 6)
    throw err("Password must be at least 6 characters", 400);

  // Email uniqueness
  const emailClash = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (emailClash) throw err("Email already in use", 409);

  // Username uniqueness (if provided)
  if (username?.trim()) {
    const userClash = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    if (userClash) throw err("Username already taken", 409);
  }

  return prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      username: username?.trim() || null,
      password: await bcrypt.hash(password, 12),
      role,
      teamId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
};

/**
 * PATCH /users/team-members/:id
 * Update name / email / role (no phone — not in schema).
 */
export const updateTeamMember = async ({ id, teamId, name, email, role }) => {
  const target = await prisma.user.findFirst({ where: { id, teamId } });
  if (!target) throw err("User not found", 404);

  if (email && email.toLowerCase() !== target.email) {
    const clash = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (clash) throw err("Email already in use", 409);
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(email !== undefined && { email: email.toLowerCase().trim() }),
      ...(role !== undefined && { role }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
};

/**
 * PATCH /users/team-members/:id/reset-password
 */
export const resetMemberPassword = async ({ id, teamId, password }) => {
  const target = await prisma.user.findFirst({ where: { id, teamId } });
  if (!target) throw err("User not found", 404);
  if (!password || password.length < 6)
    throw err("Password must be at least 6 characters", 400);

  await prisma.user.update({
    where: { id },
    data: { password: await bcrypt.hash(password, 12) },
  });
  return { success: true };
};

/**
 * PATCH /users/team-members/:id/leave-status
 * Manager manually marks a member active/on-leave.
 * Independent of attendance clock-in/out.
 */
export const setMemberLeaveStatus = async ({ id, teamId, isActive }) => {
  const target = await prisma.user.findFirst({ where: { id, teamId } });
  if (!target) throw err("User not found", 404);

  return prisma.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
};

/* ────────────────────────────────────────────────────────────────
   ATTENDANCE  (shared by self-service + manager-on-behalf)
──────────────────────────────────────────────────────────────── */

/**
 * GET /users/me/attendance
 * Today's attendance record for the calling user.
 */
export const getMyAttendance = async (userId) => {
  const { start } = todayRange();
  const record = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: start } },
    select: { id: true, clockIn: true, clockOut: true, date: true },
  });
  return record ?? { clockIn: null, clockOut: null };
};

/**
 * GET /users/me/attendance/history
 * Last 30 days of attendance records for the calling user.
 */
export const getMyAttendanceHistory = async (userId) => {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);

  return prisma.attendance.findMany({
    where: { userId, date: { gte: from } },
    orderBy: { date: "desc" },
    select: { id: true, date: true, clockIn: true, clockOut: true },
  });
};

/**
 * Clock in — creates/upserts today's Attendance record.
 * Sets user.isActive = true.
 * Used by:
 *   POST /users/me/clock-in           (self-service)
 *   POST /users/team-members/:id/check-in  (manager on behalf)
 */
export const checkIn = async ({ userId, teamId }) => {
  const target = await prisma.user.findFirst({ where: { id: userId, teamId } });
  if (!target) throw err("User not found", 404);

  const { start } = todayRange();

  const [attendance] = await Promise.all([
    prisma.attendance.upsert({
      where: { userId_date: { userId, date: start } },
      update: { clockIn: new Date(), clockOut: null },
      create: { userId, date: start, clockIn: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    }),
  ]);

  return attendance;
};

/**
 * Clock out — updates today's Attendance record.
 * Sets user.isActive = false.
 * Used by:
 *   POST /users/me/clock-out               (self-service)
 *   POST /users/team-members/:id/check-out (manager on behalf)
 */
export const checkOut = async ({ userId, teamId }) => {
  const target = await prisma.user.findFirst({ where: { id: userId, teamId } });
  if (!target) throw err("User not found", 404);

  const { start } = todayRange();

  // clockIn is NOT NULL in schema — fetch existing or fall back to now()
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: start } },
    select: { clockIn: true },
  });

  const [attendance] = await Promise.all([
    prisma.attendance.upsert({
      where: { userId_date: { userId, date: start } },
      update: { clockOut: new Date() },
      create: {
        userId,
        date: start,
        clockIn: existing?.clockIn ?? new Date(),
        clockOut: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    }),
  ]);

  return attendance;
};
