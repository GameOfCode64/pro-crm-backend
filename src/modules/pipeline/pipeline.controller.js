import prisma from "../../config/db.js";
import { ensurePipelineDefaults } from "./pipeline.seed.js";
import { createOutcomeService } from "./pipeline.service.js";

export const getPipeline = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user?.teamId) {
      return res.status(400).json({
        message: "User has no team assigned",
        initialStage: [],
        activeStage: [],
        closedStage: [],
      });
    }

    // 🔥 ENSURE DEFAULTS (SAFE TO CALL MULTIPLE TIMES)
    await ensurePipelineDefaults(user.teamId);

    const outcomes = await prisma.callOutcomeConfig.findMany({
      where: { teamId: user.teamId },
      include: {
        reasons: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      initialStage: ["FRESH"],
      activeStage: outcomes.filter((o) => o.stage === "ACTIVE"),
      closedStage: outcomes.filter((o) => o.stage === "CLOSED"),
    });
  } catch (err) {
    next(err);
  }
};

export const createOutcome = async (req, res, next) => {
  try {
    const { name, stage, reasons = [] } = req.body; // Add stage here

    const manager = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { teamId: true, role: true },
    });

    if (!manager?.teamId || manager.role !== "MANAGER") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const outcome = await createOutcomeService(manager.teamId, {
      name,
      stage, // Pass stage to service
      reasons,
    });

    res.status(201).json(outcome);
  } catch (err) {
    next(err);
  }
};

export const updateOutcome = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, reasons = [] } = req.body;

    await prisma.callOutcomeReason.deleteMany({
      where: { outcomeId: id },
    });

    const updated = await prisma.callOutcomeConfig.update({
      where: { id },
      data: {
        name,
        reasons: {
          create: reasons.map((label) => ({ label })),
        },
      },
      include: { reasons: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const deleteOutcome = async (req, res, next) => {
  try {
    const { id } = req.params;

    const manager = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { teamId: true, role: true },
    });

    if (!manager?.teamId || manager.role !== "MANAGER") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Check if outcome exists and belongs to this team
    const outcome = await prisma.callOutcomeConfig.findFirst({
      where: { id, teamId: manager.teamId },
    });

    if (!outcome) {
      return res.status(404).json({ message: "Outcome not found" });
    }

    // Check if it's a system outcome
    if (outcome.isSystem) {
      return res.status(400).json({ message: "Cannot delete system outcomes" });
    }

    // Delete the outcome (cascade will delete reasons)
    await prisma.callOutcomeConfig.delete({
      where: { id },
    });

    res.json({ message: "Outcome deleted successfully" });
  } catch (err) {
    next(err);
  }
};
