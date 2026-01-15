import prisma from "../../config/db.js";

const SYSTEM_OUTCOMES = [
  { name: "NOT_PICKED_UP", stage: "ACTIVE" },
  { name: "BUSY", stage: "ACTIVE" },
  { name: "SWITCHED_OFF", stage: "ACTIVE" },
  { name: "CALL_LATER", stage: "ACTIVE" },
  { name: "CALL_BACK_SCHEDULED", stage: "ACTIVE" },
  { name: "INTERESTED", stage: "ACTIVE" },

  { name: "WON", stage: "CLOSED" },
  { name: "LOST", stage: "CLOSED" },
];

export const ensurePipelineDefaults = async (teamId) => {
  const existing = await prisma.callOutcomeConfig.findMany({
    where: { teamId },
    select: { name: true },
  });

  const existingSet = new Set(existing.map((o) => o.name));

  const toCreate = SYSTEM_OUTCOMES.filter((o) => !existingSet.has(o.name));

  if (!toCreate.length) return;

  await prisma.callOutcomeConfig.createMany({
    data: toCreate.map((o) => ({
      teamId,
      name: o.name,
      stage: o.stage,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
};
