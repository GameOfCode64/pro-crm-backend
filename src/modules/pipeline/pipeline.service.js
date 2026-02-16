import prisma from "../../config/db.js";

/**
 * GET PIPELINE DATA
 */
export const getPipelineData = async (teamId) => {
  const outcomes = await prisma.callOutcomeConfig.findMany({
    where: { teamId },
    include: {
      reasons: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    initialStage: ["FRESH"],
    activeStage: outcomes.filter((o) => o.stage === "ACTIVE"),
    closedStage: outcomes.filter((o) => o.stage === "CLOSED"),
  };
};

/**
 * CREATE OUTCOME
 */
export const createOutcomeService = async (teamId, payload) => {
  const { key, name, stage, color, reasons = [] } = payload;

  if (!key || !name || !stage || !color) {
    throw new Error("key, name, stage and color are required");
  }

  return prisma.callOutcomeConfig.create({
    data: {
      teamId,
      key: key.trim(),
      name: name.trim(),
      stage,
      color,
      isSystem: false,
      reasons: {
        create: reasons.map((label) => ({ label: label.trim() })),
      },
    },
    include: { reasons: true },
  });
};

/**
 * UPDATE OUTCOME
 */
export const updateOutcomeService = async (teamId, outcomeId, payload) => {
  const { name, color, reasons = [] } = payload;

  const existing = await prisma.callOutcomeConfig.findFirst({
    where: { id: outcomeId, teamId },
  });

  if (!existing) throw new Error("Outcome not found");

  if (existing.isSystem && name && name !== existing.name) {
    throw new Error("System outcomes cannot be renamed");
  }

  await prisma.callOutcomeReason.deleteMany({
    where: { outcomeId },
  });

  return prisma.callOutcomeConfig.update({
    where: { id: outcomeId },
    data: {
      name: name ?? existing.name,
      color: color ?? existing.color,
      reasons: {
        create: reasons.map((label) => ({ label })),
      },
    },
    include: { reasons: true },
  });
};

/**
 * DELETE OUTCOME
 */
export const deleteOutcomeService = async (teamId, outcomeId) => {
  const outcome = await prisma.callOutcomeConfig.findFirst({
    where: { id: outcomeId, teamId },
  });

  if (!outcome) throw new Error("Outcome not found");

  if (outcome.isSystem) {
    throw new Error("Cannot delete system outcomes");
  }

  return prisma.callOutcomeConfig.delete({
    where: { id: outcomeId },
  });
};
