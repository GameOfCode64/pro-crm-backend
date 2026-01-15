import express from "express";
import auth from "../../middlewares/auth.middleware.js";
import role from "../../middlewares/role.middleware.js";
import {
  createForm,
  getActiveForm,
  getFormResponse,
  submitFormResponse,
} from "./form.controller.js";

const router = express.Router();

// MANAGER
router.post("/", auth, role("MANAGER"), createForm);

// MANAGER + EMPLOYEE
router.get("/active", auth, getActiveForm);

// EMPLOYEE
router.get("/response/:leadId", auth, role("EMPLOYEE"), getFormResponse);
router.post("/submit", auth, role("EMPLOYEE"), submitFormResponse);

export default router;
