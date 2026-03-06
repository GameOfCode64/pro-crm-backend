// Update your lead.routes.js to include these routes

import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";

import {
  getLeadsList,
  getLeadById,
  assignLeads,
  countCampaignLeads,
  bulkUpdateCampaign,
  bulkUpdateSelected,
  getLeadActivities,
  getLeadForms,
  getMyLeads,
  completeLead,
  searchLeadsController,
} from "./lead.controller.js";

const router = express.Router();

/* ================= EMPLOYEE/CALLER ROUTES ================= */

router.get("/my-leads", auth, role("EMPLOYEE"), getMyLeads);
router.post("/complete", auth, role("EMPLOYEE"), completeLead);

/* ================= MANAGER ROUTES ================= */

router.get("/", auth, role("MANAGER"), getLeadsList);
router.get("/count", auth, role("MANAGER"), countCampaignLeads);
router.get(
  "/search",
  auth,
  role("MANAGER", "EMPLOYEE"), // both roles can search
  searchLeadsController,
);
router.get("/:id", auth, role("MANAGER", "EMPLOYEE"), getLeadById);

/* ================= LEAD ACTIVITIES & FORMS ================= */

router.get(
  "/:id/activities",
  auth,
  role("MANAGER", "EMPLOYEE"),
  getLeadActivities,
);
router.get("/:id/forms", auth, role("MANAGER", "EMPLOYEE"), getLeadForms);

/* ================= BULK OPERATIONS ================= */

router.post("/bulk-update-selected", auth, role("MANAGER"), bulkUpdateSelected);
router.post("/bulk-update-campaign", auth, role("MANAGER"), bulkUpdateCampaign);

/* ================= LEGACY ASSIGN ================= */

router.post("/assign", auth, role("MANAGER"), assignLeads);

export default router;
