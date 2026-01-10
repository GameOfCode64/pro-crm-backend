import prisma from "../../config/db.js";

/**
 * TODAY SUMMARY
 */
export const getDashboardSummary = async (teamId) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [
    totalLeads,
    callsToday,
    interestedToday,
    wonToday,
    lostToday,
    followUpsToday,
  ] = await Promise.all([
    prisma.lead.count({ where: { teamId } }),

    prisma.leadActivity.count({
      where: {
        lead: { teamId },
        type: "CALL",
        createdAt: { gte: start, lte: end },
      },
    }),

    prisma.leadActivity.count({
      where: {
        lead: { teamId },
        callOutcome: "INTERESTED",
        createdAt: { gte: start, lte: end },
      },
    }),

    prisma.lead.count({
      where: {
        teamId,
        status: "WON",
        updatedAt: { gte: start, lte: end },
      },
    }),

    prisma.lead.count({
      where: {
        teamId,
        status: "LOST",
        updatedAt: { gte: start, lte: end },
      },
    }),

    prisma.lead.count({
      where: {
        teamId,
        followUpAt: { gte: start, lte: end },
      },
    }),
  ]);

  return {
    totalLeads,
    callsToday,
    interestedToday,
    wonToday,
    lostToday,
    followUpsToday,
  };
};

/**
 * PERFORMANCE OVERVIEW
 */
export const getPerformanceOverview = async (teamId) => {
  return prisma.leadActivity.groupBy({
    by: ["userId", "callOutcome"],
    where: {
      lead: { teamId },
      type: "CALL",
    },
    _count: { id: true },
  });
};

/**
 * FOLLOW-UP ALERTS
 */
export const getFollowUpAlerts = async (user) => {
  const now = new Date();

  const base =
    user.role === "MANAGER"
      ? { teamId: user.teamId }
      : { assignedToId: user.id };

  const [today, overdue] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ...base,
        followUpAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
    prisma.lead.findMany({
      where: {
        ...base,
        followUpAt: { lt: now },
        status: { notIn: ["WON", "LOST"] },
      },
    }),
  ]);

  return { today, overdue };
};
