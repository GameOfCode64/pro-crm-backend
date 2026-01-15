import * as service from "./dashboard.service.js";

export const getDashboardSummary = async (req, res, next) => {
  try {
    const data = await service.getDashboardSummary(req.user.teamId);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getPerformanceOverview = async (req, res, next) => {
  try {
    const data = await service.getPerformanceOverview(req.user.teamId);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getManagerDashboard = async (req, res, next) => {
  try {
    const { range = "today" } = req.query;
    const data = await service.getManagerDashboardService(req.user, range);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getFollowUpAlerts = async (req, res, next) => {
  try {
    const data = await service.getFollowUpAlerts(req.user);
    res.json(data);
  } catch (e) {
    next(e);
  }
};
