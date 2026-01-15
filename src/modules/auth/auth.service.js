import bcrypt from "bcryptjs";

import prisma from "../../config/db.js";
import { signToken } from "../../utils/jwt.js";
import { ROLES, LOGIN_SECURITY } from "./auth.constants.js";

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Generic error (no info leak)
  if (!user) throw new Error("Invalid credentials");

  if (!user.isActive) {
    throw new Error("Account disabled. Contact admin.");
  }

  // 🔒 Check lock
  if (user.lockUntil && new Date() < user.lockUntil) {
    throw new Error("Account locked. Try again later.");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const failedCount = user.failedLoginCount + 1;

    const updateData = {
      failedLoginCount: failedCount,
    };

    if (failedCount >= LOGIN_SECURITY.MAX_ATTEMPTS) {
      const lockUntil = new Date();
      lockUntil.setMinutes(
        lockUntil.getMinutes() + LOGIN_SECURITY.LOCK_TIME_MINUTES
      );

      updateData.lockUntil = lockUntil;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    throw new Error("Invalid credentials");
  }

  // ✅ Reset counters on success
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockUntil: null,
    },
  });

  const token = signToken({
    id: user.id,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

export const createUser = async (creator, payload) => {
  const { name, email, password, role } = payload;

  // 🔒 Role enforcement
  if (creator.role === ROLES.MANAGER && role !== ROLES.EMPLOYEE) {
    throw new Error("Manager can only create employees");
  }

  if (creator.role === ROLES.ADMIN && !Object.values(ROLES).includes(role)) {
    throw new Error("Invalid role");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("User already exists");

  const hashedPassword = await bcrypt.hash(password, 12);

  return prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,

      // ✅ FIX: use relation instead of teamId
      team:
        creator.role === ROLES.MANAGER
          ? { connect: { id: creator.teamId } }
          : teamId
          ? { connect: { id: teamId } }
          : undefined,

      managerId: creator.role === ROLES.MANAGER ? creator.id : null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
};
