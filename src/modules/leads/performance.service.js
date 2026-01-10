import prisma from "../../config/db.js";
import { getLeaderboardDate } from "./lead.validation.js";

/**
 * LEVELS CONFIG
 */
const LEVELS = [
  { name: "TRAINEE", min: 0 },
  { name: "BRONZE", min: 50 },
  { name: "SILVER", min: 100 },
  { name: "GOLD", min: 200 },
  { name: "PLATINUM", min: 350 },
];

/**
 * BADGE RULES
 */
const BADGES = {
  CALL_WARRIOR: (b) => b.CALL >= 100,
  CLOSER: (b) => b.WON >= 3,
  CONNECTOR: (b) => b.INTERESTED >= 10,
  FOLLOW_UP_MASTER: (b) => b.CALL_LATER >= 15,
  NEEDS_ATTENTION: (b) => b.OVERDUE_ESCALATED >= 3,
};

/**
 * 🔵 ADVANCED BADGE + LEVEL CALCULATOR
 * (renamed to avoid collision)
 */
const calculateBadgesAndLevels = (scores) => {
  const result = {};

  for (const userId in scores) {
    const { score, breakdown } = scores[userId];

    const level =
      [...LEVELS].reverse().find((l) => score >= l.min)?.name || "TRAINEE";

    const badges = [];

    for (const [badge, rule] of Object.entries(BADGES)) {
      if (rule(breakdown || {})) {
        badges.push(badge);
      }
    }

    result[userId] = {
      score,
      level,
      badges,
      breakdown,
    };
  }

  return result;
};

/**
 * 🔵 PERFORMANCE SCORE SERVICE (PUBLIC EXPORT)
 */
export const getPerformanceScores = async (teamId, range) => {
  const fromDate = getLeaderboardDate(range);

  const activities = await prisma.leadActivity.groupBy({
    by: ["userId", "callOutcome"],
    where: {
      lead: { teamId },
      createdAt: { gte: fromDate },
      type: "CALL",
    },
    _count: { id: true },
  });

  const scores = {};

  for (const row of activities) {
    if (!scores[row.userId]) {
      scores[row.userId] = {
        score: 0,
        breakdown: {
          CALL: 0,
          INTERESTED: 0,
          WON: 0,
          CALL_LATER: 0,
          OVERDUE_ESCALATED: 0,
        },
      };
    }

    scores[row.userId].breakdown.CALL += row._count.id;
    scores[row.userId].score += row._count.id;

    if (row.callOutcome === "INTERESTED") {
      scores[row.userId].breakdown.INTERESTED += row._count.id;
      scores[row.userId].score += row._count.id * 5;
    }
  }

  return calculateBadgesAndLevels(scores);
};
