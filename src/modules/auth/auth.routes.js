import express from "express";

import { login, createUser } from "./auth.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";

const router = express.Router();

/**
 * PUBLIC
 */
router.post("/login", login);

/**
 * PROTECTED
 */
router.post(
  "/create",
  authMiddleware,
  roleMiddleware("ADMIN", "MANAGER"),
  createUser
);

export default router;
