export const getLeaderboardDate = (range) => {
  const now = new Date();

  switch (range) {
    case "today":
      now.setHours(0, 0, 0, 0);
      return now;

    case "week": {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    }

    case "month": {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    }

    case "year": {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }

    default:
      throw new Error("Invalid leaderboard range");
  }
};

/**
 * Apply levels & badges based on performance score
 * Pure function → safe, testable, reusable
 */
export const applyBadgesAndLevels = (score) => {
  let level = "Beginner";
  let badge = "New Joiner";

  if (score >= 20 && score < 50) {
    level = "Intermediate";
    badge = "Rising Star";
  }

  if (score >= 50 && score < 100) {
    level = "Advanced";
    badge = "Top Performer";
  }

  if (score >= 100) {
    level = "Expert";
    badge = "Sales Champion";
  }

  return {
    level,
    badge,
  };
};
