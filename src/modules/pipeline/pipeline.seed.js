import prisma from "../../config/db.js";

const SYSTEM_OUTCOMES = [
  {
    key: "RNR",
    name: "RNR (Ring No Response)",
    stage: "ACTIVE",
    color: "#FF0000",
  },
  {
    key: "NOT_PICKED_UP",
    name: "Not Picked Up",
    stage: "ACTIVE",
    color: "#ef4444",
  },
  { key: "BUSY", name: "Busy", stage: "ACTIVE", color: "#f59e0b" },
  {
    key: "SWITCHED_OFF",
    name: "Switched Off",
    stage: "ACTIVE",
    color: "#a855f7",
  },
  { key: "CALL_LATER", name: "Call Later", stage: "ACTIVE", color: "#3b82f6" },
  {
    key: "CALL_BACK_SCHEDULED",
    name: "Callback Scheduled",
    stage: "ACTIVE",
    color: "#0ea5e9",
  },
  { key: "INTERESTED", name: "Interested", stage: "ACTIVE", color: "#10b981" },
  { key: "WON", name: "Won", stage: "CLOSED", color: "#22c55e" },
  { key: "LOST", name: "Lost", stage: "CLOSED", color: "#6b7280" },
];

export const ensurePipelineDefaults = async (teamId) => {
  const existing = await prisma.callOutcomeConfig.findMany({
    where: { teamId },
    select: { key: true },
  });

  const existingKeys = new Set(existing.map((o) => o.key));

  const toCreate = SYSTEM_OUTCOMES.filter((o) => !existingKeys.has(o.key));

  if (!toCreate.length) return;

  await prisma.callOutcomeConfig.createMany({
    data: toCreate.map((o) => ({
      teamId,
      key: o.key,
      name: o.name,
      stage: o.stage,
      color: o.color,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
};
