import prisma from "../../config/db.js";

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
    orderBy: { createdAt: "asc" }, // Consistent order
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
