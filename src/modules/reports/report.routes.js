import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";
import { exportAttendance, exportLeads } from "./report.controller.js";

const router = express.Router();

router.post("/attendance/export", auth, role("MANAGER"), exportAttendance);

router.post("/leads/export", auth, role("MANAGER"), exportLeads);
export default router;
