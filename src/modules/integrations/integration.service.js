import prisma from "../../config/db.js";
import { mapLead } from "./integration.mapper.js";
import { logAudit } from "../audit/audit.logger.js";

export const handleIncomingLead = async (provider, payload, headers) => {
  // 1️⃣ Validate secret
  const token = headers["x-webhook-token"];
  if (token !== process.env.INTEGRATION_SECRET) {
    throw new Error("Invalid webhook token");
  }

  // 2️⃣ Get integration config
  const integration = await prisma.integration.findFirst({
    where: { provider, isActive: true },
  });
  if (!integration) return;

  // 3️⃣ Normalize data
  const leadData = mapLead(provider, payload);

  // 4️⃣ Assign employee (round-robin)
  const employees = await prisma.user.findMany({
    where: {
      teamId: integration.teamId,
      role: "EMPLOYEE",
      isActive: true,
    },
  });
  if (!employees.length) return;

  const index = Math.floor(Math.random() * employees.length);
  const employee = employees[index];

  // 5️⃣ Create lead
  const lead = await prisma.lead.create({
    data: {
      ...leadData,
      assignedToId: employee.id,
      teamId: integration.teamId,
      status: "FRESH",
      meta: {
        source: provider,
        raw: payload,
      },
    },
  });

  // 6️⃣ Audit
  await logAudit({
    action: "INTEGRATION_LEAD_CREATED",
    entity: "LEAD",
    entityId: lead.id,
    meta: { provider },
  });
};
