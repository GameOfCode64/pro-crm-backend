import * as service from "./attendance.service.js";

export const clockIn = async (req, res, next) => {
  try {
    const data = await service.clockIn(req.user.id);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

export const clockOut = async (req, res, next) => {
  try {
    const data = await service.clockOut(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const myAttendance = async (req, res, next) => {
  try {
    const records = await service.myAttendance(req.user.id);
    res.json(records);
  } catch (err) {
    next(err);
  }
};

export const teamAttendance = async (req, res, next) => {
  try {
    const records = await service.teamAttendance(req.user);
    res.json(records);
  } catch (err) {
    next(err);
  }
};
