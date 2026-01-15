import prisma from "../../config/db.js";

/**
 * Only ONE active form per team
 */
export const createOrUpdateForm = async ({
  teamId,
  userId,
  name,
  description,
  schema,
}) => {
  // deactivate old forms
  await prisma.form.updateMany({
    where: { teamId },
    data: { isActive: false },
  });

  return prisma.form.create({
    data: {
      teamId,
      name,
      description,
      schema,
      isActive: true,
      createdById: userId,
    },
  });
};

/**
 * EMPLOYEE: Save form response
 * - NO UPSERT
 * - schemaSnapshot ONLY on create
 */
export const submitFormResponse = async ({ userId, leadId, values }) => {
  // get user team
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true },
  });

  if (!user?.teamId) {
    throw new Error("User has no team");
  }

  // get active form
  const form = await prisma.form.findFirst({
    where: {
      teamId: user.teamId,
      isActive: true,
    },
  });

  if (!form) {
    throw new Error("No active form found");
  }

  // check existing response
  const existing = await prisma.formResponse.findFirst({
    where: {
      formId: form.id,
      leadId,
      userId,
    },
  });

  // update only values
  if (existing) {
    return prisma.formResponse.update({
      where: { id: existing.id },
      data: { values },
    });
  }

  // create new response (schemaSnapshot REQUIRED)
  return prisma.formResponse.create({
    data: {
      formId: form.id,
      leadId,
      userId,
      schemaSnapshot: form.schema,
      values,
    },
  });
};
