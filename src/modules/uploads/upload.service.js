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
    include: {
      mappings: true,
      duplicateRules: true,
    },
  });

  if (!upload) throw new Error("Upload not found");

  const { rows } = await parseUploadFile(upload.filePath);

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const leadData = {};
    const meta = {};

    try {
      // APPLY MAPPINGS PROPERLY
      for (const mapping of upload.mappings) {
        const excelColumn = mapping.excelColumn;
        const targetField = mapping.targetField;
        const value = row[excelColumn];

        if (!targetField) continue;

        // Core fields
        if (targetField === "personName") {
          leadData.personName = value;
        } else if (targetField === "companyName") {
          leadData.companyName = value;
        } else if (targetField === "phone") {
          leadData.phone = value; // Will be normalized later
        } else if (targetField === "email") {
          leadData.email = value;
        }
        // Custom fields
        else if (targetField.startsWith("meta.")) {
          const key = targetField.replace("meta.", "");
          meta[key] = value ?? "";
        }
      }

      // Skip if no phone number
      if (!leadData.phone && !leadData.phone === "") {
        skipped++;
        errors.push({
          row: i + 2,
          error: "Phone number is required",
          data: row,
        });
        continue;
      }

      // NORMALIZE THE LEAD DATA (CRITICAL FIX)
      const normalizedLead = normalizeUploadLeadData(leadData, meta);

      // Check for duplicates if rule exists
      if (upload.duplicateRules && upload.duplicateRules.length > 0) {
        const rule = upload.duplicateRules[0];
        if (rule.field === "phone") {
          const existing = await prisma.lead.findFirst({
            where: {
              phone: normalizedLead.phone,
              teamId: upload.teamId,
            },
          });

          if (existing) {
            if (rule.action === "SKIP") {
              skipped++;
              errors.push({
                row: i + 2,
                error: `Duplicate phone number: ${normalizedLead.phone}`,
                data: row,
              });
              continue;
            }
            // If action is "UPDATE" or something else, you can handle here
          }
        }
      }

      // Create lead with normalized data
      await prisma.lead.create({
        data: {
          personName: normalizedLead.personName || null,
          companyName: normalizedLead.companyName || null,
          phone: normalizedLead.phone, // ✅ This is now guaranteed to be a string
          email: normalizedLead.email || null,
          meta: normalizedLead.meta,
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
    } catch (error) {
      console.error(`Error creating lead from row ${i + 2}:`, error);
      errors.push({
        row: i + 2,
        error: error.message,
        data: row,
      });
      skipped++;
    }
  }

  // Update upload session with results
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
