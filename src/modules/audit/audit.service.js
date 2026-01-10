import prisma from "../../config/db.js";

export const getAuditLogs = async (user, filters) => {
  const where = {};

  // 🔐 ROLE-BASED VISIBILITY
  if (user.role === "MANAGER") {
    where.user = {
      teamId: user.teamId,
    };
  }
  // ADMIN → no restriction

  // Optional filters
  if (filters.action) where.action = filters.action;
  if (filters.entity) where.entity = filters.entity;

  return prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200, // safety limit
  });
};
