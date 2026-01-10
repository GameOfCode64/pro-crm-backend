import * as service from "./setting.service.js";

export const getTeamSettings = async (req, res, next) => {
  try {
    const data = await service.getSettings("TEAM", req.user.teamId);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const updateTeamSetting = async (req, res, next) => {
  try {
    const { key, value } = req.body;

    await service.updateSetting({
      scope: "TEAM",
      teamId: req.user.teamId,
      key,
      value,
    });

    res.json({ message: "Setting updated" });
  } catch (e) {
    next(e);
  }
};
