import prisma from "../../config/db.js";
// import { ensurePipelineDefaults } from "./pipeline.seed.js";
import {
  getPipelineData,
  createOutcomeService,
  updateOutcomeService,
  deleteOutcomeService,
} from "./pipeline.service.js";

/**
 * GET PIPELINE
 */
export const getPipeline = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user?.teamId) {
      return res.json({
        initialStage: [],
        activeStage: [],
        closedStage: [],
      });
    }

    // 🔥 Ensure system defaults exist
    // await ensurePipelineDefaults(user.teamId);

    const pipeline = await getPipelineData(user.teamId);

    res.json(pipeline);
  } catch (err) {
    next(err);
  }
};

/**
 * CREATE OUTCOME
 */
export const createOutcome = async (req, res, next) => {
  try {
    const { key, name, stage, color, reasons = [] } = req.body;

    const manager = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { teamId: true, role: true },
    });

    if (!manager || manager.role !== "MANAGER") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const outcome = await createOutcomeService(manager.teamId, {
      key,
      name,
      stage,
      color,
      reasons,
    });

    res.status(201).json(outcome);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE OUTCOME
 */
export const updateOutcome = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color, reasons = [] } = req.body;

    const updated = await updateOutcomeService(req.user.teamId, id, {
      name,
      color,
      reasons,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE OUTCOME
 */
export const deleteOutcome = async (req, res, next) => {
  try {
    const deleted = await deleteOutcomeService(req.user.teamId, req.params.id);

    res.json({ message: "Outcome deleted", deleted });
  } catch (err) {
    next(err);
  }
};
