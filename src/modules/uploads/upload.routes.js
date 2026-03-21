import express from "express";
import multer from "multer";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";

import {
  createUpload,
  getUploadSession,
  selectSheet,
  saveMappings,
  saveDuplicateRules,
  assignCampaign,
  confirmUpload,
} from "./upload.controller.js";

const router = express.Router();
const upload = multer({ dest: "uploads/tmp" });

const mgr = [auth, role("MANAGER")];

router.post("/", ...mgr, upload.single("file"), createUpload);
router.get("/:id", ...mgr, getUploadSession);
router.post("/:id/select-sheet", ...mgr, selectSheet); // ← NEW
router.post("/:id/mappings", ...mgr, saveMappings);
router.post("/:id/duplicates", ...mgr, saveDuplicateRules);
router.post("/:id/campaign", ...mgr, assignCampaign);
router.post("/:id/confirm", ...mgr, confirmUpload);

export default router;
