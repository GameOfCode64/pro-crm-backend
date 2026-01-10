import prisma from "../../config/db.js";
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

export const getMyLeads = (userId) => {
  return prisma.lead.findMany({
    where: { assignedToId: userId },
    orderBy: { updatedAt: "desc" },
  });
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

export const reassignLeads = async ({ manager, leadIds, employeeIds }) => {
  if (!leadIds?.length) throw new Error("No leads selected");
  if (!employeeIds?.length) throw new Error("No employees selected");

  // Validate employees belong to manager team
  const employees = await prisma.user.findMany({
    where: {
      id: { in: employeeIds },
      teamId: manager.teamId,
      role: "EMPLOYEE",
      isActive: true,
    },
  });

  if (employees.length !== employeeIds.length) {
    throw new Error("Invalid employee selection");
  }

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      teamId: manager.teamId,
    },
  });

  if (!leads.length) throw new Error("No valid leads found");

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
          },
        }),
        prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            userId: manager.id,
            type: "ASSIGNED",
            remark: `Reassigned to ${employee.name}`,
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
