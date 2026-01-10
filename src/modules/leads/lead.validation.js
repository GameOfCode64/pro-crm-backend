export const getLeaderboardDate = (range) => {
  const now = new Date();

  if (range === "daily") {
    now.setHours(0, 0, 0, 0);
    return now;
  }

  if (range === "weekly") {
    const day = now.getDay();
    now.setDate(now.getDate() - day);
    now.setHours(0, 0, 0, 0);
    return now;
  }

  if (range === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  throw new Error("Invalid leaderboard range");
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
