import prisma from "../../config/db.js";
import {
  createOrUpdateForm,
  submitFormResponse as submitFormResponseService,
} from "./form.service.js";

/**
 * MANAGER: Create or replace active form
 */
export const createForm = async (req, res, next) => {
  try {
    const manager = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { teamId: true, role: true },
    });

    if (!manager || manager.role !== "MANAGER") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!manager.teamId) {
      return res.status(400).json({ message: "Manager has no team" });
    }

    const form = await createOrUpdateForm({
      teamId: manager.teamId,
      userId: req.user.id,
      name: req.body.name,
      description: req.body.description,
      schema: req.body.schema,
    });

    res.json(form);
  } catch (err) {
    next(err);
  }
};

/**
 * GET active form (employee / manager)
 */
export const getActiveForm = async (req, res, next) => {
  try {
    if (!req.user?.teamId) {
      return res.status(400).json({ message: "User has no team assigned" });
    }

    const form = await prisma.form.findFirst({
      where: {
        teamId: req.user.teamId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(form ?? null);
  } catch (err) {
    next(err);
  }
};

/**
 * EMPLOYEE: Save / update form response
 */
export const submitFormResponse = async (req, res, next) => {
  try {
    const { leadId, values } = req.body;

    if (!leadId || !values) {
      return res.status(400).json({
        message: "leadId and values are required",
      });
    }

    const result = await submitFormResponseService({
      userId: req.user.id,
      leadId,
      values,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * EMPLOYEE: Get today’s response for a lead
 */
export const getFormResponse = async (req, res, next) => {
  try {
    const { leadId } = req.params;

    const response = await prisma.formResponse.findFirst({
      where: {
        leadId,
        userId: req.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(response ?? null);
  } catch (err) {
    next(err);
  }
};
