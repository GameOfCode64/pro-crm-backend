import prisma from "../../config/db.js";
import { parseUploadFile } from "./upload.utils.js";

/* ================= UTILITY FUNCTIONS ================= */

/**
 * Normalize phone number to string format
 */
const normalizePhoneNumber = (phone) => {
  if (phone === null || phone === undefined || phone === "") {
    return "";
  }

  // Force to string first and trim
  let phoneStr = String(phone).trim();

  // Remove all non-digit characters (spaces, dashes, parentheses, dots)
  phoneStr = phoneStr.replace(/[\s\-\(\)\.]/g, "");

  // Handle scientific notation (Excel quirk)
  if (phoneStr.includes("e") || phoneStr.includes("E")) {
    try {
      const num = parseFloat(phoneStr);
      phoneStr = num.toFixed(0);
    } catch (e) {
      console.error("Error parsing scientific notation:", e);
    }
  }

  // Final cleanup - ensure only digits remain
  phoneStr = phoneStr.replace(/\D/g, "");

  return phoneStr;
};

/**
 * Normalize string field
 */
const normalizeString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

/**
 * Normalize meta object
 */
const normalizeMeta = (meta) => {
  if (!meta || typeof meta !== "object") {
    return {};
  }

  const normalized = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === null || value === undefined) {
      normalized[key] = "";
      continue;
    }
    normalized[key] = String(value).trim();
  }

  return normalized;
};

/**
 * Normalize lead data from upload
 */
const normalizeUploadLeadData = (leadData, meta) => {
  return {
    personName: normalizeString(leadData.personName),
    companyName: normalizeString(leadData.companyName),
    phone: normalizePhoneNumber(leadData.phone), // CRITICAL: Normalize phone
    email: normalizeString(leadData.email),
    meta: normalizeMeta(meta),
  };
};

/* ================= UPLOAD SERVICE FUNCTIONS ================= */

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
    // Normalize the value for comparison
    const rawValue = row[field];
    const normalizedValue =
      field === "phone"
        ? normalizePhoneNumber(rawValue)
        : normalizeString(rawValue);

    if (existingValues.has(normalizedValue)) duplicates++;
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
 */
export const confirmUploadService = async (uploadId, user) => {
  const upload = await prisma.uploadSession.findUnique({
    where: { id: uploadId },
    include: { mappings: true, duplicateRules: true },
  });

  if (!upload) throw new Error("Upload not found");
  if (!upload.campaignId) throw new Error("Campaign not assigned to upload");

  const { rows } = await parseUploadFile(upload.filePath);

  let created = 0;
  let skipped = 0;
  const errors = [];

  // STEP 1: Map + normalize ALL rows in memory (0 DB calls)
  const validLeads = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const leadData = {};
    const meta = {};

    for (const mapping of upload.mappings) {
      const value = row[mapping.excelColumn];
      if (!mapping.targetField) continue;

      if (mapping.targetField === "personName") {
        leadData.personName = value;
      } else if (mapping.targetField === "companyName") {
        leadData.companyName = value;
      } else if (mapping.targetField === "phone") {
        leadData.phone = value;
      } else if (mapping.targetField.startsWith("meta.")) {
        const key = mapping.targetField.replace("meta.", "");
        meta[key] = value ?? "";
      }
    }

    const normalizedPhone = normalizePhoneNumber(leadData.phone);
    const normalizedPersonName = normalizeString(leadData.personName);
    const normalizedCompanyName = normalizeString(leadData.companyName);
    const normalizedMeta = normalizeMeta(meta);

    if (!normalizedPhone) {
      skipped++;
      errors.push({ row: i + 2, error: "Phone number is required", data: row });
      continue;
    }

    if (!normalizedPersonName && !normalizedCompanyName) {
      skipped++;
      errors.push({
        row: i + 2,
        error: "Person or company name is required",
        data: row,
      });
      continue;
    }

    validLeads.push({
      rowIndex: i,
      phone: normalizedPhone,
      personName: normalizedPersonName,
      companyName: normalizedCompanyName,
      meta: normalizedMeta,
    });
  }

  if (validLeads.length === 0) {
    await prisma.uploadSession.update({
      where: { id: uploadId },
      data: {
        status: "COMPLETED",
        stats: { totalRows: rows.length, created: 0, skipped, errors },
      },
    });
    return { created: 0, skipped, totalRows: rows.length, errors };
  }

  // STEP 2: ONE query to check ALL duplicates
  const duplicateRule = upload.duplicateRules?.[0];
  let existingPhones = new Set();

  if (duplicateRule?.field === "phone") {
    const existing = await prisma.lead.findMany({
      where: {
        phone: { in: validLeads.map((l) => l.phone) },
        teamId: upload.teamId,
      },
      select: { phone: true },
    });
    existingPhones = new Set(existing.map((l) => l.phone));
  }

  // STEP 3: Filter duplicates in memory (0 DB calls)
  const seenInBatch = new Set();
  const newLeads = [];

  for (const lead of validLeads) {
    if (existingPhones.has(lead.phone) && duplicateRule?.action === "SKIP") {
      skipped++;
      errors.push({
        row: lead.rowIndex + 2,
        error: `Duplicate phone: ${lead.phone}`,
        data: lead,
      });
      continue;
    }

    if (seenInBatch.has(lead.phone)) {
      skipped++;
      errors.push({
        row: lead.rowIndex + 2,
        error: `Duplicate phone in file: ${lead.phone}`,
        data: lead,
      });
      continue;
    }

    seenInBatch.add(lead.phone);
    newLeads.push(lead);
  }

  if (newLeads.length === 0) {
    await prisma.uploadSession.update({
      where: { id: uploadId },
      data: {
        status: "COMPLETED",
        stats: { totalRows: rows.length, created: 0, skipped, errors },
      },
    });
    return { created: 0, skipped, totalRows: rows.length, errors };
  }

  // STEP 4: createMany in chunks of 500
  const CHUNK_SIZE = 500;

  for (let i = 0; i < newLeads.length; i += CHUNK_SIZE) {
    const chunk = newLeads.slice(i, i + CHUNK_SIZE);

    try {
      const inserted = await prisma.lead.createMany({
        data: chunk.map((lead) => ({
          personName: lead.personName,
          companyName: lead.companyName,
          phone: lead.phone,
          meta: lead.meta,
          teamId: upload.teamId,
          campaignId: upload.campaignId,
          status: "FRESH",
        })),
        skipDuplicates: true,
      });
      created += inserted.count;
    } catch (error) {
      console.error(`Chunk failed, retrying individually:`, error.message);
      for (const lead of chunk) {
        try {
          await prisma.lead.create({
            data: {
              personName: lead.personName,
              companyName: lead.companyName,
              phone: lead.phone,
              meta: lead.meta,
              teamId: upload.teamId,
              campaignId: upload.campaignId,
              status: "FRESH",
            },
          });
          created++;
        } catch (singleError) {
          skipped++;
          errors.push({
            row: lead.rowIndex + 2,
            error: singleError.message,
            data: lead,
          });
        }
      }
    }
  }

  // STEP 5: ONE bulk insert for all activities
  if (created > 0) {
    try {
      const createdLeads = await prisma.lead.findMany({
        where: {
          phone: { in: newLeads.map((l) => l.phone) },
          teamId: upload.teamId,
          campaignId: upload.campaignId,
        },
        select: { id: true },
      });

      await prisma.leadActivity.createMany({
        data: createdLeads.map((lead) => ({
          leadId: lead.id,
          userId: user.id,
          type: "REMARK",
          remark: "Imported via Excel",
        })),
      });
    } catch (activityError) {
      console.error("Failed to create activities:", activityError.message);
    }
  }

  await prisma.uploadSession.update({
    where: { id: uploadId },
    data: {
      status: "COMPLETED",
      stats: {
        totalRows: rows.length,
        created,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      },
    },
  });

  return {
    created,
    skipped,
    totalRows: rows.length,
    errors: errors.length > 0 ? errors : undefined,
  };
};
