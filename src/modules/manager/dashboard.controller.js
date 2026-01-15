import { getManagerDashboardService } from "./dashboard.service.js";

export const getManagerDashboard = async (req, res, next) => {
  try {
    const { range = "today" } = req.query;
    const data = await getManagerDashboardService(req.user, range);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
