import express from "express";
import {
  verifyCACEndpoint,
  registerSME,
  loginSME,
  getProfile,
  getRecentActivity,
  getStats,
  getItemStatus,
} from "../controllers/smeController";
import { authenticateSME } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/verify-cac", verifyCACEndpoint);
router.post("/register", registerSME);
router.post("/login", loginSME);
router.get("/profile", authenticateSME, getProfile);
router.get("/stats", authenticateSME, getStats);
router.get("/recent-activity", authenticateSME, getRecentActivity);
router.get("/items", authenticateSME, getItemStatus);

export default router;
