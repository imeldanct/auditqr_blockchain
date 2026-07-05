import express from "express";
import { generateQRCodes, getParentQR } from "../controllers/qrController";
import { authenticateSME } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/products/:productId/generate-qr", authenticateSME, generateQRCodes);
router.get("/qr/:parentQRID", authenticateSME, getParentQR);

export default router;
