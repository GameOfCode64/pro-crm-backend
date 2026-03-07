import prisma from "../../config/db.js";

/**
 * Fetch campaigns for dropdown
 */
export const getCampaignsService = async (teamId) => {
  return prisma.campaign.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      source: true,
      createdAt: true,
      _count: {
        select: { leads: true },
      },
    },
  });
};

/**
 * Create new campaign
 */
export const createCampaignService = async (teamId, userId, payload) => {
  const { name, description, source } = payload;

  // Optional: prevent duplicate names per team
  const existing = await prisma.campaign.findFirst({
    where: {
      teamId,
      name: name.trim(),
    },
  });

  if (existing) {
    throw new Error("Campaign with this name already exists");
  }

  return prisma.campaign.create({
    data: {
      name: name.trim(),
      description,
      source,
      teamId,
      createdById: userId,
    },
  });
};
//
export const getMyCampaignsService = async ({ userId, teamId }) => {
  /* ── 1. Find campaign IDs where this user has assigned leads ── */
  const assignedLeads = await prisma.lead.findMany({
    where: {
      teamId,
      assignedToId: userId,
    },
    select: {
      id: true,
      campaignId: true,
      status: true,
    },
  });

  // Unique campaign IDs this employee works on
  const myCampaignIds = [
    ...new Set(assignedLeads.map((l) => l.campaignId).filter(Boolean)),
  ];

  if (myCampaignIds.length === 0) return [];

  /* ── 2. Fetch full campaign data for those campaigns ── */
  const campaigns = await prisma.campaign.findMany({
    where: {
      id: { in: myCampaignIds },
      teamId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      // All leads in this campaign (for total count + all assignees)
      leads: {
        select: {
          id: true,
          assignedToId: true,
          assignedTo: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  /* ── 3. Find which leads this user has CALLED ── */
  // A lead is "called" if it has at least one CALL activity by this user
  const calledLeadIds = await prisma.leadActivity
    .findMany({
      where: {
        userId,
        type: "CALL",
        lead: {
          campaignId: { in: myCampaignIds },
          teamId,
        },
      },
      select: { leadId: true },
      distinct: ["leadId"],
    })
    .then((rows) => new Set(rows.map((r) => r.leadId)));

  /* ── 4. Build response ── */
  const result = campaigns.map((campaign) => {
    // All leads in this campaign
    const allLeads = campaign.leads;

    // Leads assigned to this employee in this campaign
    const myLeads = assignedLeads.filter((l) => l.campaignId === campaign.id);
    const myLeadIds = new Set(myLeads.map((l) => l.id));

    // How many of MY leads have been called
    const calledCount = myLeads.filter((l) => calledLeadIds.has(l.id)).length;

    // Progress % based on employee's own leads
    const progress =
      myLeads.length > 0 ? Math.round((calledCount / myLeads.length) * 100) : 0;

    // Unique assignees across the whole campaign
    const assigneeMap = new Map();
    allLeads.forEach((l) => {
      if (l.assignedTo?.id) {
        assigneeMap.set(l.assignedTo.id, l.assignedTo);
      }
    });
    const assignees = Array.from(assigneeMap.values());

    return {
      id: campaign.id,
      name: campaign.name,
      flagged: campaign.flagged ?? false,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      createdBy: campaign.createdBy,
      totalLeads: allLeads.length,
      myLeads: myLeads.length,
      calledLeads: calledCount,
      progress,
      assignees,
    };
  });

  return result;
};
