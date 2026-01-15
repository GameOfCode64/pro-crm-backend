import prisma from "../../config/db.js";

// utils/dateRange.ts
export const getRangeStart = (range) => {
  const now = new Date();

  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  }

  if (range === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  throw new Error("Invalid range");
};

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

export const getManagerDashboardService = async (manager, range) => {
  if (!manager.teamId) throw new Error("Manager has no team");

  const fromDate = getRangeStart(range);

  /**
   * 🔥 Latest call per lead (NO DUPLICATES)
   */
  const latestCalls = await prisma.$queryRaw`
    SELECT DISTINCT ON ("leadId")
      la."leadId",
      la."outcomeId",
      la."createdAt",
      la."userId"
    FROM "LeadActivity" la
    JOIN "Lead" l ON l.id = la."leadId"
    WHERE la.type = 'CALL'
      AND la."createdAt" >= ${fromDate}
      AND l."teamId" = ${manager.teamId}
    ORDER BY la."leadId", la."createdAt" DESC
  `;

  /**
   * KPI CALCULATIONS
   */
  const totalCalls = latestCalls.length;

  const outcomes = await prisma.callOutcomeConfig.findMany({
    select: { id: true, name: true },
  });

  const outcomeMap = Object.fromEntries(outcomes.map((o) => [o.id, o.name]));

  const byOutcome = {};
  latestCalls.forEach((c) => {
    const name = outcomeMap[c.outcomeId] ?? "UNKNOWN";
    byOutcome[name] = (byOutcome[name] || 0) + 1;
  });

  const totalLeads = await prisma.lead.count({
    where: { teamId: manager.teamId },
  });

  const followUps =
    byOutcome.CALL_LATER || 0 + byOutcome.CALL_BACK_SCHEDULED || 0;

  /**
   * 👥 Team performance
   */
  const employees = await prisma.user.findMany({
    where: { teamId: manager.teamId, role: "EMPLOYEE" },
    select: { id: true, name: true },
  });

  const teamPerformance = await Promise.all(
    employees.map(async (u) => {
      const assigned = await prisma.lead.count({
        where: { assignedToId: u.id },
      });

      const calls = latestCalls.filter((c) => c.userId === u.id).length;

      return {
        name: u.name,
        assigned,
        calls,
      };
    })
  );

  return {
    kpis: {
      totalLeads,
      totalCalls,
      interested: byOutcome.INTERESTED || 0,
      followUps,
    },
    byOutcome,
    teamPerformance,
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
