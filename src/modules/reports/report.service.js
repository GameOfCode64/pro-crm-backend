import prisma from "../../config/db.js";

const getDateRange = (from, to) => {
  const dates = [];
  let current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const getAttendanceData = async ({ manager, from, to, employeeIds }) => {
  if (!manager.teamId) {
    throw new Error("Manager has no team");
  }

  const employees = await prisma.user.findMany({
    where: {
      teamId: manager.teamId,
      role: "EMPLOYEE",
      ...(employeeIds.length ? { id: { in: employeeIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const dates = getDateRange(from, to);

  const calls = await prisma.leadActivity.findMany({
    where: {
      type: "CALL",
      userId: { in: employees.map((e) => e.id) },
      createdAt: {
        gte: new Date(from),
        lte: new Date(to + "T23:59:59.999Z"),
      },
    },
    select: {
      userId: true,
      createdAt: true,
    },
  });

  const callMap = {};
  for (const c of calls) {
    const day = new Date(c.createdAt).toDateString();
    const key = `${c.userId}_${day}`;
    callMap[key] = (callMap[key] || 0) + 1;
  }

  const rows = [];

  for (const emp of employees) {
    for (const d of dates) {
      const dayKey = d.toDateString();
      const key = `${emp.id}_${dayKey}`;
      const callsMade = callMap[key] || 0;

      rows.push({
        date: d.toISOString().split("T")[0],
        employeeName: emp.name,
        email: emp.email,
        present: callsMade > 0 ? "YES" : "NO",
        callsMade,
      });
    }
  }

  return rows;
};

export const getLeadsExportData = async ({
  manager,
  from,
  to,
  campaignId,
  statuses = [],
}) => {
  if (!manager.teamId) {
    throw new Error("Manager has no team");
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  /**
   * 🔥 Latest CALL per lead (NO DUPLICATES)
   */
  const latestCalls = await prisma.$queryRaw`
    SELECT DISTINCT ON ("leadId")
      la.id,
      la."leadId",
      la."createdAt",
      la."outcomeId",
      la."outcomeReasonId",
      la.remark,
      la."userId"
    FROM "LeadActivity" la
    WHERE la.type = 'CALL'
      AND la."createdAt" BETWEEN ${fromDate} AND ${toDate}
    ORDER BY la."leadId", la."createdAt" DESC
  `;

  if (!latestCalls.length) return [];

  const leadIds = latestCalls.map((c) => c.leadId);

  /**
   * 🔗 Fetch leads + relations with filters
   */
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      teamId: manager.teamId,
      ...(campaignId && campaignId !== "all" ? { campaignId } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
    },
    include: {
      assignedTo: {
        select: { name: true },
      },
      campaign: {
        select: { name: true },
      },
      formResponses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  /**
   * 🔁 Index leads by ID (fast lookup)
   */
  const leadMap = Object.fromEntries(leads.map((l) => [l.id, l]));

  /**
   * 🔁 Outcome lookup
   */
  const outcomes = await prisma.callOutcomeConfig.findMany({
    select: { id: true, name: true },
  });

  const outcomeMap = Object.fromEntries(outcomes.map((o) => [o.id, o.name]));

  /**
   * 🧹 Format export rows
   */
  return latestCalls
    .map((call) => {
      const lead = leadMap[call.leadId];
      if (!lead) return null;

      const outcomeName = outcomeMap[call.outcomeId] ?? "NO OUTCOME";

      return {
        leadName: lead.personName || "",
        phone: lead.phone || "",
        company: lead.companyName || "",
        campaign: lead.campaign?.name || "",
        assignedTo: lead.assignedTo?.name || "",
        status: lead.status || "",
        outcome: outcomeName,
        remark: call.remark ?? "",
        callDate: call.createdAt.toISOString().split("T")[0],
        form: lead.formResponses?.[0]?.values ?? {},
      };
    })
    .filter(Boolean);
};
