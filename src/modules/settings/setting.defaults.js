export const DEFAULT_SETTINGS = {
  LEAD_ASSIGNMENT: {
    strategy: "ROUND_ROBIN",
  },

  ESCALATION: {
    overdueAfterMinutes: 60,
  },

  SCORING: {
    CALL: 1,
    INTERESTED: 5,
    WON: 20,
    LOST: -5,
  },

  DASHBOARD: {
    refreshInterval: 30, // seconds
  },
};
