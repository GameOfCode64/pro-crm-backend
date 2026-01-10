import prisma from "../../config/db.js";

export const leaderboard = (teamId, fromDate) => {
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
