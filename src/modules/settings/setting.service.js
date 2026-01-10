import prisma from "../../config/db.js";
import { DEFAULT_SETTINGS } from "./setting.defaults.js";

export const getSettings = async (scope, teamId) => {
  const rows = await prisma.setting.findMany({
    where: {
      scope,
      teamId: scope === "TEAM" ? teamId : null,
    },
  });

  const settings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return settings;
};

export const updateSetting = async ({ scope, teamId, key, value }) => {
  return prisma.setting.upsert({
    where: {
      scope_teamId_key: {
        scope,
        teamId: scope === "TEAM" ? teamId : null,
        key,
      },
    },
    update: { value },
    create: {
      scope,
      teamId: scope === "TEAM" ? teamId : null,
      key,
      value,
    },
  });
};
