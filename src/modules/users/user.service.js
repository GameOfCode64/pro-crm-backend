import prisma from "../../config/db.js";
import { ROLES } from "../auth/auth.constants.js";

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
  // ADMIN → all users
  if (requester.role === ROLES.ADMIN) {
    return prisma.user.findMany({
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

  // MANAGER → only team users
  if (requester.role === ROLES.MANAGER) {
    return prisma.user.findMany({
      where: { teamId: requester.teamId },
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

  throw new Error("Access denied");
};

export const toggleUserStatus = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

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
