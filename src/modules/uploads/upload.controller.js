import prisma from "../../config/db.js";
import { parseUploadFile, validateMappings } from "./upload.utils.js";

import {
  createUploadSession,
  selectSheetService,
  saveMappingsService,
  saveDuplicateRulesService,
  assignCampaignService,
  confirmUploadService,
} from "./upload.service.js";

/**
 * STEP 1: Upload file
 * Returns headers, sampleRows, AND sheets[] so frontend
 * knows whether to show the sheet picker.
 */
export const createUpload = async (req, res, next) => {
  try {
    if (!req.file) throw new Error("File is required");

    const { headers, sampleRows, sheets } = await parseUploadFile(
      req.file.path,
    );

    const upload = await createUploadSession({
      fileName: req.file.originalname,
      filePath: req.file.path,
      headers,
      sampleRows,
      teamId: req.user.teamId,
      createdById: req.user.id,
      status: "UPLOADED",
    });

    // Return sheets so frontend can decide to show sheet picker
    res.status(201).json({ ...upload, sheets });
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
      include: { mappings: true, duplicateRules: true, campaign: true },
    });

    if (!upload) return res.status(404).json({ message: "Upload not found" });

    // Re-derive sheets from the file so the frontend always has them
    try {
      const { sheets } = await parseUploadFile(upload.filePath);
      return res.json({ ...upload, sheets });
    } catch (_) {
      // File might be gone — return session without sheets
      return res.json(upload);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * STEP 1.5: Select sheet (multi-sheet Excel only)
 * Body: { sheetName: string }
 */
export const selectSheet = async (req, res, next) => {
  try {
    const { sheetName } = req.body;
    if (!sheetName)
      return res.status(400).json({ error: "sheetName is required" });

    const result = await selectSheetService(req.params.id, sheetName);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

/**
 * STEP 2: Save field mappings
 */
export const saveMappings = async (req, res, next) => {
  try {
    const { mappings } = req.body;
    validateMappings(mappings);
    res.json(await saveMappingsService(req.params.id, mappings));
  } catch (err) {
    next(err);
  }
};

/**
 * STEP 3: Save duplicate rule
 * Body: { field: string, action: "SKIP" | "UPDATE" | "KEEP_BOTH" }
 */
export const saveDuplicateRules = async (req, res, next) => {
  try {
    const { field, action } = req.body;
    if (!field || !action)
      return res.status(400).json({ message: "field and action are required" });

    res.json(await saveDuplicateRulesService(req.params.id, field, action));
  } catch (err) {
    next(err);
  }
};

/**
 * STEP 4: Assign campaign
 */
export const assignCampaign = async (req, res, next) => {
  try {
    res.json(await assignCampaignService(req.params.id, req.body, req.user));
  } catch (err) {
    next(err);
  }
};

/**
 * STEP 5: Confirm & import leads
 */
export const confirmUpload = async (req, res, next) => {
  try {
    res.json(await confirmUploadService(req.params.id, req.user));
  } catch (err) {
    next(err);
  }
};
