import prisma from "../../config/db.js";

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
    return null;
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
 * Normalize entire lead object
 */
const normalizeLeadData = (leadData) => {
  return {
    companyName: normalizeString(leadData.companyName),
    personName: normalizeString(leadData.personName),
    phone: normalizePhoneNumber(leadData.phone), // Removed String() wrapper as it's handled in normalizePhoneNumber
    email: normalizeString(leadData.email),
    meta: normalizeMeta(leadData.meta),
  };
};

/**
 * Validate lead data
 */
const validateLeadData = (leadData) => {
  const errors = [];

  // Phone is required
  if (!leadData.phone || leadData.phone === "") {
    errors.push("Phone number is required");
  }

  // Phone format validation
  const phone = leadData.phone;
  if (phone && !/^\d{10,15}$/.test(phone)) {
    errors.push(`Invalid phone format: ${phone} (must be 10-15 digits)`);
  }

  // At least one name field
  if (!leadData.personName && !leadData.companyName) {
    errors.push("Either person name or company name is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
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
    ...(statuses && {
      status: {
        in: statuses.split(","),
      },
    }),
    ...(assignees && {
      assignedToId: {
        in: assignees.split(","),
      },
    }),
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
        assignedTo: {
          select: { id: true, name: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    data: leads,
    pagination: {
      page,
      limit,
      total,
    },
  };
};

/* ================= GET SINGLE ================= */

export const getLeadByIdService = async (id, teamId) => {
  const lead = await prisma.lead.findFirst({
    where: { id, teamId },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      campaign: {
        select: { id: true, name: true },
      },
    },
  });

  if (!lead) throw new Error("Lead not found");

  return lead;
};

/* ================= ASSIGN LEADS ================= */

export const assignLeadsService = async ({
  manager,
  leadIds,
  employees,
  statusOverride,
}) => {
  if (!leadIds?.length) {
    throw new Error("No leads selected");
  }

  if (!employees?.length) {
    throw new Error("No employees selected");
  }

  // Fetch leads
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      teamId: manager.teamId,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!leads.length) {
    throw new Error("No valid leads found");
  }

  // Fetch and validate employees
  const users = await prisma.user.findMany({
    where: {
      id: { in: employees.map((e) => e.employeeId) },
      role: "EMPLOYEE",
      teamId: manager.teamId,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (!users.length) {
    throw new Error("No valid employees found");
  }

  const validEmployeeIds = new Set(users.map((u) => u.id));
  const validEmployees = employees.filter((e) =>
    validEmployeeIds.has(e.employeeId),
  );

  if (!validEmployees.length) {
    throw new Error("No valid employees found");
  }

  /* ================= DISTRIBUTION ================= */

  const assignments = [];
  let leadIndex = 0;
  const totalLeads = leads.length;
  const hasPercentages = validEmployees.some(
    (e) => e.percentage != null && e.percentage > 0,
  );

  if (hasPercentages) {
    // Percentage-based distribution
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

  // Fill remaining leads with round-robin
  let rr = 0;
  while (leadIndex < totalLeads) {
    assignments.push({
      leadId: leads[leadIndex].id,
      employeeId: validEmployees[rr % validEmployees.length].employeeId,
    });
    leadIndex++;
    rr++;
  }

  /* ================= SAVE ================= */

  const finalStatus = statusOverride || "ASSIGNED";

  // Batch updates for better performance
  const updatePromises = assignments.map((a) =>
    prisma.$transaction([
      prisma.lead.update({
        where: { id: a.leadId },
        data: {
          assignedToId: a.employeeId,
          status: finalStatus,
        },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: a.leadId,
          userId: manager.id,
          type: "ASSIGNED",
          remark: `Lead assigned`,
        },
      }),
    ]),
  );

  await Promise.all(updatePromises);

  // Calculate distribution
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

/* ================= IMPORT LEADS FROM EXCEL ================= */

export const importLeadsService = async ({
  userId,
  teamId,
  campaignId,
  leads,
}) => {
  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    throw new Error("No leads provided");
  }

  if (!campaignId) {
    throw new Error("Campaign ID is required");
  }

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };

  for (let i = 0; i < leads.length; i++) {
    const rawLead = leads[i];

    try {
      // Normalize data
      const normalizedLead = normalizeLeadData(rawLead);

      // Validate data
      const validation = validateLeadData(normalizedLead);
      if (!validation.isValid) {
        results.skipped++;
        results.errors.push({
          row: i + 2,
          data: rawLead,
          errors: validation.errors,
        });
        continue;
      }

      // Check for duplicates
      const existing = await prisma.lead.findFirst({
        where: {
          phone: normalizedLead.phone,
          teamId,
        },
      });

      if (existing) {
        results.duplicates++;
        results.errors.push({
          row: i + 2,
          data: rawLead,
          errors: [`Duplicate phone number: ${normalizedLead.phone}`],
        });
        continue;
      }

      // CRITICAL FIX: Ensure phone is string before sending to Prisma
      const phoneAsString = String(normalizedLead.phone);

      // Create lead
      await prisma.lead.create({
        data: {
          companyName: normalizedLead.companyName,
          personName: normalizedLead.personName,
          phone: phoneAsString, // ✅ Explicitly converted to string
          email: normalizedLead.email,
          meta: normalizedLead.meta,
          teamId,
          campaignId,
          status: "FRESH",
          activities: {
            create: {
              userId,
              type: "REMARK",
              remark: "Imported via Excel",
            },
          },
        },
      });

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        row: i + 2,
        data: rawLead,
        errors: [error.message],
      });
      console.error(`Error importing lead at row ${i + 2}:`, error);
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
  // Normalize data
  const normalizedLead = normalizeLeadData(leadData);

  // Validate data
  const validation = validateLeadData(normalizedLead);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  // Check for duplicates
  const existing = await prisma.lead.findFirst({
    where: {
      phone: normalizedLead.phone,
      teamId,
    },
  });

  if (existing) {
    throw new Error(`Lead with phone ${normalizedLead.phone} already exists`);
  }

  // CRITICAL FIX: Ensure phone is string before sending to Prisma
  const phoneAsString = String(normalizedLead.phone);
  console.log(typeof phoneAsString, "the type of phone after conversion"); // Debug log

  // Create lead
  const lead = await prisma.lead.create({
    data: {
      companyName: normalizedLead.companyName,
      personName: normalizedLead.personName,
      phone: phoneAsString, // ✅ Explicitly converted to string
      email: normalizedLead.email,
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
  });

  return lead;
};

/* ================= UPDATE LEAD ================= */

export const updateLeadService = async ({ id, teamId, userId, leadData }) => {
  // Check if lead exists and belongs to team
  const existingLead = await prisma.lead.findFirst({
    where: { id, teamId },
  });

  if (!existingLead) {
    throw new Error("Lead not found");
  }

  // Normalize the update data
  const updateData = {};

  if (leadData.companyName !== undefined) {
    updateData.companyName = normalizeString(leadData.companyName);
  }

  if (leadData.personName !== undefined) {
    updateData.personName = normalizeString(leadData.personName);
  }

  if (leadData.phone !== undefined) {
    // CRITICAL FIX: Ensure phone is string
    updateData.phone = String(normalizePhoneNumber(leadData.phone));
  }

  if (leadData.email !== undefined) {
    updateData.email = normalizeString(leadData.email);
  }

  if (leadData.status !== undefined) {
    updateData.status = leadData.status;
  }

  if (leadData.assignedToId !== undefined) {
    updateData.assignedToId = leadData.assignedToId;
  }

  if (leadData.meta !== undefined) {
    updateData.meta = normalizeMeta(leadData.meta);
  }

  // Add activity for the update
  const lead = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id },
      data: updateData,
    });

    await tx.leadActivity.create({
      data: {
        leadId: id,
        userId,
        type: "REMARK",
        remark: "Lead updated",
      },
    });

    return updated;
  });

  return lead;
};

/* ================= DELETE LEAD ================= */

export const deleteLeadService = async (id, teamId) => {
  // Check if lead exists and belongs to team
  const existingLead = await prisma.lead.findFirst({
    where: { id, teamId },
  });

  if (!existingLead) {
    throw new Error("Lead not found");
  }

  // Delete lead (cascade will delete activities)
  await prisma.lead.delete({
    where: { id },
  });

  return { success: true };
};
