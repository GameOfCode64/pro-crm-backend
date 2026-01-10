import prisma from "../../config/db.js";

/**
 * LEAD REPORT
 */
export const leadReport = async (teamId, { from, to }) => {
  const leads = await prisma.lead.findMany({
    where: {
      teamId,
      createdAt: { gte: from, lte: to },
    },
    include: {
      assignedTo: { select: { name: true } },
    },
  });

  return leads.map((l) => ({
    companyName: l.companyName,
    personName: l.personName,
    phone: l.phone,
    status: l.status,
    assignedTo: l.assignedTo.name,
    createdAt: l.createdAt,
  }));
};

/**
 * EMPLOYEE PRODUCTIVITY REPORT
 */
export const employeeReport = async (teamId, { from, to }) => {
  const activities = await prisma.leadActivity.groupBy({
    by: ["userId", "callOutcome"],
    where: {
      lead: { teamId },
      createdAt: { gte: from, lte: to },
      type: "CALL",
    },
    _count: { id: true },
  });

  return activities;
};

/**
 * FOLLOW-UP REPORT
 */
export const followUpReport = async (teamId) => {
  const now = new Date();

  const leads = await prisma.lead.findMany({
    where: {
      teamId,
      followUpAt: { not: null },
    },
    include: {
      assignedTo: { select: { name: true } },
    },
  });

  return leads.map((l) => ({
    lead: l.companyName,
    assignedTo: l.assignedTo.name,
    followUpAt: l.followUpAt,
    status: l.followUpAt < now ? "OVERDUE" : "UPCOMING",
  }));
};
