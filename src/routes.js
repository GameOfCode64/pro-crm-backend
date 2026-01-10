import express from "express";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import teamRoutes from "./modules/teams/team.routes.js";
import attendanceRoutes from "./modules/attendance/attendance.routes.js";
import leadRoutes from "./modules/leads/lead.routes.js";
import formRoutes from "./modules/forms/form.routes.js";
import reportRoutes from "./modules/reports/report.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";
import integrationRoutes from "./modules/integrations/integration.routes.js";
import settingRoutes from "./modules/settings/setting.routes.js";

const router = express.Router();

/**
 *  Health
 */

/**
 * AUTH & CORE
 */
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/teams", teamRoutes);

/**
 * OPERATIONS
 */
router.use("/attendance", attendanceRoutes);
router.use("/leads", leadRoutes);

/**
 * BUSINESS MODULES
 */
router.use("/forms", formRoutes);
router.use("/reports", reportRoutes);
router.use("/dashboard", dashboardRoutes);

/**
 * SYSTEM & REAL-TIME
 */
router.use("/notifications", notificationRoutes);
router.use("/audit", auditRoutes);

/**
 * EXTERNAL INTEGRATIONS
 */
router.use("/integrations", integrationRoutes);

/**
 * SETTINGS
 */
router.use("/settings", settingRoutes);

export default router;
