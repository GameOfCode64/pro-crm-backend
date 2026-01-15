import prisma from "../../config/db.js";

/**
 * Fetch pipeline data
 */
export const getPipelineData = async (teamId) => {
  const activeOutcomes = await prisma.callOutcomeConfig.findMany({
    where: { teamId },
    include: {
      reasons: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    initialStage: ["FRESH"],
    activeStage: activeOutcomes,
    closedStage: ["WON", "LOST"],
  };
};

/**
 * Create new custom outcome
 */
export const createOutcomeService = async (teamId, payload) => {
  const { name, reasons = [] } = payload;

  if (!name) {
    throw new Error("Outcome name required");
  }

  return prisma.callOutcomeConfig.create({
    data: {
      teamId,
      name,
      outcome: name, // enum value
      isSystem: false,
      reasons: {
        create: reasons.map((label) => ({ label })),
      },
    },
    include: { reasons: true },
  });
};

/**
 * Update outcome + replace reasons
 */

export const updateOutcomeService = async (teamId, outcomeId, payload) => {
  const { name, reasons = [] } = payload;

  const existing = await prisma.callOutcomeConfig.findUnique({
    where: { id: outcomeId },
  });

  if (!existing || existing.teamId !== teamId) {
    throw new Error("Outcome not found");
  }

  // 🔒 SYSTEM OUTCOMES CANNOT CHANGE ENUM / NAME
  if (existing.isSystem && name !== existing.name) {
    throw new Error("System outcomes cannot be renamed");
  }

  // 🔁 Replace reasons ONLY
  await prisma.callOutcomeReason.deleteMany({
    where: { outcomeId },
  });

  return prisma.callOutcomeConfig.update({
    where: { id: outcomeId },
    data: {
      name: name ?? existing.name,
      reasons: {
        create: reasons.map((label) => ({ label })),
      },
    },
    include: { reasons: true },
  });
};
