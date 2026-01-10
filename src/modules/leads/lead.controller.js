import * as service from "./lead.service.js";
import { uploadLeadsFromExcel } from "./lead.upload.js";
import { escalateOverdueLeads } from "./lead.escalation.js";
import { getLeaderboardDate, applyBadgesAndLevels } from "./lead.validation.js";
import { getPerformanceScores } from "./performance.service.js";

export const getMyLeads = async (req, res, next) => {
  try {
    const leads = await service.getMyLeads(req.user.id);
    res.json(leads);
  } catch (e) {
    next(e);
  }
};

export const getLeadById = async (req, res, next) => {
  try {
    const lead = await service.getLeadById(req.params.id);
    res.json(lead);
  } catch (e) {
    next(e);
  }
};

export const logCall = async (req, res, next) => {
  try {
    const { callOutcome, remark, followUpAt } = req.body;

    const result = await service.logCall({
      userId: req.user.id,
      leadId: req.params.id,
      callOutcome,
      remark,
      followUpAt,
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const changeStatus = async (req, res, next) => {
  try {
    const { status, remark } = req.body;

    const result = await service.changeStatus(
      req.user.id,
      req.params.id,
      status,
      remark
    );

    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const uploadLeads = async (req, res, next) => {
  try {
    const result = await uploadLeadsFromExcel(req.file.path, req.user);
    res.json({
      message: "Leads uploaded",
      inserted: result.count,
    });
  } catch (e) {
    next(e);
  }
};

export const getKanban = async (req, res, next) => {
  try {
    const data = await service.getKanban(req.user.teamId);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const fromDate = getLeaderboardDate(req.params.range);
    const data = await service.getLeaderboard(req.user.teamId, fromDate);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const reassignLeads = async (req, res, next) => {
  try {
    const { leadIds, employeeIds } = req.body;

    const result = await service.reassignLeads({
      manager: req.user,
      leadIds,
      employeeIds,
    });

    res.json({
      message: "Leads reassigned successfully",
      reassigned: result,
    });
  } catch (e) {
    next(e);
  }
};

export const getLeadGroups = async (req, res, next) => {
  try {
    const groups = await service.getLeadGroups(req.user.teamId);
    res.json(groups);
  } catch (e) {
    next(e);
  }
};

export const getTodayFollowUps = async (req, res, next) => {
  try {
    const data = await service.getTodayFollowUps(req.user);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getUpcomingFollowUps = async (req, res, next) => {
  try {
    const data = await service.getUpcomingFollowUps(req.user);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getOverdueFollowUps = async (req, res, next) => {
  try {
    const data = await service.getOverdueFollowUps(req.user);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const escalateOverdue = async (req, res, next) => {
  try {
    const count = await escalateOverdueLeads(req.user.teamId);
    res.json({
      message: "Overdue leads escalated",
      count,
    });
  } catch (e) {
    next(e);
  }
};

export const getPerformance = async (req, res, next) => {
  try {
    const fromDate = getLeaderboardDate(req.params.range);

    const scores = await getPerformanceScores(req.user.teamId, fromDate);

    const finalData = applyBadgesAndLevels(scores);

    res.json(finalData);
  } catch (e) {
    next(e);
  }
};
