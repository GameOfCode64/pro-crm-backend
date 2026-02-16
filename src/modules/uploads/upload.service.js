import prisma from "../../config/db.js";
import { parseUploadFile } from "./upload.utils.js";

/**
 * Create upload session
 */
export const createUploadSession = async (data) => {
  return prisma.uploadSession.create({ data });
};

/**
 * Save mappings
 */
export const saveMappingsService = async (uploadId, mappings) => {
  await prisma.uploadFieldMapping.deleteMany({
    where: { uploadId },
  });

  await prisma.uploadFieldMapping.createMany({
    data: mappings.map((m) => ({
      uploadId,
      excelColumn: m.excelColumn,
      targetField: m.targetField,
    })),
  });

  return prisma.uploadSession.update({
    where: { id: uploadId },
    data: { status: "MAPPED" },
  });
};

/**
 * Save duplicate rule + preview
 */
export const saveDuplicateRulesService = async (uploadId, field, action) => {
  await prisma.uploadDuplicateRule.deleteMany({
    where: { uploadId },
  });

  await prisma.uploadDuplicateRule.create({
    data: {
      uploadId,
      field,
      action,
    },
  });

  const upload = await prisma.uploadSession.findUnique({
    where: { id: uploadId },
  });

  const { rows } = await parseUploadFile(upload.filePath);

  const existingValues = new Set(
    (
      await prisma.lead.findMany({
        where: { teamId: upload.teamId },
        select: { phone: true },
      })
    ).map((l) => l.phone),
  );

  let duplicates = 0;

  for (const row of rows) {
    const value = String(row[field] ?? "");
    if (existingValues.has(value)) duplicates++;
  }

  const stats = {
    totalRows: rows.length,
    duplicateCount: duplicates,
    uniqueCount: rows.length - duplicates,
  };

  return prisma.uploadSession.update({
    where: { id: uploadId },
    data: {
      stats,
      status: "VALIDATED",
    },
  });
};

/**
 * Assign campaign
 */
export const assignCampaignService = async (uploadId, body, user) => {
  let campaignId = body.campaignId;

  if (body.type === "new") {
    const campaign = await prisma.campaign.create({
      data: {
        name: body.name,
        teamId: user.teamId,
        createdById: user.id,
      },
    });
    campaignId = campaign.id;
  }

  return prisma.uploadSession.update({
    where: { id: uploadId },
    data: {
      campaignId,
      status: "CONFIRMED",
    },
  });
};

/**
 * Confirm upload → CREATE LEADS
 **/

export const confirmUploadService = async (uploadId, user) => {
  const upload = await prisma.uploadSession.findUnique({
    where: { id: uploadId },
    include: {
      mappings: true,
      duplicateRules: true,
    },
  });

  if (!upload) throw new Error("Upload not found");

  const { rows } = await parseUploadFile(upload.filePath);

  let created = 0;

  for (const row of rows) {
    const leadData = {};
    const meta = {};

    // 🔥 APPLY MAPPINGS PROPERLY
    for (const mapping of upload.mappings) {
      const excelColumn = mapping.excelColumn;
      const targetField = mapping.targetField;

      const value = row[excelColumn];

      if (!targetField) continue;

      // Core fields
      if (
        ["personName", "phone", "companyName", "email"].includes(targetField)
      ) {
        leadData[targetField] = value ?? "";
      }

      // Custom fields
      else if (targetField.startsWith("meta.")) {
        const key = targetField.replace("meta.", "");
        meta[key] = value ?? "";
      }
    }

    if (!leadData.phone) continue;

    await prisma.lead.create({
      data: {
        ...leadData,
        meta,
        teamId: upload.teamId,
        campaignId: upload.campaignId,
        status: "FRESH",
        activities: {
          create: {
            userId: user.id,
            type: "REMARK",
            remark: "Imported via Excel",
          },
        },
      },
    });

    created++;
  }

  await prisma.uploadSession.update({
    where: { id: uploadId },
    data: { status: "COMPLETED" },
  });

  return { created };
};
