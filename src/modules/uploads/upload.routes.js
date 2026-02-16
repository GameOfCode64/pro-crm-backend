import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";
import multer from "multer";

import {
  createUpload,
  getUploadSession,
  saveMappings,
  saveDuplicateRules,
  assignCampaign,
  confirmUpload,
} from "./upload.controller.js";

const router = express.Router();

/**
 * IMPORTANT:
 * Use temp folder ONLY for initial upload
 */
const upload = multer({ dest: "uploads/tmp" });

router.post("/", auth, role("MANAGER"), upload.single("file"), createUpload);
router.get("/:id", auth, role("MANAGER"), getUploadSession);
router.post("/:id/mappings", auth, role("MANAGER"), saveMappings);
router.post("/:id/duplicates", auth, role("MANAGER"), saveDuplicateRules);
router.post("/:id/campaign", auth, role("MANAGER"), assignCampaign);
router.post("/:id/confirm", auth, role("MANAGER"), confirmUpload);

export default router;
