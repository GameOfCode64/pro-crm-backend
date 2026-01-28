import * as service from "./lead.service.js";
import { uploadLeadsFromExcel } from "./lead.upload.js";
import { escalateOverdueLeads } from "./lead.escalation.js";
import { getLeaderboardDate, applyBadgesAndLevels } from "./lead.validation.js";
import { getPerformanceScores } from "./performance.service.js";

/**
 * ======================================================
 * EMPLOYEE
 * ======================================================
 */

export const getMyLeads = async (req, res, next) => {
  try {
    const leads = await service.getMyLeads(req.user.id);
    res.json(leads);
  } catch (err) {
    next(err);
  }
};

export const getLeadById = async (req, res, next) => {
  try {
    const lead = await service.getLeadById(req.params.id);
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

export const logCall = async (req, res, next) => {
  try {
    const { outcomeId, outcomeReasonId, remark, followUpAt } = req.body;

    if (!outcomeId) {
      return res.status(400).json({
        message: "Call outcome is required",
      });
    }

    const result = await service.logCall({
      userId: req.user.id,
      leadId: req.params.id,
      outcomeId,
      outcomeReasonId: outcomeReasonId ?? null,
      remark: remark ?? null,
      followUpAt,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const completeLead = async (req, res, next) => {
  try {
    const result = await service.completeLeadService({
      userId: req.user.id,
      leadId: req.params.id,
      ...req.body,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const changeStatus = async (req, res, next) => {
  try {
    const { status, remark } = req.body;

    const result = await service.changeStatus(
      req.user.id,
      req.params.id,
      status,
      remark,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * ======================================================
 * MANAGER – LEADS LIST & FILTERS
 * ======================================================
 */

export const getLeads = async (req, res, next) => {
  try {
    const { statuses, outcomes, employeeIds, page = 1, limit = 50 } = req.query;

    const data = await service.getFilteredLeads({
      manager: req.user,
      statuses,
      outcomes,
      employeeIds,
      page: Number(page),
      limit: Number(limit),
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
};

/**
 * ======================================================
 * MANAGER – ASSIGN LEADS PAGE (NEW)
 * ======================================================
 */

export const getAssignLeadsPage = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, employeeIds, outcomes } = req.query;

    const data = await service.getAssignLeadsPageService({
      manager: req.user,
      page: Number(page),
      limit: Number(limit),
      search,
      employeeIds,
      outcomes,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getAssignLeadsAnalytics = async (req, res, next) => {
  try {
    const analytics = await service.getAssignLeadsAnalyticsService(req.user);
    res.json(analytics);
  } catch (err) {
    next(err);
  }
};

/**
 * ======================================================
 * MANAGER – BULK ACTIONS
 * ======================================================
 */

export const reassignLeads = async (req, res, next) => {
  try {
    const { leadIds, employeeIds } = req.body;

    const count = await service.reassignLeadsService({
      manager: req.user,
      leadIds,
      employeeIds,
    });

    res.json({
      message: "Leads reassigned successfully",
      count,
    });
  } catch (err) {
    next(err);
  }
};

export const uploadLeads = async (req, res, next) => {
  try {
    const result = await uploadLeadsFromExcel(req.file.path, req.user);

    res.json({
      message: "Leads uploaded successfully",
      inserted: result.count,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ======================================================
 * FOLLOW UPS
 * ======================================================
 */

export const getTodayFollowUps = async (req, res, next) => {
  try {
    const data = await service.getTodayFollowUps(req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getUpcomingFollowUps = async (req, res, next) => {
  try {
    const data = await service.getUpcomingFollowUps(req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getOverdueFollowUps = async (req, res, next) => {
  try {
    const data = await service.getOverdueFollowUps(req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const escalateOverdue = async (req, res, next) => {
  try {
    const count = await escalateOverdueLeads(req.user.teamId);

    res.json({
      message: "Overdue leads escalated",
      count,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ======================================================
 * ANALYTICS / DASHBOARD
 * ======================================================
 */

export const getKanban = async (req, res, next) => {
  try {
    const data = await service.getKanban(req.user.teamId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getLeadGroups = async (req, res, next) => {
  try {
    const groups = await service.getLeadGroups(req.user.teamId);
    res.json(groups);
  } catch (err) {
    next(err);
  }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const fromDate = getLeaderboardDate(req.params.range);
    const data = await service.getLeaderboard(req.user.teamId, fromDate);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getPerformance = async (req, res, next) => {
  try {
    const fromDate = getLeaderboardDate(req.params.range);

    const scores = await getPerformanceScores(req.user.teamId, fromDate);

    const finalData = applyBadgesAndLevels(scores);
    res.json(finalData);
  } catch (err) {
    next(err);
  }
};
