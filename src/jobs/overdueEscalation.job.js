import cron from "node-cron";
import prisma from "../config/db.js";
import { escalateOverdueLeads } from "../modules/leads/lead.escalation.js";

/**
 * Runs every 15 minutes
 */
cron.schedule("*/15 * * * *", async () => {
  console.log("⏰ Running overdue escalation job");

  const teams = await prisma.team.findMany({
    select: { id: true },
  });

  for (const team of teams) {
    await escalateOverdueLeads(team.id);
  }
});
