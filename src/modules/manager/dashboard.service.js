import prisma from "../../config/db.js";

const getRangeStart = (range) => {
  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (range === "week") {
    now.setDate(now.getDate() - 6);
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
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
