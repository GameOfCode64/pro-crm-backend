import prisma from "../../config/db.js";
import { ROLES } from "../auth/auth.constants.js";

export const createTeam = async ({ name, managerId }) => {
  if (!name) throw new Error("Team name is required");
  if (!managerId) throw new Error("Manager ID is required");

  const manager = await prisma.user.findUnique({ where: { id: managerId } });
  if (!manager || manager.role !== ROLES.MANAGER) {
    throw new Error("Invalid manager");
  }

  const team = await prisma.team.create({
    data: { name, managerId },
  });

  await prisma.user.update({
    where: { id: managerId },
    data: { teamId: team.id },
  });

  return team;
};

export const listTeams = async (requester) => {
  if (requester.role === ROLES.ADMIN) {
    return prisma.team.findMany();
  }

  if (requester.role === ROLES.MANAGER) {
    return prisma.team.findMany({
      where: { id: requester.teamId },
    });
  }

  throw new Error("Access denied");
};

export const getTeamById = async (requester, teamId) => {
  if (requester.role === ROLES.MANAGER && requester.teamId !== teamId) {
    throw new Error("Access denied");
  }

  return prisma.team.findUnique({
    where: { id: teamId },
    include: {
      users: {
        where: { role: ROLES.EMPLOYEE }, // ✅ exclude manager
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
    },
  });
};

export const addEmployeeToTeam = async (manager, teamId, employeeId) => {
  if (manager.teamId !== teamId) {
    throw new Error("You can only manage your own team");
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
  });

  if (!employee || employee.role !== ROLES.EMPLOYEE) {
    throw new Error("Invalid employee");
  }

  await prisma.user.update({
    where: { id: employeeId },
    data: { teamId },
  });

  return { message: "Employee added to team" };
};
