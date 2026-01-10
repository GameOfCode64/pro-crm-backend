import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import { getTeamSettings, updateTeamSetting } from "./setting.controller.js";

const router = express.Router();

router.get("/team", authMiddleware, roleMiddleware("MANAGER"), getTeamSettings);

router.post(
  "/team",
  authMiddleware,
  roleMiddleware("MANAGER"),
  updateTeamSetting
);

export default router;
