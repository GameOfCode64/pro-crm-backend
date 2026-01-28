import prisma from "../../config/db.js";
import { Prisma } from "@prisma/client";

/**
 * ======================================================
 * CONSTANTS
 * ======================================================
 */

const OUTCOME_TO_STATUS = {
  INTERESTED: "IN_PROGRESS",
  CALL_LATER: "FOLLOW_UP",
  CALL_BACK_SCHEDULED: "FOLLOW_UP",
  NOT_INTERESTED: "LOST",
  WRONG_NUMBER: "LOST",
};

const CALL_GROUPS = {
  NOT_PICKED_UP_GROUP: ["NOT_PICKED_UP", "BUSY", "SWITCHED_OFF"],
  FOLLOW_UP_GROUP: ["CALL_LATER", "CALL_BACK_SCHEDULED"],
  INTERESTED_GROUP: ["INTERESTED"],
  DEAD_GROUP: ["NOT_INTERESTED", "WRONG_NUMBER"],
};

/**
 * ======================================================
 * EMPLOYEE
 * ======================================================
 */

export const getMyLeads = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.$queryRaw`
    SELECT
      l.*,
      EXISTS (
        SELECT 1
        FROM "LeadActivity" la
        WHERE la."leadId" = l.id
          AND la.type = 'CALL'
          AND la."createdAt" >= ${today}
      ) AS "calledToday"
    FROM "Lead" l
    WHERE l."assignedToId" = ${userId}
    ORDER BY l."updatedAt" DESC
  `;
};

export const getLeadById = async (leadId) => {
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          outcome: { select: { id: true, name: true } },
          outcomeReason: { select: { id: true, label: true } },
        },
      },
      formResponses: true,
    },
  });
};

/**
 * ======================================================
 * CALL / COMPLETE
 * ======================================================
 */

export const completeLeadService = async ({
  userId,
  leadId,
  outcomeId,
  outcomeReasonId,
  remark,
  formValues,
}) => {
  if (!outcomeId) throw new Error("Call outcome is required");

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const outcome = await prisma.callOutcomeConfig.findUnique({
    where: { id: outcomeId },
    select: { name: true },
  });
  if (!outcome) throw new Error("Invalid outcome");

  const newStatus = OUTCOME_TO_STATUS[outcome.name] ?? lead.status;

  await prisma.$transaction(async (tx) => {
    if (formValues) {
      const activeForm = await tx.form.findFirst({
        where: { teamId: lead.teamId, isActive: true },
        select: { id: true, schema: true },
      });

      if (activeForm) {
        // Find existing response first
        const existingResponse = await tx.formResponse.findFirst({
          where: {
            formId: activeForm.id,
            leadId,
            userId,
          },
        });

        if (existingResponse) {
          // Update existing response
          await tx.formResponse.update({
            where: { id: existingResponse.id },
            data: { values: formValues },
          });
        } else {
          // Create new response
          await tx.formResponse.create({
            data: {
              formId: activeForm.id,
              leadId,
              userId,
              values: formValues,
              schemaSnapshot: activeForm.schema,
            },
          });
        }
      }
    }

    await tx.lead.update({
      where: { id: leadId },
      data: { status: newStatus },
    });

    await tx.leadActivity.create({
      data: {
        leadId,
        userId,
        type: "CALL",
        outcomeId,
        outcomeReasonId: outcomeReasonId ?? null,
        remark: remark ?? `Call outcome: ${outcome.name}`,
        oldStatus: lead.status,
        newStatus,
      },
    });
  });

  return { message: "Lead completed successfully" };
};
export const logCall = async ({
  userId,
  leadId,
  outcomeId,
  outcomeReasonId,
  remark,
  followUpAt,
}) => {
  if (!outcomeId) throw new Error("Call outcome is required");

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const outcome = await prisma.callOutcomeConfig.findUnique({
    where: { id: outcomeId },
    select: { name: true },
  });
  if (!outcome) throw new Error("Invalid outcome");

  const newStatus = OUTCOME_TO_STATUS[outcome.name] ?? lead.status;

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
        outcomeId,
        outcomeReasonId: outcomeReasonId ?? null,
        remark: remark ?? null,
        oldStatus: lead.status,
        newStatus,
      },
    }),
  ]);

  return { message: "Call logged successfully" };
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

/**
 * ======================================================
 * MANAGER – FILTERED LEADS (ASSIGN PAGE)
 * ======================================================
 */

// Fixed service with proper UUID casting for employeeIds

export const getFilteredLeads = async ({
  manager,
  statuses,
  outcomes,
  employeeIds,
  page = 1,
  limit = 50,
}) => {
  const offset = (page - 1) * limit;

  const statusList = statuses ? statuses.split(",") : [];
  const outcomeList = outcomes ? outcomes.split(",") : [];
  const employeeList = employeeIds ? employeeIds.split(",") : [];

  const leads = await prisma.$queryRaw`
    SELECT
      l.*,
      u.name AS "assignedToName",
      oc.name AS "lastOutcome"
    FROM "Lead" l

    LEFT JOIN "User" u ON u.id = l."assignedToId"

    LEFT JOIN LATERAL (
      SELECT la."outcomeId"
      FROM "LeadActivity" la
      WHERE la."leadId" = l.id AND la.type = 'CALL'
      ORDER BY la."createdAt" DESC
      LIMIT 1
    ) last_call ON TRUE

    LEFT JOIN "CallOutcomeConfig" oc
      ON oc.id = last_call."outcomeId"

    WHERE l."teamId" = ${manager.teamId}

    ${
      statusList.length
        ? Prisma.sql`
          AND l.status = ANY (
            ARRAY[${Prisma.join(
              statusList.map((s) => Prisma.sql`${s}::"LeadStatus"`),
            )}]
          )
        `
        : Prisma.empty
    }

    ${
      employeeList.length
        ? Prisma.sql`
          AND l."assignedToId"::text = ANY (
            ARRAY[${Prisma.join(employeeList.map((id) => Prisma.sql`${id}`))}]
          )
        `
        : Prisma.empty
    }

    ${
      outcomeList.length
        ? Prisma.sql`
          AND oc.name = ANY (
            ARRAY[${Prisma.join(outcomeList.map((o) => Prisma.sql`${o}`))}]
          )
        `
        : Prisma.empty
    }

    ORDER BY l."updatedAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const [{ count }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "Lead" l
    WHERE l."teamId" = ${manager.teamId}
  `;

  return { data: leads, page, limit, total: count };
};
/**
 * ======================================================
 * ASSIGN LEADS
 * ======================================================
 */

export const reassignLeadsService = async ({
  manager,
  leadIds,
  employeeIds,
}) => {
  if (!leadIds?.length) throw new Error("No leads selected");
  if (!employeeIds?.length) throw new Error("No employees selected");

  const employees = await prisma.user.findMany({
    where: {
      id: { in: employeeIds },
      role: "EMPLOYEE",
      isActive: true,
      teamId: manager.teamId,
    },
    select: { id: true, name: true },
  });

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, teamId: manager.teamId },
  });

  let i = 0;
  for (const lead of leads) {
    const emp = employees[i++ % employees.length];

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { assignedToId: emp.id, status: "ASSIGNED" },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          userId: manager.id,
          type: "ASSIGNED",
          remark: `Assigned to ${emp.name}`,
        },
      }),
    ]);
  }

  return leads.length;
};

/**
 * ======================================================
 * MANAGER LEADERBOARD SERVICE
 * ======================================================
 */

export const getLeaderboardService = async (teamId, fromDate) => {
  const employees = await prisma.user.findMany({
    where: { teamId, role: "EMPLOYEE", isActive: true },
    select: { id: true, name: true, email: true },
  });

  if (!employees.length) return [];

  const employeeIds = employees.map((e) => e.id);

  const calls = await prisma.$queryRaw`
    SELECT DISTINCT ON ("leadId")
      la."leadId",
      la."userId",
      oc.name AS "outcomeName"
    FROM "LeadActivity" la
    JOIN "CallOutcomeConfig" oc ON oc.id = la."outcomeId"
    WHERE la.type = 'CALL'
      AND la."userId" = ANY (
        ARRAY[${Prisma.join(employeeIds.map((id) => Prisma.sql`${id}::text`))}]
      )
      AND la."createdAt" >= ${fromDate}
    ORDER BY la."leadId", la."createdAt" DESC
  `;

  const board = {};
  for (const e of employees) {
    board[e.id] = {
      employeeId: e.id,
      name: e.name,
      email: e.email,
      totalCalls: 0,
      uniqueLeads: 0,
      interested: 0,
      followUps: 0,
      lost: 0,
    };
  }

  for (const c of calls) {
    const row = board[c.userId];
    if (!row) continue;

    row.totalCalls++;
    row.uniqueLeads++;

    if (c.outcomeName === "INTERESTED") row.interested++;
    if (["CALL_LATER", "CALL_BACK_SCHEDULED"].includes(c.outcomeName))
      row.followUps++;
    if (["NOT_INTERESTED", "WRONG_NUMBER"].includes(c.outcomeName)) row.lost++;
  }

  return Object.values(board)
    .sort((a, b) => b.uniqueLeads - a.uniqueLeads)
    .map((row, idx) => ({ rank: idx + 1, ...row }));
};
