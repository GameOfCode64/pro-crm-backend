import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";

import { getCampaigns, createCampaign } from "./campaign.controller.js";

const router = express.Router();

// List campaigns (Manager + Employee)
router.get("/", auth, role("MANAGER", "EMPLOYEE"), getCampaigns);

// Create campaign (Manager only)
router.post("/", auth, role("MANAGER"), createCampaign);

export default router;
