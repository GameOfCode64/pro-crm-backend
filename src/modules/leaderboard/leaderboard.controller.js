import { getLeaderboardDate } from "../leads/lead.validation.js";
import { getTeamLeaderboard } from "./leaderboard.service.js";

export const getEmployeeLeaderboard = async (req, res, next) => {
  try {
    const fromDate = getLeaderboardDate(req.params.range);

    const data = await getTeamLeaderboard(req.user.teamId, fromDate);

    res.json(data);
  } catch (err) {
    next(err);
  }
};
