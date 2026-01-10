import prisma from "../../config/db.js";

export const createForm = async (user, payload) => {
  return prisma.form.create({
    data: {
      name: payload.name,
      description: payload.description,
      schema: payload.schema,
      teamId: user.teamId,
      createdById: user.id,
    },
  });
};

export const getForms = (teamId) => {
  return prisma.form.findMany({
    where: { teamId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
};

export const getLeadForms = async (leadId) => {
  const forms = await prisma.form.findMany({
    where: { isActive: true },
  });

  const responses = await prisma.formResponse.findMany({
    where: { leadId },
  });

  return { forms, responses };
};

export const submitForm = async ({ user, formId, leadId, values }) => {
  return prisma.formResponse.create({
    data: {
      formId,
      leadId,
      userId: user.id,
      values,
    },
  });
};
