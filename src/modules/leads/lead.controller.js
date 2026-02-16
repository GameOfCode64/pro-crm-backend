import prisma from "../../config/db.js";
import {
  getLeadsListService,
  getLeadByIdService,
  assignLeadsService,
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

    if (!campaignId) {
      return res.status(400).json({ error: "Campaign ID is required" });
    }

    // Fetch leads from campaign with offset and limit
    const leads = await prisma.lead.findMany({
      where: {
        campaignId,
        teamId: req.user.teamId,
      },
      skip: offset,
      take: limit || 999999,
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (leads.length === 0) {
      return res.status(404).json({ error: "No leads found in campaign" });
    }

    const leadIds = leads.map((l) => l.id);

    // If no employee distribution, just update status
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
        updated: leadIds.length,
      });
    }

    // If employee distribution exists, assign leads
    const employees = employeeDistribution.map((emp) => ({
      employeeId: emp.employeeId,
      percentage: emp.percentage,
    }));

    const result = await assignLeadsService({
      manager: req.user,
      leadIds,
      employees,
      statusOverride: status,
    });

    res.json({
      success: true,
      message: "Leads assigned successfully",
      ...result,
    });
  } catch (err) {
    console.error("Bulk update campaign error:", err);
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

// Add these to your lead.controller.js

/* ================= GET LEAD ACTIVITIES ================= */

export const getLeadActivities = async (req, res, next) => {
  try {
    const { id } = req.params;

    const activities = await prisma.leadActivity.findMany({
      where: {
        leadId: id,
        lead: {
          teamId: req.user.teamId, // Verify lead belongs to user's team
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
          teamId: req.user.teamId, // Verify lead belongs to user's team
        },
      },
      include: {
        form: {
          select: {
            id: true,
            name: true,
            description: true,
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

// Add this to your lead.controller.js

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
        // Exclude won/lost leads from main list
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
      orderBy: [
        { followUpAt: "asc" }, // Prioritize follow-ups
        { createdAt: "asc" }, // Then oldest first
      ],
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
