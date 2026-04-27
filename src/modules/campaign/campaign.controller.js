import {
  getCampaignsService,
  createCampaignService,
  getMyCampaignsService,
  deleteCampaignService,
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

export const deleteCampaign = async (req, res, next) => {
  try {
    const result = await deleteCampaignService({
      id: req.params.id,
      teamId: req.user.teamId, // scoped to manager's team
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

export const getMyCampaignsController = async (req, res) => {
  try {
    const campaigns = await getMyCampaignsService({
      userId: req.user.id,
      teamId: req.user.teamId,
    });

    return res.json({ campaigns });
  } catch (error) {
    console.error("getMyCampaignsController error:", error);
    return res.status(500).json({ error: "Failed to fetch campaigns" });
  }
};
