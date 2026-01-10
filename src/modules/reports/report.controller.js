import * as service from "./report.service.js";
import { parseDateRange } from "./report.validation.js";

export const leadReport = async (req, res, next) => {
  try {
    const dateRange = parseDateRange(req.query);
    const data = await service.leadReport(req.user.teamId, dateRange);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const employeeReport = async (req, res, next) => {
  try {
    const dateRange = parseDateRange(req.query);
    const data = await service.employeeReport(req.user.teamId, dateRange);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const followUpReport = async (req, res, next) => {
  try {
    const data = await service.followUpReport(req.user.teamId);
    res.json(data);
  } catch (e) {
    next(e);
  }
};
