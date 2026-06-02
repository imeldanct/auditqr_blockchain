import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const recordScan = async (req: Request, res: Response): Promise<any> => {
  const { childQRID } = req.body;

  if (!childQRID) {
    return res.status(400).json({ error: "childQRID is required." });
  }

  try {
    const childQR = await prisma.childQRCode.findUnique({
      where: { childQRID },
      include: {
        parentQR: {
          include: {
            product: {
              include: { sme: true },
            },
          },
        },
      },
    });

    if (!childQR) {
      return res
        .status(404)
        .json({ error: "QR code not found. This product cannot be verified." });
    }

    // Determine role and next stage from currentStage
    const stage = childQR.currentStage;
    let scannerRole: string;
    let nextStage: "transit" | "delivered";
    let isFirstScan = false;
    let isRetailerScan = false;

    if (stage === "pending") {
      scannerRole = "transporter";
      nextStage = "transit";
      isFirstScan = true;
    } else if (stage === "transit") {
      // Guard: handoff code must be confirmed before retailer scan advances the stage
      const lastTransporterScan = await prisma.scanEvent.findFirst({
        where: { childQRID, scannerRole: "transporter" },
        orderBy: { timestamp: "desc" },
        include: { handoffCode: true },
      });

      if (!lastTransporterScan?.handoffCode?.isUsed) {
        return res.status(403).json({
          error:
            "Handoff not yet confirmed. The transporter must share the handoff code with you first.",
        });
      }

      scannerRole = "retailer";
      nextStage = "delivered";
      isRetailerScan = true;
    } else {
      // already delivered — consumer/public view only, no stage change
      return res.status(200).json({
        isFirstScan: false,
        isRetailerScan: false,
        currentStage: "delivered",
        product: {
          productName: childQR.parentQR.product.productName,
          description: childQR.parentQR.product.description,
          businessName: childQR.parentQR.product.sme.businessName,
          rcNumber: childQR.parentQR.product.sme.rcNumber,
          isVerified: childQR.parentQR.product.sme.isVerified,
        },
        itemNumber: childQR.itemNumber,
      });
    }

    // Record scan and advance stage atomically
    const [scanEvent] = await prisma.$transaction([
      prisma.scanEvent.create({
        data: {
          childQRID,
          scannerRole,
          ipLocation: (req.ip || "unknown").replace("::ffff:", ""),
        },
      }),
      prisma.childQRCode.update({
        where: { childQRID },
        data: { currentStage: nextStage },
      }),
    ]);

    res.status(200).json({
      scanId: scanEvent.scanID,
      isFirstScan,
      isRetailerScan,
      currentStage: nextStage,
      product: {
        productName: childQR.parentQR.product.productName,
        description: childQR.parentQR.product.description,
        businessName: childQR.parentQR.product.sme.businessName,
        rcNumber: childQR.parentQR.product.sme.rcNumber,
        isVerified: childQR.parentQR.product.sme.isVerified,
      },
      itemNumber: childQR.itemNumber,
      scanTime: scanEvent.timestamp,
    });
  } catch (error) {
    console.error("Scan Error:", error);
    res.status(500).json({ error: "Internal server error during scan." });
  }
};

function generateHandoffCodeValue(): string {
  // 4-digit numeric — single-use nature is the security, not character space
  return String(Math.floor(1000 + Math.random() * 9000));
}

export const generateHandoffCode = async (req: Request, res: Response): Promise<any> => {
  const scanId = req.params.scanId as string;

  try {
    const scanEvent = await prisma.scanEvent.findUnique({ where: { scanID: scanId } });
    if (!scanEvent) {
      return res.status(404).json({ error: "Scan event not found." });
    }

    // Return existing code if already generated
    const existing = await prisma.handoffCode.findUnique({ where: { scanID: scanId } });
    if (existing) {
      return res.status(200).json({ codeValue: existing.codeValue });
    }

    const codeValue = generateHandoffCodeValue();
    const handoffCode = await prisma.handoffCode.create({
      data: { scanID: scanId, codeValue },
    });

    res.status(201).json({ codeValue: handoffCode.codeValue });
  } catch (error) {
    console.error("Handoff Code Error:", error);
    res.status(500).json({ error: "Internal server error generating handoff code." });
  }
};

export const getScanHistory = async (req: Request, res: Response): Promise<any> => {
  const childQRID = req.params.childQRID as string;

  try {
    const childQR = await prisma.childQRCode.findUnique({
      where: { childQRID },
      include: {
        parentQR: {
          include: {
            product: {
              include: { sme: true },
            },
          },
        },
      },
    });

    if (!childQR) {
      return res.status(404).json({ error: "QR code not found." });
    }

    const scanEvents = await prisma.scanEvent.findMany({
      where: { childQRID },
      orderBy: { timestamp: "asc" },
    });

    res.status(200).json({
      childQRID,
      itemNumber: childQR.itemNumber,
      product: {
        productName: childQR.parentQR.product.productName,
        description: childQR.parentQR.product.description,
        businessName: childQR.parentQR.product.sme.businessName,
        rcNumber: childQR.parentQR.product.sme.rcNumber,
        isVerified: childQR.parentQR.product.sme.isVerified,
      },
      events: scanEvents.map((e) => ({
        scanID: e.scanID,
        scannerRole: e.scannerRole,
        ipLocation: e.ipLocation,
        timestamp: e.timestamp,
      })),
    });
  } catch (error) {
    console.error("Scan History Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const confirmHandoff = async (req: Request, res: Response): Promise<any> => {
  const { codeValue } = req.body;

  if (!codeValue) {
    return res.status(400).json({ error: "codeValue is required." });
  }

  try {
    const handoffCode = await prisma.handoffCode.findFirst({
      where: { codeValue: codeValue.toUpperCase().trim(), isUsed: false },
    });

    if (!handoffCode) {
      return res.status(400).json({ error: "Invalid or already used handoff code." });
    }

    await prisma.handoffCode.update({
      where: { codeID: handoffCode.codeID },
      data: { isUsed: true },
    });

    res.status(200).json({ message: "Handoff confirmed successfully." });
  } catch (error) {
    console.error("Confirm Handoff Error:", error);
    res.status(500).json({ error: "Internal server error confirming handoff." });
  }
};
