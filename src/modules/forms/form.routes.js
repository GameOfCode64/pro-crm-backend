import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import roleMiddleware from "../../middlewares/role.middleware.js";
import {
  createForm,
  getForms,
  getFormById,
  submitForm,
  getLeadForms,
} from "./form.controller.js";

const router = express.Router();

/**
 * MANAGER
 */
router.post("/", authMiddleware, roleMiddleware("MANAGER"), createForm);

router.get("/", authMiddleware, roleMiddleware("MANAGER"), getForms);

/**
 * EMPLOYEE
 */
router.get(
  "/lead/:leadId",
  authMiddleware,
  roleMiddleware("EMPLOYEE", "MANAGER"),
  getLeadForms
);

router.post(
  "/:formId/submit/:leadId",
  authMiddleware,
  roleMiddleware("EMPLOYEE"),
  submitForm
);

export default router;
