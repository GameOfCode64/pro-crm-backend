import prisma from "../../config/db.js";
import { Prisma } from "@prisma/client";
import { notifyFollowUp } from "./lead.sse.js";
import {
  emitCallLogged,
  emitFollowUpUpdate,
  emitLeadReassigned,
} from "../dashboard/dashboard.realtime.js";

const AUTO_STATUS_BY_OUTCOME = {
  INTERESTED: "IN_PROGRESS",
  CALL_LATER: "FOLLOW_UP",
  CALL_BACK_SCHEDULED: "FOLLOW_UP",
  NOT_INTERESTED: "LOST",
  WRONG_NUMBER: "LOST",
};

const enumArray = (values, enumName) =>
  Prisma.join(values.map((v) => Prisma.sql`${v}::"${Prisma.raw(enumName)}"`));

export const getMyLeads = (userId) => {
  return prisma.lead.findMany({
    where: { assignedToId: userId },
    orderBy: { updatedAt: "desc" },
  });
};

export const getFilteredLeads = async ({
  manager,
  statuses,
  outcomes,
  employeeIds,
  page = 1,
  limit = 50,
}) => {
  const dbManager = await prisma.user.findUnique({
    where: { id: manager.id },
    select: { teamId: true },
  });

  if (!dbManager?.teamId) {
    throw new Error("Manager has no team");
  }

  const teamId = dbManager.teamId;

  const statusList = statuses ? statuses.split(",") : [];
  const outcomeList = outcomes ? outcomes.split(",") : [];
  const employeeList = employeeIds ? employeeIds.split(",") : [];

  const offset = (page - 1) * limit;

  const leads = await prisma.$queryRaw(
    Prisma.sql`
    SELECT
      l.*,
      u.id as "assignedToId",
      u.name as "assignedToName"
    FROM "Lead" l
    LEFT JOIN "User" u
      ON u.id = l."assignedToId"

    LEFT JOIN LATERAL (
      SELECT la."callOutcome"
      FROM "LeadActivity" la
      WHERE la."leadId" = l.id
        AND la.type = 'CALL'
      ORDER BY la."createdAt" DESC
      LIMIT 1
    ) last_call ON TRUE

    WHERE l."teamId" = ${teamId}

    ${
      statusList.length
        ? Prisma.sql`AND l.status = ANY(${Prisma.sql`ARRAY[${Prisma.join(
            statusList
          )}]`}::"LeadStatus"[])`
        : Prisma.empty
    }

    ${
      employeeList.length
        ? Prisma.sql`AND l."assignedToId" = ANY(${Prisma.sql`ARRAY[${Prisma.join(
            employeeList
          )}]`}::uuid[])`
        : Prisma.empty
    }

    ${
      outcomeList.length
        ? Prisma.sql`AND last_call."callOutcome" = ANY(${Prisma.sql`ARRAY[${Prisma.join(
            outcomeList
          )}]`}::"CallOutcome"[])`
        : Prisma.empty
    }

    ORDER BY l."updatedAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `
  );

  const countResult = await prisma.$queryRaw(
    Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Lead" l
      LEFT JOIN LATERAL (
        SELECT la."callOutcome"
        FROM "LeadActivity" la
        WHERE la."leadId" = l.id
          AND la.type = 'CALL'
        ORDER BY la."createdAt" DESC
        LIMIT 1
      ) last_call ON TRUE
      WHERE l."teamId" = ${teamId}

      ${
        statusList.length
          ? Prisma.sql`AND l.status IN (${enumArray(statusList, "LeadStatus")})`
          : Prisma.empty
      }

      ${
        employeeList.length
          ? Prisma.sql`AND l."assignedToId" IN (${Prisma.join(employeeList)})`
          : Prisma.empty
      }

      ${
        outcomeList.length
          ? Prisma.sql`
              AND last_call."callOutcome" IN (${enumArray(
                outcomeList,
                "CallOutcome"
              )})
            `
          : Prisma.empty
      }
    `
  );

  return {
    data: leads,
    page,
    limit,
    total: countResult[0].count,
  };
};

export const getLeadById = (leadId) => {
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
};

export const logCall = async ({
  userId,
  leadId,
  callOutcome,
  remark,
  followUpAt,
}) => {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const newStatus = AUTO_STATUS_BY_OUTCOME[callOutcome] || lead.status;

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        status: newStatus,
        followUpAt: followUpAt ? new Date(followUpAt) : lead.followUpAt,
      },
    }),
    prisma.leadActivity.create({
      data: {
        leadId,
        userId,
        type: "CALL",
        callOutcome,
        remark,
        oldStatus: lead.status,
        newStatus,
      },
    }),
  ]);

  // 🔔 REAL-TIME EVENTS (CORRECT PLACE)

  emitCallLogged({
    leadId: lead.id,
    userId,
  });

  if (followUpAt) {
    notifyFollowUp({
      type: "FOLLOW_UP_CREATED",
      leadId: lead.id,
      followUpAt,
    });

    emitFollowUpUpdate({
      leadId: lead.id,
      followUpAt,
    });
  }

  return { message: "Call logged & status updated" };
};

export const changeStatus = async (userId, leadId, status, remark) => {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { status },
    }),
    prisma.leadActivity.create({
      data: {
        leadId,
        userId,
        type: "STATUS_CHANGE",
        oldStatus: lead.status,
        newStatus: status,
        remark,
      },
    }),
  ]);

  return { message: "Status changed" };
};

export const getKanban = (teamId) => {
  return prisma.lead.findMany({
    where: { teamId },
    orderBy: { updatedAt: "desc" },
  });
};

export const getLeaderboard = (teamId, fromDate) => {
  return prisma.leadActivity.groupBy({
    by: ["userId", "callOutcome"],
    where: {
      lead: { teamId },
      createdAt: { gte: fromDate },
      type: "CALL",
    },
    _count: { id: true },
  });
};

export const reassignLeadsService = async ({
  manager,
  leadIds,
  employeeIds,
}) => {
  if (!leadIds?.length) {
    throw new Error("No leads selected");
  }

  if (!employeeIds?.length) {
    throw new Error("No employees selected");
  }

  // ✅ Validate employees
  const employees = await prisma.user.findMany({
    where: {
      id: { in: employeeIds },
      role: "EMPLOYEE",
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (employees.length !== employeeIds.length) {
    throw new Error("Invalid employee selection");
  }

  // ✅ Validate leads
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      teamId: manager.teamId,
    },
  });

  if (!leads.length) {
    throw new Error("No valid leads found");
  }

  let index = 0;
  const actions = [];

  for (const lead of leads) {
    const employee = employees[index % employees.length];
    index++;

    actions.push(
      prisma.$transaction([
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            assignedToId: employee.id,
            status: "ASSIGNED",
          },
        }),
        prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            userId: manager.id,
            type: "ASSIGNED",
            remark: `Assigned to ${employee.name}`,
          },
        }),
      ])
    );
  }

  await Promise.all(actions);

  return leads.length;
};

const CALL_GROUPS = {
  NOT_PICKED_UP_GROUP: ["NOT_PICKED_UP", "BUSY", "SWITCHED_OFF"],
  FOLLOW_UP_GROUP: ["CALL_LATER", "CALL_BACK_SCHEDULED"],
  INTERESTED_GROUP: ["INTERESTED"],
  DEAD_GROUP: ["NOT_INTERESTED", "WRONG_NUMBER"],
};

export const getLeadGroups = async (teamId) => {
  /**
   * 1️⃣ Get latest CALL activity per lead
   */
  const latestCalls = await prisma.$queryRaw`
    SELECT DISTINCT ON ("leadId")
      "leadId",
      "callOutcome",
      "createdAt"
    FROM "LeadActivity"
    WHERE "type" = 'CALL'
    ORDER BY "leadId", "createdAt" DESC
  `;

  /**
   * 2️⃣ Build lookup: leadId -> callOutcome
   */
  const outcomeMap = {};
  for (const row of latestCalls) {
    outcomeMap[row.leadId] = row.callOutcome;
  }

  /**
   * 3️⃣ Get all team leads
   */
  const leads = await prisma.lead.findMany({
    where: { teamId },
    include: {
      assignedTo: { select: { id: true, name: true } },
    },
  });

  /**
   * 4️⃣ Group leads
   */
  const groups = {
    FRESH: [],
    NOT_PICKED_UP_GROUP: [],
    FOLLOW_UP_GROUP: [],
    INTERESTED_GROUP: [],
    DEAD_GROUP: [],
  };

  for (const lead of leads) {
    const outcome = outcomeMap[lead.id];

    if (!outcome) {
      groups.FRESH.push(lead);
      continue;
    }

    let placed = false;

    for (const [groupName, outcomes] of Object.entries(CALL_GROUPS)) {
      if (outcomes.includes(outcome)) {
        groups[groupName].push(lead);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.FRESH.push(lead);
    }
  }

  return groups;
};

const baseFollowUpWhere = (user) => {
  if (user.role === "EMPLOYEE") {
    return { assignedToId: user.id };
  }
  if (user.role === "MANAGER") {
    return { teamId: user.teamId };
  }
};

export const getTodayFollowUps = async (user) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return prisma.lead.findMany({
    where: {
      ...baseFollowUpWhere(user),
      followUpAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { followUpAt: "asc" },
  });
};

export const getUpcomingFollowUps = async (user) => {
  return prisma.lead.findMany({
    where: {
      ...baseFollowUpWhere(user),
      followUpAt: {
        gt: new Date(),
      },
    },
    orderBy: { followUpAt: "asc" },
  });
};

export const getOverdueFollowUps = async (user) => {
  return prisma.lead.findMany({
    where: {
      ...baseFollowUpWhere(user),
      followUpAt: {
        lt: new Date(),
      },
      status: {
        notIn: ["WON", "LOST"],
      },
    },
    orderBy: { followUpAt: "asc" },
  });
};
