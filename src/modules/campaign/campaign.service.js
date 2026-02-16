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
