import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";

import {
  getCampaigns,
  createCampaign,
  getMyCampaignsController,
} from "./campaign.controller.js";

const router = express.Router();

// List campaigns (Manager + Employee)
router.get("/", auth, role("MANAGER", "EMPLOYEE"), getCampaigns);

// Create campaign (Manager only)
router.post("/", auth, role("MANAGER"), createCampaign);

router.get("/my-campaigns", auth, role("EMPLOYEE"), getMyCampaignsController);

export default router;
