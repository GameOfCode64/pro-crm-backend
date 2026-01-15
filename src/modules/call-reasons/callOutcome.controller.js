import * as service from "./callOutcome.service.js";

export const createReason = async (req, res, next) => {
  try {
    const reason = await service.createReason({
      teamId: req.user.teamId,
      ...req.body,
    });
    res.status(201).json(reason);
  } catch (e) {
    next(e);
  }
};

export const getReasons = async (req, res, next) => {
  try {
    const reasons = await service.getReasons(req.user.teamId);
    res.json(reasons);
  } catch (e) {
    next(e);
  }
};

export const toggleReason = async (req, res, next) => {
  try {
    const result = await service.toggleReason(req.params.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const getReasonsByOutcome = async (req, res, next) => {
  try {
    const { outcome } = req.params;

    const reasons = await service.getReasonsByOutcome({
      teamId: req.user.teamId,
      outcome,
    });

    res.json(reasons);
  } catch (e) {
    next(e);
  }
};

export const getOutcomeReasons = async (req, res) => {
  const reasons = await prisma.outcomeReason.findMany({
    where: {
      teamId: req.user.teamId,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(reasons);
};

export const createOutcomeReason = async (req, res) => {
  const { outcome, label } = req.body;

  const reason = await prisma.outcomeReason.create({
    data: {
      teamId: req.user.teamId,
      outcome,
      label,
    },
  });

  res.json(reason);
};

export const updateOutcomeReason = async (req, res) => {
  const { label, isActive } = req.body;

  const updated = await prisma.outcomeReason.update({
    where: { id: req.params.id },
    data: { label, isActive },
  });

  res.json(updated);
};

export const deleteOutcomeReason = async (req, res) => {
  await prisma.outcomeReason.update({
    where: { id: req.params.id },
    data: { isActive: false }, // 🔒 soft delete
  });

  res.json({ message: "Reason disabled" });
};
