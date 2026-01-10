import express from "express";
import { justdialWebhook, indiamartWebhook } from "./integration.controller.js";

const router = express.Router();

/**
 * PUBLIC WEBHOOK ENDPOINTS
 * (secured via secret token)
 */
router.post("/justdial", justdialWebhook);
router.post("/indiamart", indiamartWebhook);

export default router;
