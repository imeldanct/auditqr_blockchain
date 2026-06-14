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
      // Retailer scan. The retailer does not advance the stage by scanning —
      // they must enter the transporter's handoff code to confirm receipt.
      // We only require that the transporter has actually generated a code to
      // share; the stage advance + retailer ScanEvent happen in confirmHandoff.
      const lastTransporterScan = await prisma.scanEvent.findFirst({
        where: { childQRID, scannerRole: "transporter" },
        orderBy: { timestamp: "desc" },
        include: { handoffCode: true },
      });

      if (!lastTransporterScan?.handoffCode) {
        return res.status(403).json({
          error:
            "Handoff code not generated yet. Ask the transporter to generate and share the code first.",
        });
      }

      // Route the retailer to the code-entry screen without recording anything.
      return res.status(200).json({
        isFirstScan: false,
        isRetailerScan: true,
        needsConfirmation: true,
        currentStage: "transit",
        product: {
          productName: childQR.parentQR.product.productName,
          description: childQR.parentQR.product.description,
          businessName: childQR.parentQR.product.sme.businessName,
          rcNumber: childQR.parentQR.product.sme.rcNumber,
          isVerified: childQR.parentQR.product.sme.isVerified,
        },
        itemNumber: childQR.itemNumber,
      });
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
  const { codeValue, childQRID } = req.body;

  if (!codeValue || !childQRID) {
    return res
      .status(400)
      .json({ error: "codeValue and childQRID are required." });
  }

  try {
    const childQR = await prisma.childQRCode.findUnique({
      where: { childQRID },
    });

    if (!childQR) {
      return res.status(404).json({ error: "QR code not found." });
    }

    if (childQR.currentStage !== "transit") {
      // Either nothing to confirm (pending) or already delivered.
      return res.status(400).json({
        error:
          childQR.currentStage === "delivered"
            ? "This item has already been confirmed as delivered."
            : "This item is not awaiting a handoff confirmation.",
      });
    }

    // The code is validated against THIS item's transporter handoff code only —
    // never globally — so codes can collide across items without confusion.
    const transporterScan = await prisma.scanEvent.findFirst({
      where: { childQRID, scannerRole: "transporter" },
      orderBy: { timestamp: "desc" },
      include: { handoffCode: true },
    });

    const handoffCode = transporterScan?.handoffCode;

    if (!handoffCode) {
      return res
        .status(400)
        .json({ error: "No handoff code has been generated for this item yet." });
    }

    if (handoffCode.isUsed) {
      return res.status(400).json({ error: "This handoff code has already been used." });
    }

    if (handoffCode.codeValue !== String(codeValue).trim()) {
      return res.status(400).json({ error: "Invalid handoff code." });
    }

    // Confirm receipt: mark the code used, record the retailer scan, and advance
    // the unit to delivered — atomically, so the chain can never be left partial.
    await prisma.$transaction([
      prisma.handoffCode.update({
        where: { codeID: handoffCode.codeID },
        data: { isUsed: true },
      }),
      prisma.scanEvent.create({
        data: {
          childQRID,
          scannerRole: "retailer",
          ipLocation: (req.ip || "unknown").replace("::ffff:", ""),
        },
      }),
      prisma.childQRCode.update({
        where: { childQRID },
        data: { currentStage: "delivered" },
      }),
    ]);

    res
      .status(200)
      .json({ message: "Handoff confirmed successfully.", currentStage: "delivered" });
  } catch (error) {
    console.error("Confirm Handoff Error:", error);
    res.status(500).json({ error: "Internal server error confirming handoff." });
  }
};
