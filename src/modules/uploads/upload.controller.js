import fs from "fs";
import path from "path";
import prisma from "../../config/db.js";
import { parseUploadFile, validateMappings } from "./upload.utils.js";

import {
  createUploadSession,
  saveMappingsService,
  saveDuplicateRulesService,
  assignCampaignService,
  confirmUploadService,
} from "./upload.service.js";

/**
 * STEP 1: Upload file
 */
export const createUpload = async (req, res, next) => {
  try {
    if (!req.file) throw new Error("File is required");

    const { headers, sampleRows } = await parseUploadFile(req.file.path);

    const upload = await createUploadSession({
      fileName: req.file.originalname,
      filePath: req.file.path, // ✅ REAL PATH (IMPORTANT)
      headers,
      sampleRows,
      teamId: req.user.teamId,
      createdById: req.user.id,
      status: "UPLOADED",
    });

    res.status(201).json(upload);
  } catch (err) {
    next(err);
  }
};

/**
 * GET upload session
 */
export const getUploadSession = async (req, res, next) => {
  try {
    const upload = await prisma.uploadSession.findUnique({
      where: { id: req.params.id },
      include: {
        mappings: true,
        duplicateRules: true,
        campaign: true,
      },
    });

    if (!upload) {
      return res.status(404).json({ message: "Upload not found" });
    }

    res.json(upload);
  } catch (err) {
    next(err);
  }
};

/**
 * STEP 2: Save mappings
 */
export const saveMappings = async (req, res, next) => {
  try {
    const { mappings } = req.body;

    validateMappings(mappings);

    const upload = await saveMappingsService(req.params.id, mappings);

    res.json(upload);
  } catch (err) {
    next(err);
  }
};

/**
 * STEP 3: Save duplicate rule (SINGLE RULE – UI MATCH)
 */
export const saveDuplicateRules = async (req, res, next) => {
  try {
    const { field, action } = req.body;

    if (!field || !action) {
      return res.status(400).json({
        message: "field and action are required",
      });
    }

    const preview = await saveDuplicateRulesService(
      req.params.id,
      field,
      action,
    );

    res.json(preview);
  } catch (err) {
    next(err);
  }
};

/**
 * STEP 4: Assign campaign
 */
export const assignCampaign = async (req, res, next) => {
  try {
    const upload = await assignCampaignService(
      req.params.id,
      req.body,
      req.user,
    );

    res.json(upload);
  } catch (err) {
    next(err);
  }
};

/**
 * STEP 5: Confirm & import
 */
export const confirmUpload = async (req, res, next) => {
  try {
    const result = await confirmUploadService(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
