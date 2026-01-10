import prisma from "../../config/db.js";
import { notifyFollowUp } from "./lead.sse.js";
import { emitOverdueEscalation } from "../dashboard/dashboard.realtime.js";

/**
 * Auto escalate overdue leads for a team
 */

export const escalateOverdueLeads = async (teamId) => {
  const now = new Date();

  // 1️⃣ Get overdue leads
  const overdueLeads = await prisma.lead.findMany({
    where: {
      teamId,
      followUpAt: { lt: now },
      status: { notIn: ["WON", "LOST"] },
    },
  });

  if (!overdueLeads.length) return 0;

  // 2️⃣ Get active employees
  const employees = await prisma.user.findMany({
    where: {
      teamId,
      role: "EMPLOYEE",
      isActive: true,
    },
  });

  if (!employees.length) return 0;

  let index = 0;

  // 3️⃣ Reassign round-robin
  for (const lead of overdueLeads) {
    const employee = employees[index % employees.length];
    index++;

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          assignedToId: employee.id,
          status: "IN_PROGRESS",
        },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          userId: employee.id,
          type: "ASSIGNED",
          remark: "Auto escalation: overdue follow-up",
        },
      }),
    ]);

    // 4️⃣ Real-time notify
    notifyFollowUp({
      type: "OVERDUE_ESCALATED",
      leadId: lead.id,
      assignedTo: employee.id,
    });
    emitOverdueEscalation({
      leadId: lead.id,
      assignedTo: employee.id,
    });
  }

  return overdueLeads.length;
};
