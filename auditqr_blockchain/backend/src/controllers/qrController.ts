import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

export const generateQRCodes = async (req: AuthRequest, res: Response): Promise<any> => {
  if (!req.sme) return res.status(401).json({ error: "Unauthorized" });

  const productId = req.params.productId as string;
  const { quantity } = req.body;

  if (quantity === undefined || quantity === null || quantity < 0 || quantity > 500) {
    return res.status(400).json({ error: "Quantity must be between 0 and 500." });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { productID: productId, smeID: req.sme!.smeId },
    });

    if (!product) {
      return res
        .status(404)
        .json({ error: "Product not found or does not belong to you." });
    }

    const childRecords = Array.from({ length: quantity }, (_, i) => {
      const id = randomUUID();
      return {
        childQRID: id,
        itemNumber: i + 1,
        qrData: `auditqr://verify?id=${id}`,
      };
    });

    const parentQR = await prisma.$transaction(async (tx) => {
      const parentQRID = randomUUID();
      const parent = await tx.parentQRCode.create({
        data: {
          parentQRID,
          productID: productId,
          qrData: `auditqr://product?id=${parentQRID}`,
        },
      });
      await tx.childQRCode.createMany({
        data: childRecords.map((r) => ({ ...r, parentQRID: parent.parentQRID })),
      });
      return parent;
    });

    res.status(201).json({
      message: "QR codes generated successfully.",
      parentQRID: parentQR.parentQRID,
      quantity: childRecords.length,
      productName: product.productName,
    });
  } catch (error) {
    console.error("QR Generation Error:", error);
    res.status(500).json({ error: "Internal server error during QR generation." });
  }
};

export const getParentQR = async (req: AuthRequest, res: Response): Promise<any> => {
  if (!req.sme) return res.status(401).json({ error: "Unauthorized" });

  const parentQRID = req.params.parentQRID as string;

  try {
    const parentQR = await prisma.parentQRCode.findUnique({
      where: { parentQRID },
    });

    if (!parentQR) {
      return res.status(404).json({ error: "Parent QR not found." });
    }

    const product = await prisma.product.findUnique({
      where: { productID: parentQR.productID },
    });
    if (!product || product.smeID !== req.sme!.smeId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const childQRs = await prisma.childQRCode.findMany({
      where: { parentQRID },
      select: { childQRID: true, itemNumber: true, qrData: true },
    });

    res.status(200).json({
      parentQRID: parentQR.parentQRID,
      productName: product.productName,
      quantity: childQRs.length,
      childQRs,
    });
  } catch (error) {
    console.error("Fetch QR Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
