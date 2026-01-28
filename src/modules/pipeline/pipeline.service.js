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
  const { name, stage, reasons = [] } = payload;

  if (!name || !name.trim()) {
    throw new Error("Outcome name is required");
  }

  if (!stage) {
    throw new Error("Stage is required");
  }

  return prisma.callOutcomeConfig.create({
    data: {
      teamId,
      name: name.trim(),
      stage, // Add this required field
      isSystem: false,
      reasons: {
        create: reasons.map((label) => ({ label: label.trim() })),
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

export const deleteOutcomeService = async (teamId, outcomeId) => {
  const outcome = await prisma.callOutcomeConfig.findFirst({
    where: { id: outcomeId, teamId },
  });

  if (!outcome) {
    throw new Error("Outcome not found");
  }

  if (outcome.isSystem) {
    throw new Error("Cannot delete system outcomes");
  }

  return prisma.callOutcomeConfig.delete({
    where: { id: outcomeId },
  });
};
