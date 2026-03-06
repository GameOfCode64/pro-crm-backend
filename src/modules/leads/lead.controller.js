import prisma from "../../config/db.js";
import {
  getLeadsListService,
  getLeadByIdService,
  assignLeadsService,
  importLeadsService,
  createLeadService,
  searchLeadsService,
} from "./lead.service.js";

/* ================= GET LEADS ================= */

export const getLeadsList = async (req, res, next) => {
  try {
    const {
      search,
      statuses,
      assignees,
      campaignId,
      page = 1,
      limit = 20,
    } = req.query;

    const result = await getLeadsListService({
      teamId: req.user.teamId,
      search,
      statuses,
      assignees,
      campaignId,
      page: Number(page),
      limit: Number(limit),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/* ================= SINGLE LEAD ================= */

export const getLeadById = async (req, res, next) => {
  try {
    const lead = await getLeadByIdService(req.params.id, req.user.teamId);
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

/* ================= CREATE SINGLE LEAD ================= */

export const createLead = async (req, res, next) => {
  try {
    const lead = await createLeadService({
      userId: req.user.id,
      teamId: req.user.teamId,
      campaignId: req.body.campaignId,
      leadData: req.body,
    });

    res.status(201).json({
      message: "Lead created successfully",
      lead,
    });
  } catch (err) {
    next(err);
  }
};

/* ================= IMPORT LEADS FROM EXCEL ================= */

export const importLeads = async (req, res, next) => {
  try {
    const { leads, campaignId } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: "No leads provided" });
    }

    if (!campaignId) {
      return res.status(400).json({ error: "Campaign ID is required" });
    }

    const results = await importLeadsService({
      userId: req.user.id,
      teamId: req.user.teamId,
      campaignId,
      leads,
    });

    // Return response based on results
    const statusCode = results.success > 0 ? 200 : 400;

    res.status(statusCode).json({
      message: `Import completed. ${results.success} leads imported successfully, ${results.duplicates} duplicates found, ${results.skipped} skipped, ${results.failed} failed.`,
      results,
    });
  } catch (err) {
    next(err);
  }
};

/* ================= COUNT CAMPAIGN LEADS ================= */

export const countCampaignLeads = async (req, res, next) => {
  try {
    const { campaignId } = req.query;

    if (!campaignId) {
      return res.status(400).json({ error: "Campaign ID is required" });
    }

    const total = await prisma.lead.count({
      where: {
        campaignId,
        teamId: req.user.teamId,
      },
    });

    res.json({ total });
  } catch (err) {
    next(err);
  }
};

/* ================= BULK UPDATE - SELECTED LEADS ================= */

export const bulkUpdateSelected = async (req, res, next) => {
  try {
    const { leadIds, status, employeeDistribution } = req.body;

    if (!leadIds || leadIds.length === 0) {
      return res.status(400).json({ error: "No leads selected" });
    }

    // Verify leads belong to this team
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        teamId: req.user.teamId,
      },
      select: { id: true },
    });

    if (leads.length === 0) {
      return res.status(404).json({ error: "No valid leads found" });
    }

    const validLeadIds = leads.map((l) => l.id);

    // If no employee distribution, just update status
    if (!employeeDistribution || employeeDistribution.length === 0) {
      if (!status) {
        return res.status(400).json({
          error: "Either status or employee distribution is required",
        });
      }

      await prisma.lead.updateMany({
        where: { id: { in: validLeadIds } },
        data: { status },
      });

      return res.json({
        success: true,
        message: "Leads status updated successfully",
        updated: validLeadIds.length,
      });
    }

    // If employee distribution exists, assign leads
    const employees = employeeDistribution.map((emp) => ({
      employeeId: emp.employeeId,
      percentage: emp.percentage,
    }));

    const result = await assignLeadsService({
      manager: req.user,
      leadIds: validLeadIds,
      employees,
      statusOverride: status,
    });

    res.json({
      success: true,
      message: "Leads assigned successfully",
      ...result,
    });
  } catch (err) {
    console.error("Bulk update selected error:", err);
    next(err);
  }
};

/* ================= BULK UPDATE - CAMPAIGN RANGE ================= */

export const bulkUpdateCampaign = async (req, res, next) => {
  try {
    const {
      campaignId,
      limit,
      offset = 0,
      status,
      employeeDistribution,
    } = req.body;

    console.log("bulkUpdateCampaign called with:", {
      campaignId,
      limit,
      offset,
      status,
      employeeDistribution,
    });

    if (!campaignId) {
      return res.status(400).json({ error: "Campaign ID is required" });
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Fetch lead IDs from campaign (ONE query)
    // ─────────────────────────────────────────────────────────────
    const leads = await prisma.lead.findMany({
      where: { campaignId, teamId: req.user.teamId },
      skip: offset,
      take: limit || 999999,
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (!leads.length) {
      return res.status(404).json({ error: "No leads found in campaign" });
    }

    const leadIds = leads.map((l) => l.id);
    const totalLeads = leadIds.length;

    // ─────────────────────────────────────────────────────────────
    // CASE A: Status update only — no employee distribution
    // ─────────────────────────────────────────────────────────────
    if (!employeeDistribution || employeeDistribution.length === 0) {
      if (!status) {
        return res.status(400).json({
          error: "Either status or employee distribution is required",
        });
      }

      await prisma.lead.updateMany({
        where: { id: { in: leadIds } },
        data: { status },
      });

      return res.json({
        success: true,
        message: "Leads status updated successfully",
        totalLeads,
        updated: totalLeads,
        assigned: 0,
        distribution: [],
      });
    }

    // ─────────────────────────────────────────────────────────────
    // CASE B: Assign to employees with distribution
    // ─────────────────────────────────────────────────────────────

    // Validate employees in ONE query
    const users = await prisma.user.findMany({
      where: {
        id: { in: employeeDistribution.map((e) => e.employeeId) },
        role: "EMPLOYEE",
        teamId: req.user.teamId,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (!users.length) {
      return res.status(400).json({ error: "No valid employees found" });
    }

    const validEmployeeIds = new Set(users.map((u) => u.id));
    const validEmployees = employeeDistribution.filter((e) =>
      validEmployeeIds.has(e.employeeId),
    );

    if (!validEmployees.length) {
      return res.status(400).json({ error: "No valid employees found" });
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Calculate assignments in memory (0 DB calls)
    // ─────────────────────────────────────────────────────────────
    const assignments = [];
    let leadIndex = 0;

    const hasPercentages = validEmployees.some(
      (e) => e.percentage != null && e.percentage > 0,
    );

    if (hasPercentages) {
      for (const emp of validEmployees) {
        const percent = emp.percentage ?? 0;
        const count = Math.round((percent / 100) * totalLeads);
        for (let i = 0; i < count && leadIndex < totalLeads; i++) {
          assignments.push({
            leadId: leadIds[leadIndex++],
            employeeId: emp.employeeId,
          });
        }
      }
    }

    // Fill remaining with round-robin
    let rr = 0;
    while (leadIndex < totalLeads) {
      assignments.push({
        leadId: leadIds[leadIndex],
        employeeId: validEmployees[rr % validEmployees.length].employeeId,
      });
      leadIndex++;
      rr++;
    }

    const finalStatus = status || "ASSIGNED";

    // ─────────────────────────────────────────────────────────────
    // STEP 3: ONE updateMany per employee (NOT one per lead)
    // ─────────────────────────────────────────────────────────────
    const byEmployee = new Map();
    for (const a of assignments) {
      if (!byEmployee.has(a.employeeId)) byEmployee.set(a.employeeId, []);
      byEmployee.get(a.employeeId).push(a.leadId);
    }

    await Promise.all(
      [...byEmployee.entries()].map(([employeeId, ids]) =>
        prisma.lead.updateMany({
          where: { id: { in: ids } },
          data: {
            assignedToId: employeeId,
            status: finalStatus,
          },
        }),
      ),
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 4: ONE bulk insert for all activities
    // ─────────────────────────────────────────────────────────────
    await prisma.leadActivity.createMany({
      data: assignments.map((a) => ({
        leadId: a.leadId,
        userId: req.user.id,
        type: "ASSIGNED",
        remark: "Lead assigned",
      })),
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 5: Return distribution summary
    // ─────────────────────────────────────────────────────────────
    const distribution = validEmployees.map((emp) => ({
      employeeId: emp.employeeId,
      employeeName: users.find((u) => u.id === emp.employeeId)?.name,
      count: byEmployee.get(emp.employeeId)?.length ?? 0,
      percentage: emp.percentage,
    }));

    return res.json({
      success: true,
      message: "Leads assigned successfully",
      totalLeads,
      assigned: assignments.length,
      distribution,
    });
  } catch (err) {
    console.error("bulkUpdateCampaign error:", err);
    next(err);
  }
};

/* ================= LEGACY ASSIGN (Keep for backwards compatibility) ================= */

export const assignLeads = async (req, res, next) => {
  try {
    const result = await assignLeadsService({
      manager: req.user,
      leadIds: req.body.leadIds,
      employees: req.body.employees,
    });

    res.json({
      message: "Leads assigned successfully",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

/* ================= GET LEAD ACTIVITIES ================= */

export const getLeadActivities = async (req, res, next) => {
  try {
    const { id } = req.params;

    const activities = await prisma.leadActivity.findMany({
      where: {
        leadId: id,
        lead: {
          teamId: req.user.teamId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        outcome: {
          select: {
            id: true,
            name: true,
            color: true,
            stage: true,
          },
        },
        outcomeReason: {
          select: {
            id: true,
            label: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(activities);
  } catch (err) {
    next(err);
  }
};

/* ================= GET LEAD FORM RESPONSES ================= */

export const getLeadForms = async (req, res, next) => {
  try {
    const { id } = req.params;

    const formResponses = await prisma.formResponse.findMany({
      where: {
        leadId: id,
        lead: {
          teamId: req.user.teamId,
        },
      },
      include: {
        form: {
          select: {
            id: true,
            name: true,
            description: true,
            schema: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(formResponses);
  } catch (err) {
    next(err);
  }
};

/* ================= GET MY LEADS (FOR EMPLOYEES/CALLERS) ================= */

export const getMyLeads = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leads = await prisma.lead.findMany({
      where: {
        assignedToId: userId,
        teamId: req.user.teamId,
        status: {
          notIn: ["WON", "LOST"],
        },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
        activities: {
          where: {
            createdAt: {
              gte: today,
            },
            type: "CALL",
          },
          select: {
            id: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: [{ followUpAt: "asc" }, { createdAt: "asc" }],
    });

    // Add computed fields
    const enrichedLeads = leads.map((lead) => ({
      ...lead,
      calledToday: lead.activities.length > 0,
      lastCallTime: lead.activities[0]?.createdAt || null,
    }));

    res.json(enrichedLeads);
  } catch (err) {
    next(err);
  }
};

/* ================= COMPLETE LEAD CALL ================= */

export const completeLead = async (req, res, next) => {
  try {
    const { leadId, outcomeId, outcomeReasonId, remark, formValues } = req.body;

    // Get outcome to determine new status
    const outcome = await prisma.callOutcomeConfig.findUnique({
      where: { id: outcomeId },
    });

    if (!outcome) {
      return res.status(404).json({ error: "Outcome not found" });
    }

    // Update lead status
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: outcome.name,
      },
    });

    // Create activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        userId: req.user.id,
        type: "CALL",
        outcomeId,
        outcomeReasonId: outcomeReasonId || null,
        remark: remark || null,
      },
    });

    // Save form response if provided
    if (formValues && Object.keys(formValues).length > 0) {
      const activeForm = await prisma.form.findFirst({
        where: {
          teamId: req.user.teamId,
          isActive: true,
        },
      });

      if (activeForm) {
        await prisma.formResponse.upsert({
          where: {
            formId_leadId_userId: {
              formId: activeForm.id,
              leadId,
              userId: req.user.id,
            },
          },
          create: {
            formId: activeForm.id,
            leadId,
            userId: req.user.id,
            schemaSnapshot: activeForm.schema,
            values: formValues,
          },
          update: {
            values: formValues,
          },
        });
      }
    }

    res.json({ success: true, lead: updatedLead });
  } catch (err) {
    next(err);
  }
};

/* ================= DELETE LEAD ================= */

export const deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify lead belongs to team
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        teamId: req.user.teamId,
      },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Delete lead (cascade will handle activities and forms)
    await prisma.lead.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// SEARCH LEADS CONTROLLER
export const searchLeadsController = async (req, res) => {
  try {
    const { q, mode = "auto", limit } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: "Search query (q) is required" });
    }

    const results = await searchLeadsService({
      teamId: req.user.teamId,
      q: q.trim(),
      mode: mode.toLowerCase(),
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 30,
    });

    return res.json(results);
  } catch (error) {
    console.error("searchLeadsController error:", error);
    return res.status(500).json({ error: "Failed to search leads" });
  }
};
