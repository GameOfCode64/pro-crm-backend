import * as service from "./integration.service.js";

export const justdialWebhook = async (req, res, next) => {
  try {
    await service.handleIncomingLead("JUSTDIAL", req.body, req.headers);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

export const indiamartWebhook = async (req, res, next) => {
  try {
    await service.handleIncomingLead("INDIAMART", req.body, req.headers);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};
