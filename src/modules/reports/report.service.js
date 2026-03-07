import prisma from "../../config/db.js";

/* ════════════════════════════════════════════════════════════════
   SHARED HELPERS
   ════════════════════════════════════════════════════════════════ */

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

/** ISO date → "YYYY-MM-DD" string key */
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/** Parse "2m 30s" OR raw seconds integer → total seconds */
const parseDuration = (raw) => {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  const s = String(raw);
  const m = s.match(/(\d+)m/);
  const sec = s.match(/(\d+)s/);
  return (m ? parseInt(m[1]) * 60 : 0) + (sec ? parseInt(sec[1]) : 0);
};

function formatHourLabel(h) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${String(h).padStart(2, "0")} AM`;
  if (h === 12) return "12 PM";
  return `${String(h - 12).padStart(2, "0")} PM`;
}

function buildChartBuckets(activities, period) {
  if (period === "DAY") {
    const hours = {};
    for (let h = 0; h < 24; h += 2) hours[formatHourLabel(h)] = 0;
    for (const a of activities) {
      const h = new Date(a.createdAt).getHours();
      const label = formatHourLabel(Math.floor(h / 2) * 2);
      if (label in hours) hours[label]++;
    }
    return Object.entries(hours).map(([label, calls]) => ({ label, calls }));
  }

  if (period === "WEEK") {
    const days = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const a of activities) {
      const d = dayNames[new Date(a.createdAt).getDay()];
      if (d in days) days[d]++;
    }
    return Object.entries(days).map(([label, calls]) => ({ label, calls }));
  }

  if (period === "MONTH") {
    const weeks = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0 };
    for (const a of activities) {
      const day = new Date(a.createdAt).getDate();
      const week = `W${Math.ceil(day / 7)}`;
      if (week in weeks) weeks[week]++;
    }
    return Object.entries(weeks).map(([label, calls]) => ({ label, calls }));
  }

  if (period === "YEAR") {
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
    const monthKeys = Object.keys(months);
    for (const a of activities) {
      months[monthKeys[new Date(a.createdAt).getMonth()]]++;
    }
    return Object.entries(months).map(([label, calls]) => ({ label, calls }));
  }

  return [];
}

/* ════════════════════════════════════════════════════════════════
   ATTENDANCE DATA  (used by xlsx export)
   ════════════════════════════════════════════════════════════════ */

export const getAttendanceData = async ({ manager, from, to, employeeIds }) => {
  if (!manager.teamId) throw new Error("Manager has no team");

  const employees = await prisma.user.findMany({
    where: {
      teamId: manager.teamId,
      role: "EMPLOYEE",
      ...(employeeIds.length ? { id: { in: employeeIds } } : {}),
    },
    select: { id: true, name: true, email: true },
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
    select: { userId: true, createdAt: true },
  });

  const callMap = {};
  for (const c of calls) {
    const key = `${c.userId}_${new Date(c.createdAt).toDateString()}`;
    callMap[key] = (callMap[key] || 0) + 1;
  }

  const rows = [];
  for (const emp of employees) {
    for (const d of dates) {
      const key = `${emp.id}_${d.toDateString()}`;
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

/* ════════════════════════════════════════════════════════════════
   LEADS EXPORT DATA  (used by xlsx export)
   ════════════════════════════════════════════════════════════════ */

export const getLeadsExportData = async ({
  manager,
  from,
  to,
  campaignId,
  statuses = [],
}) => {
  if (!manager.teamId) throw new Error("Manager has no team");

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

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

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      teamId: manager.teamId,
      ...(campaignId && campaignId !== "all" ? { campaignId } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
    },
    include: {
      assignedTo: { select: { name: true } },
      campaign: { select: { name: true } },
      formResponses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const leadMap = Object.fromEntries(leads.map((l) => [l.id, l]));
  const outcomes = await prisma.callOutcomeConfig.findMany({
    select: { id: true, name: true },
  });
  const outcomeMap = Object.fromEntries(outcomes.map((o) => [o.id, o.name]));

  return latestCalls
    .map((call) => {
      const lead = leadMap[call.leadId];
      if (!lead) return null;
      return {
        leadName: lead.personName || "",
        phone: lead.phone || "",
        company: lead.companyName || "",
        campaign: lead.campaign?.name || "",
        assignedTo: lead.assignedTo?.name || "",
        status: lead.status || "",
        outcome: outcomeMap[call.outcomeId] ?? "NO OUTCOME",
        remark: call.remark ?? "",
        callDate: call.createdAt.toISOString().split("T")[0],
        form: lead.formResponses?.[0]?.values ?? {},
      };
    })
    .filter(Boolean);
};

/* ════════════════════════════════════════════════════════════════
   MY CALLING REPORT  (employee — own calls)
   ════════════════════════════════════════════════════════════════ */

export const getMyCallingReportService = async ({
  userId,
  teamId,
  from,
  to,
  period = "DAY",
}) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const activities = await prisma.leadActivity.findMany({
    where: {
      userId,
      type: "CALL",
      createdAt: { gte: fromDate, lte: toDate },
      lead: { teamId },
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

  const totalCalls = activities.length;
  const totalDuration = activities.reduce(
    (sum, a) => sum + parseDuration(a.duration),
    0,
  );

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

  const chartData = buildChartBuckets(activities, period);

  const leadMap = new Map();
  for (const a of activities) {
    if (!leadMap.has(a.leadId)) leadMap.set(a.leadId, a.lead);
  }

  return {
    totalCalls,
    totalDuration,
    totalSales,
    chartData,
    leads: Array.from(leadMap.values()),
  };
};

/* ════════════════════════════════════════════════════════════════
   TEAM CALLING REPORT  (manager — all / one employee's calls)
   ════════════════════════════════════════════════════════════════ */

export const getTeamCallingReportService = async ({
  teamId,
  employeeId,
  from,
  to,
  period = "DAY",
}) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const where = {
    type: "CALL",
    createdAt: { gte: fromDate, lte: toDate },
    lead: { teamId },
  };
  if (employeeId) where.userId = employeeId;

  const activities = await prisma.leadActivity.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
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

  const totalCalls = activities.length;
  const totalDuration = activities.reduce(
    (sum, a) => sum + parseDuration(a.duration),
    0,
  );

  const seenLeads = new Set();
  let totalSales = 0;
  for (const a of activities) {
    if (!seenLeads.has(a.leadId) && a.lead?.meta?.contractAmount) {
      const amt = parseFloat(
        String(a.lead.meta.contractAmount).replace(/[^\d.]/g, ""),
      );
      if (!isNaN(amt)) totalSales += amt;
      seenLeads.add(a.leadId);
    }
  }

  /* Per-employee breakdown */
  const employeeMap = new Map();
  for (const a of activities) {
    if (!a.user) continue;
    if (!employeeMap.has(a.userId)) {
      employeeMap.set(a.userId, {
        id: a.userId,
        name: a.user.name,
        calls: 0,
        duration: 0,
      });
    }
    const entry = employeeMap.get(a.userId);
    entry.calls++;
    entry.duration += parseDuration(a.duration);
  }

  const chartData = buildChartBuckets(activities, period);

  const leadMap = new Map();
  for (const a of activities) {
    if (!leadMap.has(a.leadId)) {
      leadMap.set(a.leadId, {
        ...a.lead,
        callCount: 0,
        lastCalledAt: a.createdAt,
      });
    }
    leadMap.get(a.leadId).callCount++;
  }

  return {
    totalCalls,
    totalDuration,
    totalSales,
    chartData,
    employeeBreakdown: Array.from(employeeMap.values()),
    leads: Array.from(leadMap.values()),
  };
};

/* ════════════════════════════════════════════════════════════════
   TEAM CALLING REPORT  —  CSV EXPORT
   ════════════════════════════════════════════════════════════════ */

export const getTeamCallingReportCsvService = async ({
  teamId,
  employeeId,
  from,
  to,
  period,
}) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const where = {
    type: "CALL",
    createdAt: { gte: fromDate, lte: toDate },
    lead: { teamId },
  };
  if (employeeId) where.userId = employeeId;

  const activities = await prisma.leadActivity.findMany({
    where,
    include: {
      user: { select: { name: true } },
      lead: {
        include: {
          assignedTo: { select: { name: true } },
          campaign: { select: { name: true } },
        },
      },
      outcome: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const headers = [
    "Date",
    "Time",
    "Employee",
    "Lead Name",
    "Phone",
    "Lead Status",
    "Campaign",
    "Outcome",
    "Duration (s)",
    "Remark",
  ];

  const rows = activities.map((a) => {
    const dt = new Date(a.createdAt);
    return [
      escape(dt.toLocaleDateString("en-IN")),
      escape(
        dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      ),
      escape(a.user?.name),
      escape(a.lead?.personName || a.lead?.companyName),
      escape(a.lead?.phone),
      escape(a.lead?.status),
      escape(a.lead?.campaign?.name),
      escape(a.outcome?.name),
      escape(parseDuration(a.duration)),
      escape(a.remark),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
};

/* ════════════════════════════════════════════════════════════════
   ATTENDANCE SERVICE  (manager calendar grid)
   ════════════════════════════════════════════════════════════════ */

export const getAttendanceService = async ({
  teamId,
  employeeId,
  from,
  to,
}) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const userWhere = { teamId, role: "EMPLOYEE" };
  if (employeeId) userWhere.id = employeeId;

  const employees = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (employees.length === 0) return { employees: [], summary: {} };

  const records = await prisma.attendance.findMany({
    where: {
      userId: { in: employees.map((e) => e.id) },
      date: { gte: fromDate, lte: toDate },
    },
    select: {
      userId: true,
      date: true,
      clockIn: true, // ✅ renamed from checkIn
      clockOut: true, // ✅ renamed from checkOut
      // ❌ removed: status, note (don't exist in schema)
    },
  });

  // Derive status from clockIn/clockOut since there's no status field
  const deriveStatus = (record) => {
    if (!record.clockIn) return "ABSENT";

    const clockIn = new Date(record.clockIn);
    const hours = clockIn.getHours();
    const minutes = clockIn.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Define your late threshold — e.g. 9:30 AM = 570 minutes
    const lateThreshold = 9 * 60 + 30;
    // Define half-day threshold — e.g. after 12:00 PM = 720 minutes
    const halfDayThreshold = 12 * 60;

    if (totalMinutes >= halfDayThreshold) return "HALF_DAY";
    if (totalMinutes > lateThreshold) return "LATE";
    return "PRESENT";
  };

  /* Group by userId → { "YYYY-MM-DD": status } */
  const recordsByUser = new Map();
  for (const r of records) {
    if (!recordsByUser.has(r.userId)) recordsByUser.set(r.userId, {});
    const status = deriveStatus(r);
    recordsByUser.get(r.userId)[dayKey(r.date)] = status;
  }

  /* Working days Mon–Fri */
  const workingDays = [];
  const cur = new Date(fromDate);
  while (cur <= toDate) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) workingDays.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  const totalWorkingDays = workingDays.length;

  const employeeRows = employees.map((emp) => {
    const dayRecords = recordsByUser.get(emp.id) ?? {};
    let present = 0,
      absent = 0,
      late = 0,
      halfDay = 0,
      holiday = 0;

    for (const d of workingDays) {
      const s = dayRecords[d];
      if (!s || s === "ABSENT") absent++;
      else if (s === "PRESENT") present++;
      else if (s === "LATE") {
        present++;
        late++;
      } else if (s === "HALF_DAY") halfDay++;
      else if (s === "HOLIDAY") holiday++;
    }

    return {
      id: emp.id,
      name: emp.name,
      records: dayRecords,
      summary: {
        present,
        absent,
        late,
        halfDay,
        holiday,
        workingDays: totalWorkingDays,
      },
    };
  });

  const totalPresent = employeeRows.reduce((s, e) => s + e.summary.present, 0);
  const totalAbsent = employeeRows.reduce((s, e) => s + e.summary.absent, 0);
  const maxPossible = employees.length * totalWorkingDays;
  const avgAttendance =
    maxPossible > 0 ? Math.round((totalPresent / maxPossible) * 100) : 0;

  return {
    employees: employeeRows,
    summary: {
      totalPresent,
      totalAbsent,
      avgAttendance,
      workingDays: totalWorkingDays,
    },
  };
};

/* ════════════════════════════════════════════════════════════════
   ATTENDANCE  —  CSV EXPORT
   ════════════════════════════════════════════════════════════════ */

export const getAttendanceCsvService = async ({
  teamId,
  employeeId,
  from,
  to,
}) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const userWhere = { teamId, role: "EMPLOYEE" };
  if (employeeId) userWhere.id = employeeId;

  const employees = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const records = await prisma.attendance.findMany({
    where: {
      userId: { in: employees.map((e) => e.id) },
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ userId: "asc" }, { date: "asc" }],
  });

  const empById = Object.fromEntries(employees.map((e) => [e.id, e.name]));
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const headers = [
    "Employee",
    "Date",
    "Status",
    "Check In",
    "Check Out",
    "Note",
  ];

  const rows = records.map((r) =>
    [
      escape(empById[r.userId] ?? r.userId),
      escape(new Date(r.date).toLocaleDateString("en-IN")),
      escape(r.status),
      escape(
        r.checkIn
          ? new Date(r.checkIn).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
      ),
      escape(
        r.checkOut
          ? new Date(r.checkOut).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
      ),
      escape(r.note),
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
};
