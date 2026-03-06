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

export const getMyCallingReportService = async ({
  userId,
  teamId,
  from,
  to,
  period = "DAY",
}) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  /* ── 1. All CALL activities by this user in range ── */
  const activities = await prisma.leadActivity.findMany({
    where: {
      userId,
      type: "CALL",
      createdAt: { gte: fromDate, lte: toDate },
      lead: { teamId }, // security: only own team's leads
    },
    include: {
      lead: {
        include: {
          assignedTo: { select: { id: true, name: true } },
          campaign: { select: { id: true, name: true } },
        },
      },
      outcome: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  /* ── 2. Aggregate totals ── */
  const totalCalls = activities.length;
  const totalDuration = activities.reduce((sum, a) => {
    // duration stored as "2m 30s" or seconds integer — handle both
    if (!a.duration) return sum;
    if (typeof a.duration === "number") return sum + a.duration;
    // parse "Xm Ys" format
    const mMatch = String(a.duration).match(/(\d+)m/);
    const sMatch = String(a.duration).match(/(\d+)s/);
    return (
      sum +
      (mMatch ? parseInt(mMatch[1]) * 60 : 0) +
      (sMatch ? parseInt(sMatch[1]) : 0)
    );
  }, 0);

  // Sales = sum of contractAmount from lead meta (if present)
  const seenLeadIds = new Set();
  let totalSales = 0;
  for (const a of activities) {
    if (!seenLeadIds.has(a.leadId) && a.lead?.meta?.contractAmount) {
      const amount = parseFloat(
        String(a.lead.meta.contractAmount).replace(/[^\d.]/g, ""),
      );
      if (!isNaN(amount)) totalSales += amount;
      seenLeadIds.add(a.leadId);
    }
  }

  /* ── 3. Chart data — bucket by period ── */
  const chartData = buildChartBuckets(activities, fromDate, toDate, period);

  /* ── 4. Unique leads (most recent activity first) ── */
  const leadMap = new Map();
  for (const a of activities) {
    if (!leadMap.has(a.leadId)) {
      leadMap.set(a.leadId, a.lead);
    }
  }
  const leads = Array.from(leadMap.values());

  return { totalCalls, totalDuration, totalSales, chartData, leads };
};

/* ── Chart bucket builder ── */
function buildChartBuckets(activities, from, to, period) {
  if (period === "DAY") {
    // Bucket by hour  → "12 AM", "02 AM" … "10 PM"
    const hours = {};
    for (let h = 0; h < 24; h += 2) {
      const label = formatHourLabel(h);
      hours[label] = 0;
    }
    for (const a of activities) {
      const h = new Date(a.createdAt).getHours();
      const bucket = Math.floor(h / 2) * 2;
      const label = formatHourLabel(bucket);
      if (label in hours) hours[label]++;
    }
    return Object.entries(hours).map(([label, calls]) => ({ label, calls }));
  }

  if (period === "WEEK") {
    // Bucket by day of week
    const days = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const a of activities) {
      const d = dayNames[new Date(a.createdAt).getDay()];
      if (d in days) days[d]++;
    }
    return Object.entries(days).map(([label, calls]) => ({ label, calls }));
  }

  if (period === "MONTH") {
    // Bucket by week-of-month  → "W1" … "W5"
    const weeks = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0 };
    for (const a of activities) {
      const day = new Date(a.createdAt).getDate();
      const week = `W${Math.ceil(day / 7)}`;
      if (week in weeks) weeks[week]++;
    }
    return Object.entries(weeks).map(([label, calls]) => ({ label, calls }));
  }

  if (period === "YEAR") {
    // Bucket by month
    const months = {
      Jan: 0,
      Feb: 0,
      Mar: 0,
      Apr: 0,
      May: 0,
      Jun: 0,
      Jul: 0,
      Aug: 0,
      Sep: 0,
      Oct: 0,
      Nov: 0,
      Dec: 0,
    };
    const monthNames = Object.keys(months);
    for (const a of activities) {
      const m = monthNames[new Date(a.createdAt).getMonth()];
      months[m]++;
    }
    return Object.entries(months).map(([label, calls]) => ({ label, calls }));
  }

  return [];
}

function formatHourLabel(h) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${String(h).padStart(2, "0")} AM`;
  if (h === 12) return "12 PM";
  return `${String(h - 12).padStart(2, "0")} PM`;
}
