import * as service from "./notification.service.js";

export const getMyNotifications = async (req, res, next) => {
  try {
    const data = await service.getMyNotifications(req.user);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const notificationStream = (req, res) => {
  service.registerClient(req.user, res);
};
