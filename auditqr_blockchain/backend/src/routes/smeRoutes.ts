import express from "express";
import {
  verifyCACEndpoint,
  registerSME,
  loginSME,
  verifyMagicLink,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  updatePassword,
  getRecentActivity,
  getStats,
  getItemStatus,
} from "../controllers/smeController";
import { authenticateSME } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/verify-cac", verifyCACEndpoint);
router.post("/register", registerSME);
router.post("/login", loginSME);
router.get("/auth/magic", verifyMagicLink);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);
router.get("/profile", authenticateSME, getProfile);
router.patch("/profile", authenticateSME, updateProfile);
router.patch("/password", authenticateSME, updatePassword);
router.get("/stats", authenticateSME, getStats);
router.get("/recent-activity", authenticateSME, getRecentActivity);
router.get("/items", authenticateSME, getItemStatus);

export default router;
