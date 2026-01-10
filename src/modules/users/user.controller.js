import * as service from "./user.service.js";

export const getMe = async (req, res, next) => {
  try {
    const user = await service.getMe(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const users = await service.listUsers(req.user);
    res.json(users);
  } catch (err) {
    next(err);
  }
};

export const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await service.toggleUserStatus(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};
