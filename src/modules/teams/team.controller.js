import * as service from "./team.service.js";

export const createTeam = async (req, res, next) => {
  try {
    const team = await service.createTeam(req.body);
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
};

export const listTeams = async (req, res, next) => {
  try {
    const teams = await service.listTeams(req.user);
    res.json(teams);
  } catch (err) {
    next(err);
  }
};

export const getTeamById = async (req, res, next) => {
  try {
    const team = await service.getTeamById(req.user, req.params.id);
    res.json(team);
  } catch (err) {
    next(err);
  }
};
