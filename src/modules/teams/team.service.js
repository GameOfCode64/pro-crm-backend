import prisma from "../../config/db.js";
import { ROLES } from "../auth/auth.constants.js";

export const createTeam = async ({ name, managerId }) => {
  if (!name) throw new Error("Team name is required");
  if (!managerId) throw new Error("Manager ID is required");

  const manager = await prisma.user.findUnique({
    where: { id: managerId },
  });

  if (!manager || manager.role !== ROLES.MANAGER) {
    throw new Error("Invalid manager");
  }

  const team = await prisma.team.create({
    data: {
      name,
      managerId,
    },
  });

  // Attach manager to team
  await prisma.user.update({
    where: { id: managerId },
    data: { teamId: team.id },
  });

  return team;
};

export const listTeams = async (requester) => {
  // ADMIN → all teams
  if (requester.role === ROLES.ADMIN) {
    return prisma.team.findMany({
      include: {
        users: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  // MANAGER → only own team
  if (requester.role === ROLES.MANAGER) {
    return prisma.team.findMany({
      where: { id: requester.teamId },
      include: {
        users: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  throw new Error("Access denied");
};

export const getTeamById = async (requester, teamId) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!team) throw new Error("Team not found");

  if (requester.role === ROLES.MANAGER && requester.teamId !== teamId) {
    throw new Error("Access denied");
  }

  return team;
};
