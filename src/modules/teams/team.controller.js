import * as service from "./team.service.js";
import {
  getEmployeePerformanceService,
  getTeamAnalyticsService,
} from "./team.performance.service.js";

export const createTeam = async (req, res, next) => {
  try {
    res.status(201).json(await service.createTeam(req.body));
  } catch (err) {
    next(err);
  }
};

export const listTeams = async (req, res, next) => {
  try {
    res.json(await service.listTeams(req.user));
  } catch (err) {
    next(err);
  }
};

export const getTeamById = async (req, res, next) => {
  try {
    res.json(await service.getTeamById(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
};

export const addEmployeeToTeam = async (req, res, next) => {
  try {
    res.json(
      await service.addEmployeeToTeam(
        req.user,
        req.params.id,
        req.body.employeeId
      )
    );
  } catch (err) {
    next(err);
  }
};

export const getEmployeePerformance = async (req, res, next) => {
  try {
    res.json(
      await getEmployeePerformanceService(
        req.user,
        req.params.employeeId,
        req.query.range || "today"
      )
    );
  } catch (err) {
    next(err);
  }
};

export const getTeamAnalytics = async (req, res, next) => {
  try {
    res.json(await getTeamAnalyticsService(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
};
