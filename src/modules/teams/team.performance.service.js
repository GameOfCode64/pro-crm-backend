import prisma from "../../config/db.js";

const getRangeStart = (range) => {
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

export const getEmployeePerformanceService = async (
  manager,
  employeeId,
  range
) => {
  if (!manager.teamId) throw new Error("Manager has no team");

  const employee = await prisma.user.findFirst({
    where: {
      id: employeeId,
      teamId: manager.teamId,
      role: "EMPLOYEE",
    },
  });

  if (!employee) throw new Error("Invalid employee");

  const fromDate = getRangeStart(range);

  // 📞 All CALL activities (raw)
  const calls = await prisma.leadActivity.findMany({
    where: {
      userId: employeeId,
      type: "CALL",
      createdAt: { gte: fromDate },
    },
    select: {
      id: true,
      leadId: true,
      createdAt: true,
      outcome: { select: { name: true } },
      outcomeReason: { select: { label: true } },
      remark: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // 🔁 Deduplicate → latest call per lead
  const latestCallMap = new Map();
  for (const call of calls) {
    const existing = latestCallMap.get(call.leadId);
    if (!existing || new Date(call.createdAt) > new Date(existing.createdAt)) {
      latestCallMap.set(call.leadId, call);
    }
  }
  const latestCalls = Array.from(latestCallMap.values());

  // 📊 Outcome summary (deduped)
  const byOutcome = {};
  latestCalls.forEach((c) => {
    const name = c.outcome?.name ?? "UNKNOWN";
    byOutcome[name] = (byOutcome[name] || 0) + 1;
  });

  // 🧠 Assigned leads
  const assignedLeads = await prisma.lead.count({
    where: { assignedToId: employeeId },
  });

  // 📊 Completion
  const leadsCalled = latestCalls.length;
  const taskCompletion =
    assignedLeads === 0 ? 0 : Math.round((leadsCalled / assignedLeads) * 100);

  // 📅 Attendance (unique days)
  const uniqueDays = new Set(
    calls.map((c) => c.createdAt.toISOString().slice(0, 10))
  );

  const totalDays =
    range === "today"
      ? 1
      : range === "week"
      ? 7
      : new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          0
        ).getDate();

  const attendancePercentage = Math.round((uniqueDays.size / totalDays) * 100);

  return {
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
    },

    assignedLeads,
    callsMade: calls.length, // raw activity
    leadsCalled, // unique leads
    taskCompletion,
    attendancePercentage,

    byOutcome, // deduped
    activities: latestCalls, // deduped history
  };
};

/**
 * TEAM-LEVEL ANALYTICS
 */
export const getTeamAnalyticsService = async (manager, teamId) => {
  if (manager.teamId !== teamId) {
    throw new Error("Access denied");
  }

  const unassignedLeads = await prisma.lead.count({
    where: {
      teamId,
      assignedToId: null,
    },
  });

  const totalLeads = await prisma.lead.count({ where: { teamId } });

  return {
    totalLeads,
    unassignedLeads,
  };
};
