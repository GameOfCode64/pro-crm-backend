import prisma from "../../config/db.js";

export const createReason = async ({ teamId, outcome, label }) => {
  if (!outcome || !label) {
    throw new Error("Outcome and label are required");
  }

  return prisma.callOutcomeReason.create({
    data: {
      teamId,
      outcome,
      label,
    },
  });
};

export const getReasons = async (teamId) => {
  return prisma.callOutcomeReason.findMany({
    where: { teamId },
    orderBy: { createdAt: "asc" },
  });
};

export const toggleReason = async (id) => {
  const reason = await prisma.callOutcomeReason.findUnique({ where: { id } });
  if (!reason) throw new Error("Reason not found");

  return prisma.callOutcomeReason.update({
    where: { id },
    data: { isActive: !reason.isActive },
  });
};

export const getReasonsByOutcome = async ({ teamId, outcome }) => {
  return prisma.callOutcomeReason.findMany({
    where: {
      teamId,
      outcome,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });
};
