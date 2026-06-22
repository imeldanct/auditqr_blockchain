import express from "express";
import {
  recordScan,
  generateHandoffCode,
  confirmHandoff,
  getStage,
  getScanHistory,
  getJourneyForChildQR,
} from "../controllers/scanController";

const router = express.Router();

router.post("/scan", recordScan);
router.post("/scan/:scanId/handoff", generateHandoffCode);
router.post("/handoff/confirm", confirmHandoff);
router.get("/scan/stage/:parentQRID", getStage);
router.get("/scan/history/:parentQRID", getScanHistory);
router.get("/scan/child/:childQRID", getJourneyForChildQR);

export default router;
