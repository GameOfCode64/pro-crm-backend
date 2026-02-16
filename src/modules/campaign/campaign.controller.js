import {
  getCampaignsService,
  createCampaignService,
} from "./campaign.service.js";

/**
 * GET /campaigns
 */
export const getCampaigns = async (req, res, next) => {
  try {
    const { teamId } = req.user;

    if (!teamId) {
      return res.status(400).json({ message: "User has no team" });
    }

    const campaigns = await getCampaignsService(teamId);
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /campaigns
 */
export const createCampaign = async (req, res, next) => {
  try {
    const { name, description, source } = req.body;
    const { teamId, id: userId } = req.user;

    if (!teamId) {
      return res.status(400).json({ message: "User has no team" });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Campaign name is required" });
    }

    const campaign = await createCampaignService(teamId, userId, {
      name,
      description,
      source,
    });

    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
};
