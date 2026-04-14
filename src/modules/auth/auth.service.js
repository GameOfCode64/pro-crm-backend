import bcrypt from "bcryptjs";
import prisma from "../../config/db.js";
import { signToken } from "../../utils/jwt.js";
import { ROLES, LOGIN_SECURITY } from "./auth.constants.js";

/* ────────────────────────────────────────────────────────────────
   LOGIN
   Accepts email OR username + password.
──────────────────────────────────────────────────────────────── */
export const login = async ({ email, username, password }) => {
  // Find user by email OR username — whichever was provided
  let user = null;

  if (email) {
    user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  } else if (username) {
    user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
  }

  // Generic error — never reveal whether email/username exists
  if (!user)
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });

  if (!user.isActive)
    throw Object.assign(new Error("Account disabled. Contact your admin."), {
      status: 403,
    });

  // Account lock check
  if (user.lockUntil && new Date() < user.lockUntil) {
    const remaining = Math.ceil((user.lockUntil - new Date()) / 60000);
    throw Object.assign(
      new Error(
        `Account locked. Try again in ${remaining} minute${remaining > 1 ? "s" : ""}.`,
      ),
      { status: 429 },
    );
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const failedCount = user.failedLoginCount + 1;
    const data = { failedLoginCount: failedCount };

    if (failedCount >= LOGIN_SECURITY.MAX_ATTEMPTS) {
      const lockUntil = new Date();
      lockUntil.setMinutes(
        lockUntil.getMinutes() + LOGIN_SECURITY.LOCK_TIME_MINUTES,
      );
      data.lockUntil = lockUntil;
    }

    await prisma.user.update({ where: { id: user.id }, data });
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  // Reset counters on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockUntil: null },
  });

  const token = signToken({ id: user.id, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username ?? null,
      email: user.email,
      role: user.role,
      teamId: user.teamId ?? null,
    },
  };
};

/* ────────────────────────────────────────────────────────────────
   CREATE USER
   Called by admin/manager from /auth/create endpoint.
   For team-member creation from the team management UI,
   use POST /users/team-members instead (which auto-resolves teamId).
──────────────────────────────────────────────────────────────── */
export const createUser = async (creator, payload) => {
  const { name, email, username, password, role } = payload;

  // Role enforcement
  if (creator.role === ROLES.MANAGER && role !== ROLES.EMPLOYEE)
    throw Object.assign(new Error("Manager can only create employees"), {
      status: 403,
    });

  if (creator.role === ROLES.ADMIN && !Object.values(ROLES).includes(role))
    throw Object.assign(new Error("Invalid role"), { status: 400 });

  // Email uniqueness
  const emailClash = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (emailClash)
    throw Object.assign(new Error("Email already in use"), { status: 409 });

  // Username uniqueness (if provided)
  if (username?.trim()) {
    const usernameClash = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    if (usernameClash)
      throw Object.assign(new Error("Username already taken"), { status: 409 });
  }

  // Resolve teamId — manager creates employees in their own team
  let teamId = null;

  if (creator.role === ROLES.MANAGER) {
    if (creator.teamId) {
      teamId = creator.teamId;
    } else {
      // Manager owns the team but may not have teamId on their User row
      const managed = await prisma.team.findUnique({
        where: { managerId: creator.id },
        select: { id: true },
      });
      if (!managed)
        throw Object.assign(
          new Error("Manager has no team. Create a team first."),
          { status: 400 },
        );
      teamId = managed.id;
    }
  }

  const hashed = await bcrypt.hash(password, 12);

  return prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      username: username?.trim() || null,
      password: hashed,
      role,
      isActive: true,
      ...(teamId && { teamId }),
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
};
