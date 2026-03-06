import prisma from "../../config/db.js";

/* ================= UTILITY FUNCTIONS ================= */

const normalizePhoneNumber = (phone) => {
  if (phone === null || phone === undefined || phone === "") return "";

  let phoneStr = String(phone).trim();
  phoneStr = phoneStr.replace(/[\s\-\(\)\.]/g, "");

  if (phoneStr.includes("e") || phoneStr.includes("E")) {
    try {
      const num = parseFloat(phoneStr);
      phoneStr = num.toFixed(0);
    } catch (e) {
      console.error("Error parsing scientific notation:", e);
    }
  }

  phoneStr = phoneStr.replace(/\D/g, "");
  return phoneStr;
};

const normalizeString = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).trim();
};

const normalizeMeta = (meta) => {
  if (!meta || typeof meta !== "object") return {};

  const normalized = {};
  for (const [key, value] of Object.entries(meta)) {
    normalized[key] =
      value === null || value === undefined ? "" : String(value).trim();
  }
  return normalized;
};

const normalizeLeadData = (leadData) => {
  return {
    companyName: normalizeString(leadData.companyName),
    personName: normalizeString(leadData.personName),
    phone: normalizePhoneNumber(leadData.phone),
    meta: normalizeMeta(leadData.meta),
  };
};

const validateLeadData = (leadData) => {
  const errors = [];

  if (!leadData.phone || leadData.phone === "") {
    errors.push("Phone number is required");
  }

  if (leadData.phone && !/^\d{10,15}$/.test(leadData.phone)) {
    errors.push(`Invalid phone format: ${leadData.phone}`);
  }

  if (!leadData.personName && !leadData.companyName) {
    errors.push("Either person name or company name is required");
  }

  return { isValid: errors.length === 0, errors };
};

/* ================= GET LEADS ================= */

export const getLeadsListService = async ({
  teamId,
  search,
  statuses,
  assignees,
  campaignId,
  page = 1,
  limit = 20,
}) => {
  const offset = (page - 1) * limit;

  const where = {
    teamId,
    ...(campaignId && { campaignId }),
    ...(statuses && { status: { in: statuses.split(",") } }),
    ...(assignees && { assignedToId: { in: assignees.split(",") } }),
    ...(search && {
      OR: [
        { personName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { companyName: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return { data: leads, pagination: { page, limit, total } };
};

/* ================= GET SINGLE ================= */

export const getLeadByIdService = async (id, teamId) => {
  const lead = await prisma.lead.findFirst({
    where: { id, teamId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      campaign: { select: { id: true, name: true } },
    },
  });

  if (!lead) throw new Error("Lead not found");
  return lead;
};

/* ================= GET LEAD ACTIVITIES ================= */

export const getLeadActivitiesService = async (leadId, teamId) => {
  // Verify lead belongs to team
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, teamId },
    select: { id: true },
  });

  if (!lead) throw new Error("Lead not found");

  const activities = await prisma.leadActivity.findMany({
    where: { leadId },
    include: {
      user: { select: { id: true, name: true } },
      // ← NEW: include assignee so frontend can show "assigned by X → Y"
      assignee: { select: { id: true, name: true } },
      outcome: { select: { id: true, name: true, color: true } },
      outcomeReason: { select: { id: true, label: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return activities;
};

/* ================= ASSIGN LEADS ================= */

export const assignLeadsService = async ({
  manager,
  leadIds,
  employees,
  statusOverride,
}) => {
  if (!leadIds?.length) throw new Error("No leads selected");
  if (!employees?.length) throw new Error("No employees selected");

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, teamId: manager.teamId },
    orderBy: { createdAt: "asc" },
  });

  if (!leads.length) throw new Error("No valid leads found");

  const users = await prisma.user.findMany({
    where: {
      id: { in: employees.map((e) => e.employeeId) },
      role: "EMPLOYEE",
      teamId: manager.teamId,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (!users.length) throw new Error("No valid employees found");

  const validEmployeeIds = new Set(users.map((u) => u.id));
  const validEmployees = employees.filter((e) =>
    validEmployeeIds.has(e.employeeId),
  );

  if (!validEmployees.length) throw new Error("No valid employees found");

  const assignments = [];
  let leadIndex = 0;
  const totalLeads = leads.length;
  const hasPercentages = validEmployees.some(
    (e) => e.percentage != null && e.percentage > 0,
  );

  if (hasPercentages) {
    for (const emp of validEmployees) {
      const percent = emp.percentage ?? 0;
      const count = Math.round((percent / 100) * totalLeads);
      for (let i = 0; i < count && leadIndex < totalLeads; i++) {
        assignments.push({
          leadId: leads[leadIndex++].id,
          employeeId: emp.employeeId,
        });
      }
    }
  }

  let rr = 0;
  while (leadIndex < totalLeads) {
    assignments.push({
      leadId: leads[leadIndex].id,
      employeeId: validEmployees[rr % validEmployees.length].employeeId,
    });
    leadIndex++;
    rr++;
  }

  const finalStatus = statusOverride || "ASSIGNED";

  const updatePromises = assignments.map((a) =>
    prisma.$transaction([
      prisma.lead.update({
        where: { id: a.leadId },
        data: { assignedToId: a.employeeId, status: finalStatus },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: a.leadId,
          userId: manager.id,
          type: "ASSIGNED",
          remark: "Lead assigned",
          assigneeId: a.employeeId, // ← NEW: store who was assigned TO
        },
      }),
    ]),
  );

  await Promise.all(updatePromises);

  const distribution = validEmployees.map((emp) => ({
    employeeId: emp.employeeId,
    employeeName: users.find((u) => u.id === emp.employeeId)?.name,
    count: assignments.filter((a) => a.employeeId === emp.employeeId).length,
    percentage: emp.percentage,
  }));

  return {
    totalLeads: leads.length,
    assigned: assignments.length,
    distribution,
  };
};

/* ================= IMPORT LEADS ================= */

export const importLeadsService = async ({
  userId,
  teamId,
  campaignId,
  leads,
}) => {
  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    throw new Error("No leads provided");
  }
  if (!campaignId) throw new Error("Campaign ID is required");

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };

  const validLeads = [];

  for (let i = 0; i < leads.length; i++) {
    const normalized = normalizeLeadData(leads[i]);
    const validation = validateLeadData(normalized);

    if (!validation.isValid) {
      results.skipped++;
      results.errors.push({
        row: i + 2,
        data: leads[i],
        errors: validation.errors,
      });
      continue;
    }

    validLeads.push({ ...normalized, rowIndex: i });
  }

  if (validLeads.length === 0) return results;

  const allPhones = validLeads.map((l) => l.phone);

  const existingLeads = await prisma.lead.findMany({
    where: { phone: { in: allPhones }, teamId },
    select: { phone: true },
  });

  const existingPhones = new Set(existingLeads.map((l) => l.phone));

  const seenInBatch = new Set();
  const newLeads = [];

  for (const lead of validLeads) {
    if (existingPhones.has(lead.phone)) {
      results.duplicates++;
      results.errors.push({
        row: lead.rowIndex + 2,
        data: lead,
        errors: [`Duplicate phone: ${lead.phone}`],
      });
      continue;
    }

    if (seenInBatch.has(lead.phone)) {
      results.duplicates++;
      results.errors.push({
        row: lead.rowIndex + 2,
        data: lead,
        errors: [`Duplicate phone in file: ${lead.phone}`],
      });
      continue;
    }

    seenInBatch.add(lead.phone);
    newLeads.push(lead);
  }

  if (newLeads.length === 0) return results;

  const CHUNK_SIZE = 500;

  for (let i = 0; i < newLeads.length; i += CHUNK_SIZE) {
    const chunk = newLeads.slice(i, i + CHUNK_SIZE);

    try {
      const inserted = await prisma.lead.createMany({
        data: chunk.map((lead) => ({
          companyName: lead.companyName,
          personName: lead.personName,
          phone: lead.phone,
          meta: lead.meta,
          teamId,
          campaignId,
          status: "FRESH",
        })),
        skipDuplicates: true,
      });

      results.success += inserted.count;
    } catch (error) {
      console.error(`Chunk failed, retrying individually:`, error.message);

      for (const lead of chunk) {
        try {
          await prisma.lead.create({
            data: {
              companyName: lead.companyName,
              personName: lead.personName,
              phone: lead.phone,
              meta: lead.meta,
              teamId,
              campaignId,
              status: "FRESH",
            },
          });
          results.success++;
        } catch (singleError) {
          results.failed++;
          results.errors.push({
            row: lead.rowIndex + 2,
            data: lead,
            errors: [singleError.message],
          });
        }
      }
    }
  }

  if (results.success > 0) {
    try {
      const createdLeads = await prisma.lead.findMany({
        where: {
          phone: { in: newLeads.map((l) => l.phone) },
          teamId,
          campaignId,
        },
        select: { id: true },
      });

      await prisma.leadActivity.createMany({
        data: createdLeads.map((lead) => ({
          leadId: lead.id,
          userId,
          type: "REMARK",
          remark: "Imported via Excel",
        })),
      });
    } catch (activityError) {
      console.error("Failed to create activities:", activityError.message);
    }
  }

  return results;
};

/* ================= CREATE SINGLE LEAD ================= */

export const createLeadService = async ({
  userId,
  teamId,
  campaignId,
  leadData,
}) => {
  const normalizedLead = normalizeLeadData(leadData);

  const validation = validateLeadData(normalizedLead);
  if (!validation.isValid) throw new Error(validation.errors.join(", "));

  const existing = await prisma.lead.findFirst({
    where: { phone: normalizedLead.phone, teamId },
  });

  if (existing) {
    throw new Error(`Lead with phone ${normalizedLead.phone} already exists`);
  }

  const lead = await prisma.lead.create({
    data: {
      companyName: normalizedLead.companyName,
      personName: normalizedLead.personName,
      phone: normalizedLead.phone,
      meta: normalizedLead.meta,
      teamId,
      campaignId,
      status: leadData.status || "FRESH",
      assignedToId: leadData.assignedToId || null,
      activities: {
        create: {
          userId,
          type: "REMARK",
          remark: leadData.remark || "Lead created",
        },
      },
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
    },
  });

  return lead;
};

/* ================= UPDATE LEAD ================= */

export const updateLeadService = async ({ id, teamId, userId, leadData }) => {
  const existingLead = await prisma.lead.findFirst({ where: { id, teamId } });

  if (!existingLead) throw new Error("Lead not found");

  const updateData = {};

  if (leadData.companyName !== undefined)
    updateData.companyName = normalizeString(leadData.companyName);
  if (leadData.personName !== undefined)
    updateData.personName = normalizeString(leadData.personName);
  if (leadData.phone !== undefined)
    updateData.phone = normalizePhoneNumber(leadData.phone);
  if (leadData.status !== undefined) updateData.status = leadData.status;
  if (leadData.assignedToId !== undefined)
    updateData.assignedToId = leadData.assignedToId;
  if (leadData.meta !== undefined)
    updateData.meta = normalizeMeta(leadData.meta);

  const lead = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({ where: { id }, data: updateData });

    await tx.leadActivity.create({
      data: { leadId: id, userId, type: "REMARK", remark: "Lead updated" },
    });

    return updated;
  });

  return lead;
};

/* ================= DELETE LEAD ================= */

export const deleteLeadService = async (id, teamId) => {
  const existingLead = await prisma.lead.findFirst({ where: { id, teamId } });

  if (!existingLead) throw new Error("Lead not found");

  await prisma.lead.delete({ where: { id } });

  return { success: true };
};

/* ================= Search Leads Service ================= */

export const searchLeadsService = async ({
  teamId,
  q,
  mode = "auto",
  limit = 30,
}) => {
  if (!q || !q.trim()) return [];

  const term = q.trim();

  /* ── Build the Prisma WHERE based on search mode ── */
  let orConditions = [];

  if (mode === "phone") {
    // Strip all non-digits then do a contains match
    const digits = term.replace(/\D/g, "");
    orConditions = [{ phone: { contains: digits } }];
  } else if (mode === "email") {
    orConditions = [
      {
        meta: {
          path: ["email"],
          string_contains: term,
        },
      },
    ];
  } else if (mode === "text") {
    // Name / company only
    orConditions = [
      { personName: { contains: term, mode: "insensitive" } },
      { companyName: { contains: term, mode: "insensitive" } },
    ];
  } else {
    // AUTO — try everything: name, phone (digits), company, email in meta
    const digits = term.replace(/\D/g, "");
    orConditions = [
      { personName: { contains: term, mode: "insensitive" } },
      { companyName: { contains: term, mode: "insensitive" } },
      ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      {
        meta: {
          path: ["email"],
          string_contains: term,
        },
      },
    ];
  }

  const leads = await prisma.lead.findMany({
    where: {
      teamId, // ← always scope to the user's team
      OR: orConditions,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" }, // most recently touched first
    take: limit,
  });

  return leads;
};
