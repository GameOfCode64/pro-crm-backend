import prisma from "../../config/db.js";
import { parseUploadFile } from "./upload.utils.js";

/* ═══════════════════════════════════════════════════════════════
   NORMALIZERS
═══════════════════════════════════════════════════════════════ */

const normalizePhoneNumber = (phone) => {
  if (phone === null || phone === undefined || phone === "") return "";

  let s = String(phone).trim();
  s = s.replace(/[\s\-\(\)\.]/g, "");

  // Handle Excel scientific notation e.g. 9.18E+9
  if (/e/i.test(s)) {
    try {
      s = parseFloat(s).toFixed(0);
    } catch (_) {}
  }

  s = s.replace(/\D/g, "");
  return s;
};

const normalizeString = (v) =>
  v === null || v === undefined ? "" : String(v).trim();

const normalizeMeta = (meta) => {
  if (!meta || typeof meta !== "object") return {};
  return Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [
      k,
      v == null ? "" : String(v).trim(),
    ]),
  );
};

/* ═══════════════════════════════════════════════════════════════
   CRUD HELPERS
═══════════════════════════════════════════════════════════════ */

export const createUploadSession = async (data) =>
  prisma.uploadSession.create({ data });

/* ═══════════════════════════════════════════════════════════════
   SELECT SHEET
   POST /uploads/:id/select-sheet  { sheetName }
   Re-parses the stored file with the chosen sheet and updates
   headers + sampleRows on the UploadSession.
═══════════════════════════════════════════════════════════════ */

export const selectSheetService = async (uploadId, sheetName) => {
  const session = await prisma.uploadSession.findUnique({
    where: { id: uploadId },
  });
  if (!session)
    throw Object.assign(new Error("Upload not found"), { status: 404 });
  if (!sheetName?.trim())
    throw Object.assign(new Error("sheetName is required"), { status: 400 });

  const { headers, sampleRows, sheets } = await parseUploadFile(
    session.filePath,
    sheetName,
  );

  if (!sheets.includes(sheetName))
    throw Object.assign(new Error(`Sheet "${sheetName}" not found`), {
      status: 400,
    });

  const updated = await prisma.uploadSession.update({
    where: { id: uploadId },
    data: { selectedSheet: sheetName, headers, sampleRows },
  });

  return { ...updated, sheets, activeSheet: sheetName };
};

/* ═══════════════════════════════════════════════════════════════
   SAVE MAPPINGS
═══════════════════════════════════════════════════════════════ */

export const saveMappingsService = async (uploadId, mappings) => {
  await prisma.uploadFieldMapping.deleteMany({ where: { uploadId } });

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

/* ═══════════════════════════════════════════════════════════════
   SAVE DUPLICATE RULES + PREVIEW STATS
═══════════════════════════════════════════════════════════════ */

export const saveDuplicateRulesService = async (uploadId, field, action) => {
  await prisma.uploadDuplicateRule.deleteMany({ where: { uploadId } });
  await prisma.uploadDuplicateRule.create({
    data: { uploadId, field, action },
  });

  const upload = await prisma.uploadSession.findUnique({
    where: { id: uploadId },
  });
  const { rows } = await parseUploadFile(
    upload.filePath,
    upload.selectedSheet ?? null,
  );

  const existingPhones = new Set(
    (
      await prisma.lead.findMany({
        where: { teamId: upload.teamId },
        select: { phone: true },
      })
    ).map((l) => l.phone),
  );

  let duplicates = 0;
  for (const row of rows) {
    const raw = row[field];
    const val =
      field === "phone" ? normalizePhoneNumber(raw) : normalizeString(raw);
    if (existingPhones.has(val)) duplicates++;
  }

  const stats = {
    totalRows: rows.length,
    duplicateCount: duplicates,
    uniqueCount: rows.length - duplicates,
  };

  return prisma.uploadSession.update({
    where: { id: uploadId },
    data: { stats, status: "VALIDATED" },
  });
};

/* ═══════════════════════════════════════════════════════════════
   ASSIGN CAMPAIGN
═══════════════════════════════════════════════════════════════ */

export const assignCampaignService = async (uploadId, body, user) => {
  let campaignId = body.campaignId;

  if (body.type === "new") {
    const campaign = await prisma.campaign.create({
      data: { name: body.name, teamId: user.teamId, createdById: user.id },
    });
    campaignId = campaign.id;
  }

  return prisma.uploadSession.update({
    where: { id: uploadId },
    data: { campaignId, status: "CONFIRMED" },
  });
};

/* ═══════════════════════════════════════════════════════════════
   CONFIRM UPLOAD  →  CREATE LEADS
   
   FIX: removed seenInBatch deduplication — it was silently
   dropping valid leads that shared a phone number within the
   same file (e.g. same person, different company names).
   
   Only SKIP/UPDATE based on existing DB records, not within-file
   duplicates, unless the duplicate rule explicitly says SKIP.
═══════════════════════════════════════════════════════════════ */

export const confirmUploadService = async (uploadId, user) => {
  const upload = await prisma.uploadSession.findUnique({
    where: { id: uploadId },
    include: { mappings: true, duplicateRules: true },
  });

  if (!upload) throw new Error("Upload not found");
  if (!upload.campaignId) throw new Error("Campaign not assigned");

  // Always parse the sheet the user actually selected
  const { rows } = await parseUploadFile(
    upload.filePath,
    upload.selectedSheet ?? null,
  );

  let created = 0;
  let skipped = 0;
  const errors = [];

  /* ── STEP 1: Map + normalize all rows in memory ── */
  const validLeads = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const leadData = {};
    const meta = {};

    for (const mapping of upload.mappings) {
      if (!mapping.targetField) continue;
      const value = row[mapping.excelColumn];

      if (mapping.targetField === "personName") leadData.personName = value;
      else if (mapping.targetField === "companyName")
        leadData.companyName = value;
      else if (mapping.targetField === "phone") leadData.phone = value;
      else if (mapping.targetField.startsWith("meta.")) {
        meta[mapping.targetField.replace("meta.", "")] = value ?? "";
      }
    }

    const phone = normalizePhoneNumber(leadData.phone);
    const personName = normalizeString(leadData.personName);
    const companyName = normalizeString(leadData.companyName);

    // ── Validation: phone is mandatory ──
    if (!phone) {
      skipped++;
      errors.push({ row: i + 2, error: "Phone number is required", data: row });
      continue;
    }

    // ── Validation: at least one name ──
    if (!personName && !companyName) {
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
      phone,
      personName,
      companyName,
      meta: normalizeMeta(meta),
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

  /* ── STEP 2: ONE query — check which phones already exist in DB ── */
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

  /* ── STEP 3: Split into new leads vs duplicates ──
     KEY FIX: removed seenInBatch — within-file duplicates are
     now ALL imported (unless action is SKIP, in which case only
     the DB duplicate check matters, not within-file).         ── */
  const toInsert = [];
  const toUpdate = [];

  for (const lead of validLeads) {
    const isDuplicate = existingPhones.has(lead.phone);

    if (isDuplicate) {
      if (duplicateRule?.action === "SKIP") {
        skipped++;
        errors.push({
          row: lead.rowIndex + 2,
          error: `Duplicate phone: ${lead.phone}`,
        });
        continue;
      }

      if (duplicateRule?.action === "UPDATE") {
        toUpdate.push(lead);
        continue;
      }

      // KEEP_BOTH — fall through to insert
    }

    toInsert.push(lead);
  }

  /* ── STEP 4: UPDATE existing leads ── */
  for (const lead of toUpdate) {
    try {
      await prisma.lead.updateMany({
        where: { phone: lead.phone, teamId: upload.teamId },
        data: {
          personName: lead.personName || undefined,
          companyName: lead.companyName || undefined,
          meta: lead.meta,
        },
      });
      created++; // count updates as "processed"
    } catch (err) {
      skipped++;
      errors.push({ row: lead.rowIndex + 2, error: err.message });
    }
  }

  /* ── STEP 5: INSERT new leads in chunks of 500 ── */
  const CHUNK_SIZE = 500;

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);

    try {
      // skipDuplicates: false — we already handled duplicates above,
      // don't silently drop anything here
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
        skipDuplicates: false,
      });
      created += inserted.count;
    } catch (err) {
      // Chunk failed — retry one-by-one so partial failures don't lose the whole chunk
      console.error("Chunk insert failed, retrying individually:", err.message);

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
        } catch (singleErr) {
          skipped++;
          errors.push({
            row: lead.rowIndex + 2,
            error: singleErr.message,
            data: lead,
          });
        }
      }
    }
  }

  /* ── STEP 6: Bulk-insert activities for all created leads ── */
  if (created > 0) {
    try {
      const createdLeads = await prisma.lead.findMany({
        where: {
          phone: { in: toInsert.map((l) => l.phone) },
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
    } catch (actErr) {
      console.error("Activity insert failed:", actErr.message);
    }
  }

  /* ── STEP 7: Mark session complete ── */
  const finalStats = {
    totalRows: rows.length,
    created,
    skipped,
    ...(errors.length > 0 && { errors }),
  };

  await prisma.uploadSession.update({
    where: { id: uploadId },
    data: { status: "COMPLETED", stats: finalStats },
  });

  return {
    created,
    skipped,
    totalRows: rows.length,
    errors: errors.length > 0 ? errors : undefined,
  };
};
