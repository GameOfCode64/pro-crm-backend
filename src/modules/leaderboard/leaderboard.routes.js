import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";
import { getLeaderboard } from "./leaderboard.controller.js";

const router = express.Router();

router.get("/:range", auth, role("EMPLOYEE", "MANAGER"), getLeaderboard);

export default router;
