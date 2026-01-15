import prisma from "../../config/db.js";

/**
 * LEVEL CONFIG
 */
const LEVELS = [
  { name: "TRAINEE", min: 0 },
  { name: "BRONZE", min: 50 },
  { name: "SILVER", min: 100 },
  { name: "GOLD", min: 200 },
  { name: "PLATINUM", min: 350 },
];

const SCORE_RULES = {
  CALL: 1,
  INTERESTED: 5,
  FOLLOW_UP: 2,
  WON: 20,
};

const BADGES = {
  CALL_WARRIOR: (b) => b.CALL >= 100,
  CONNECTOR: (b) => b.INTERESTED >= 10,
  CLOSER: (b) => b.WON >= 3,
};

const applyLevelsAndBadges = (scores) => {
  return Object.values(scores)
    .map((user) => {
      const level =
        [...LEVELS].reverse().find((l) => user.score >= l.min)?.name ||
        "TRAINEE";

      const badges = Object.entries(BADGES)
        .filter(([, rule]) => rule(user.breakdown))
        .map(([name]) => name);

      return { ...user, level, badges };
    })
    .sort((a, b) => b.score - a.score);
};

/**
 * ✅ FINAL, SAFE LEADERBOARD
 */
export const getTeamLeaderboard = async (teamId, fromDate) => {
  /**
   * 1️⃣ Get ALL active employees in team
   */
  const employees = await prisma.user.findMany({
    where: {
      teamId,
      role: "EMPLOYEE",
      isActive: true,
    },
    select: { id: true, name: true },
  });

  /**
   * 2️⃣ Initialize everyone with ZERO
   */
  const scores = {};
  for (const emp of employees) {
    scores[emp.id] = {
      userId: emp.id,
      name: emp.name,
      score: 0,
      breakdown: {
        CALL: 0,
        INTERESTED: 0,
        FOLLOW_UP: 0,
        WON: 0,
      },
    };
  }

  /**
   * 3️⃣ Fetch call activities
   */
  const activities = await prisma.leadActivity.findMany({
    where: {
      createdAt: { gte: fromDate },
      type: "CALL",
      lead: { teamId },
    },
    include: {
      outcome: { select: { name: true, stage: true } },
    },
  });

  /**
   * 4️⃣ Apply scores
   */
  for (const act of activities) {
    if (!scores[act.userId]) continue;

    const user = scores[act.userId];

    user.breakdown.CALL += 1;
    user.score += SCORE_RULES.CALL;

    if (!act.outcome) continue;

    if (act.outcome.name === "INTERESTED") {
      user.breakdown.INTERESTED += 1;
      user.score += SCORE_RULES.INTERESTED;
    }

    if (act.outcome.stage === "ACTIVE") {
      user.breakdown.FOLLOW_UP += 1;
      user.score += SCORE_RULES.FOLLOW_UP;
    }

    if (act.outcome.name === "WON") {
      user.breakdown.WON += 1;
      user.score += SCORE_RULES.WON;
    }
  }

  /**
   * 5️⃣ Apply level + badges
   */
  return applyLevelsAndBadges(scores);
};
