import { getLeaderboardService } from "../leads/lead.service.js";

const getLeaderboardDate = (range) => {
  const now = new Date();
  let fromDate;
  switch (range) {
    case "weekly":
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case "month":
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case "yearly":
      fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      fromDate = new Date(0); // Default to epoch if range is invalid
  }
  return fromDate;
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const fromDate = getLeaderboardDate(req.params.range);

    const data = await getLeaderboardService(req.user.teamId, fromDate);

    res.json(data);
  } catch (e) {
    next(e);
  }
};
