import express from "express";
import {
  recordScan,
  generateHandoffCode,
  confirmHandoff,
  getScanHistory,
} from "../controllers/scanController";

const router = express.Router();

router.post("/scan", recordScan);
router.post("/scan/:scanId/handoff", generateHandoffCode);
router.post("/handoff/confirm", confirmHandoff);
router.get("/scan/history/:childQRID", getScanHistory);

export default router;
