import express from "express";
import { recoverAuditTrail } from "../controllers/recoveryController";

const router = express.Router();

// This route reads public Devnet memo transactions only. It does not query Prisma.
router.get("/internal/recover-audit", recoverAuditTrail);

export default router;
