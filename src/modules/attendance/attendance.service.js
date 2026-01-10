import prisma from "../../config/db.js";

/**
 * Clock-in (only once per day)
 */
export const clockIn = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (existing) {
    throw new Error("Already clocked in for today");
  }

  return prisma.attendance.create({
    data: {
      userId,
      date: today,
      clockIn: new Date(),
    },
  });
};

/**
 * Clock-out (only if clocked-in)
 */
export const clockOut = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (!attendance) {
    throw new Error("You have not clocked in today");
  }

  if (attendance.clockOut) {
    throw new Error("Already clocked out");
  }

  return prisma.attendance.update({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    data: {
      clockOut: new Date(),
    },
  });
};

/**
 * Employee attendance history
 */
export const myAttendance = async (userId) => {
  return prisma.attendance.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });
};

/**
 * Manager → team attendance
 */
export const teamAttendance = async (manager) => {
  if (!manager.teamId) {
    throw new Error("Manager is not assigned to a team");
  }

  return prisma.attendance.findMany({
    where: {
      user: {
        teamId: manager.teamId,
      },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { date: "desc" },
  });
};
