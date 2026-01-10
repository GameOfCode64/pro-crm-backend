import * as service from "./audit.service.js";

export const listAuditLogs = async (req, res, next) => {
  try {
    const logs = await service.getAuditLogs(req.user, req.query);
    res.json(logs);
  } catch (e) {
    next(e);
  }
};
