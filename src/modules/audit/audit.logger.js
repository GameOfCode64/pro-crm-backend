import prisma from "../../config/db.js";

export const logAudit = async ({
  action,
  entity,
  entityId = null,
  userId = null,
  meta = null,
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        userId,
        meta,
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};
