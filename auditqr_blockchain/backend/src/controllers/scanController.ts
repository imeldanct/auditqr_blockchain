import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ip(req: Request) {
  return (req.ip || "unknown").replace("::ffff:", "");
}

function productPayload(parentQR: any) {
  return {
    productName: parentQR.product.productName,
    description: parentQR.product.description,
    businessName: parentQR.product.sme.businessName,
    rcNumber: parentQR.product.sme.rcNumber,
    isVerified: parentQR.product.sme.isVerified,
  };
}

export const recordScan = async (req: Request, res: Response): Promise<any> => {
  const { parentQRID } = req.body;

  if (!parentQRID) {
    return res.status(400).json({ error: "parentQRID is required." });
  }

  try {
    const parentQR = await prisma.parentQRCode.findUnique({
      where: { parentQRID },
      include: { product: { include: { sme: true } } },
    });

    if (!parentQR) {
      return res.status(404).json({ error: "QR code not found. This product cannot be verified." });
    }

    const stage = parentQR.currentStage;

    if (stage === "pending") {
      const [scanEvent] = await prisma.$transaction([
        prisma.scanEvent.create({
          data: { parentQRID, scannerRole: "transporter", ipLocation: ip(req) },
        }),
        prisma.parentQRCode.update({
          where: { parentQRID },
          data: { currentStage: "transit" },
        }),
      ]);

      return res.status(200).json({
        scanId: scanEvent.scanID,
        isFirstScan: true,
        isRetailerScan: false,
        currentStage: "transit",
        product: productPayload(parentQR),
        scanTime: scanEvent.timestamp,
      });
    }

    if (stage === "transit") {
      const lastTransporterScan = await prisma.scanEvent.findFirst({
        where: { parentQRID, scannerRole: "transporter" },
        orderBy: { timestamp: "desc" },
        include: { handoffCode: true },
      });

      if (!lastTransporterScan?.handoffCode) {
        return res.status(403).json({
          error: "Handoff code not generated yet. Ask the transporter to generate and share the code first.",
        });
      }

      return res.status(200).json({
        isFirstScan: false,
        isRetailerScan: true,
        needsConfirmation: true,
        currentStage: "transit",
        product: productPayload(parentQR),
      });
    }

    // delivered — read-only
    return res.status(200).json({
      isFirstScan: false,
      isRetailerScan: false,
      currentStage: "delivered",
      product: productPayload(parentQR),
    });
  } catch (error) {
    console.error("Scan Error:", error);
    res.status(500).json({ error: "Internal server error during scan." });
  }
};

function generateHandoffCodeValue(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export const generateHandoffCode = async (req: Request, res: Response): Promise<any> => {
  const scanId = req.params.scanId as string;

  try {
    const scanEvent = await prisma.scanEvent.findUnique({ where: { scanID: scanId } });
    if (!scanEvent) {
      return res.status(404).json({ error: "Scan event not found." });
    }

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

export const confirmHandoff = async (req: Request, res: Response): Promise<any> => {
  const { codeValue, parentQRID } = req.body;

  if (!codeValue || !parentQRID) {
    return res.status(400).json({ error: "codeValue and parentQRID are required." });
  }

  try {
    const parentQR = await prisma.parentQRCode.findUnique({ where: { parentQRID } });

    if (!parentQR) {
      return res.status(404).json({ error: "QR code not found." });
    }

    if (parentQR.currentStage !== "transit") {
      return res.status(400).json({
        error: parentQR.currentStage === "delivered"
          ? "This batch has already been confirmed as delivered."
          : "This batch is not awaiting a handoff confirmation.",
      });
    }

    const transporterScan = await prisma.scanEvent.findFirst({
      where: { parentQRID, scannerRole: "transporter" },
      orderBy: { timestamp: "desc" },
      include: { handoffCode: true },
    });

    const handoffCode = transporterScan?.handoffCode;

    if (!handoffCode) {
      return res.status(400).json({ error: "No handoff code has been generated for this batch yet." });
    }

    if (handoffCode.isUsed) {
      return res.status(400).json({ error: "This handoff code has already been used." });
    }

    if (handoffCode.codeValue !== String(codeValue).trim()) {
      return res.status(400).json({ error: "Invalid handoff code." });
    }

    await prisma.$transaction([
      prisma.handoffCode.update({
        where: { codeID: handoffCode.codeID },
        data: { isUsed: true },
      }),
      prisma.scanEvent.create({
        data: { parentQRID, scannerRole: "retailer", ipLocation: ip(req) },
      }),
      prisma.parentQRCode.update({
        where: { parentQRID },
        data: { currentStage: "delivered" },
      }),
    ]);

    res.status(200).json({ message: "Handoff confirmed successfully.", currentStage: "delivered" });
  } catch (error) {
    console.error("Confirm Handoff Error:", error);
    res.status(500).json({ error: "Internal server error confirming handoff." });
  }
};

export const getScanHistory = async (req: Request, res: Response): Promise<any> => {
  const parentQRID = req.params.parentQRID as string;

  try {
    const parentQR = await prisma.parentQRCode.findUnique({
      where: { parentQRID },
      include: { product: { include: { sme: true } } },
    });

    if (!parentQR) {
      return res.status(404).json({ error: "QR code not found." });
    }

    const scanEvents = await prisma.scanEvent.findMany({
      where: { parentQRID },
      orderBy: { timestamp: "asc" },
    });

    res.status(200).json({
      parentQRID,
      currentStage: parentQR.currentStage,
      genesisAt: parentQR.createdAt,
      product: productPayload(parentQR),
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

export const getJourneyForChildQR = async (req: Request, res: Response): Promise<any> => {
  const childQRID = req.params.childQRID as string;

  try {
    const childQR = await prisma.childQRCode.findUnique({
      where: { childQRID },
      include: {
        parentQR: { include: { product: { include: { sme: true } } } },
      },
    });

    if (!childQR) {
      return res.status(404).json({ error: "QR code not found." });
    }

    const parentQR = childQR.parentQR;

    const scanEvents = await prisma.scanEvent.findMany({
      where: { parentQRID: parentQR.parentQRID },
      orderBy: { timestamp: "asc" },
    });

    res.status(200).json({
      parentQRID: parentQR.parentQRID,
      itemNumber: childQR.itemNumber,
      currentStage: parentQR.currentStage,
      genesisAt: parentQR.createdAt,
      product: productPayload(parentQR),
      events: scanEvents.map((e) => ({
        scanID: e.scanID,
        scannerRole: e.scannerRole,
        ipLocation: e.ipLocation,
        timestamp: e.timestamp,
      })),
    });
  } catch (error) {
    console.error("Child Journey Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
