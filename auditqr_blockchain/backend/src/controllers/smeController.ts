import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { lookupCAC, LookupResult } from "../services/cacService";

const prisma = new PrismaClient();

export const verifyCACEndpoint = async (req: Request, res: Response): Promise<any> => {
  const { businessName, rcNumber, businessType, registeredAddress } = req.body;

  if (!businessName || !rcNumber) {
    return res.status(400).json({
      error: "Business name and RC Number are required.",
      field: null,
    });
  }

  try {
    const result: LookupResult = await lookupCAC(
      rcNumber,
      businessName,
      businessType,
      registeredAddress,
    );

    if (!result.found) {
      return res.status(400).json({ error: result.error, field: result.field });
    }

    res.status(200).json({ cacDetails: result.cacDetails });
  } catch (error) {
    console.error("CAC Verification Error:", error);
    res
      .status(500)
      .json({ error: "Internal server error during CAC verification.", field: null });
  }
};

export const registerSME = async (req: Request, res: Response): Promise<any> => {
  const { businessName, rcNumber, email, password } = req.body;

  try {
    const existingSME = await prisma.sME.findFirst({
      where: { OR: [{ rcNumber }, { email }] },
    });

    if (existingSME) {
      return res
        .status(400)
        .json({ error: "SME with this RC Number or Email already exists." });
    }

    const verificationResult: LookupResult = await lookupCAC(rcNumber, businessName);

    if (!verificationResult.found) {
      return res.status(400).json({
        error: verificationResult.error,
        field: verificationResult.field,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newSME = await prisma.sME.create({
      data: {
        businessName,
        rcNumber,
        email,
        passwordHash,
        isVerified: true,
      },
    });

    res.status(201).json({
      message: "Document extracted, verified with CAC, and Registration successful.",
      smeId: newSME.smeID,
    });
  } catch (error) {
    console.error("Registration Error:", error);
    res
      .status(500)
      .json({ error: "Internal server error during registration and verification." });
  }
};

export const loginSME = async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  try {
    const sme = await prisma.sME.findUnique({ where: { email } });
    if (!sme) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isPasswordValid = await bcrypt.compare(password, sme.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const secretKey = process.env.JWT_SECRET || "super_secret_auditqr_key_2026";
    const token = jwt.sign(
      { smeId: sme.smeID, email: sme.email, businessName: sme.businessName },
      secretKey,
      { expiresIn: "24h" },
    );

    res.status(200).json({
      message: "Login successful",
      token,
      sme: {
        id: sme.smeID,
        businessName: sme.businessName,
        email: sme.email,
        rcNumber: sme.rcNumber,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error during login." });
  }
};

export const getRecentActivity = async (req: any, res: any): Promise<any> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const scanEvents = await prisma.scanEvent.findMany({
      where: {
        parentQR: { product: { smeID: req.sme.smeId } },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        parentQR: { include: { product: true } },
        handoffCode: { select: { isUsed: true } },
      },
    });

    const events = scanEvents.map((e) => ({
      scanID: e.scanID,
      productName: e.parentQR.product.productName,
      productID: e.parentQR.product.productID,
      parentQRID: e.parentQRID,
      scannerRole: e.scannerRole,
      currentStage: e.parentQR.currentStage,
      timestamp: e.timestamp,
      handoffUsed: e.handoffCode?.isUsed ?? null,
    }));

    res.status(200).json({ events });
  } catch (error) {
    console.error("Recent Activity Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const getStats = async (req: any, res: any): Promise<any> => {
  try {
    const smeID = req.sme.smeId;
    const childBase = { parentQR: { product: { smeID } } };

    const [productCount, childQRCount, pendingCount, inTransitCount, deliveredCount] =
      await Promise.all([
        prisma.product.count({ where: { smeID } }),
        prisma.childQRCode.count({ where: childBase }),
        prisma.childQRCode.count({ where: { parentQR: { product: { smeID }, currentStage: "pending" } } }),
        prisma.childQRCode.count({ where: { parentQR: { product: { smeID }, currentStage: "transit" } } }),
        prisma.childQRCode.count({ where: { parentQR: { product: { smeID }, currentStage: "delivered" } } }),
      ]);

    res.status(200).json({
      productCount,
      childQRCount,
      pendingCount,
      inTransitCount,
      deliveredCount,
    });
  } catch (error) {
    console.error("Stats Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const getItemStatus = async (req: any, res: any): Promise<any> => {
  try {
    const items = await prisma.childQRCode.findMany({
      where: { parentQR: { product: { smeID: req.sme.smeId } } },
      orderBy: { createdAt: "desc" },
      include: {
        parentQR: {
          include: {
            product: { select: { productName: true, productID: true } },
            scanEvents: {
              orderBy: { timestamp: "desc" },
              take: 1,
              select: { timestamp: true },
            },
          },
        },
      },
    });

    const result = items.map((item) => ({
      childQRID: item.childQRID,
      itemNumber: item.itemNumber,
      currentStage: item.parentQR.currentStage,
      productName: item.parentQR.product.productName,
      productID: item.parentQR.product.productID,
      lastScanAt: item.parentQR.scanEvents[0]?.timestamp ?? null,
    }));

    res.status(200).json({ items: result });
  } catch (error) {
    console.error("Item Status Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const updateProfile = async (req: any, res: any): Promise<any> => {
  const { businessName, email } = req.body;

  if (!businessName && !email) {
    return res.status(400).json({ error: "Nothing to update." });
  }

  try {
    if (email) {
      const conflict = await prisma.sME.findFirst({
        where: { email, NOT: { smeID: req.sme.smeId } },
      });
      if (conflict) {
        return res.status(400).json({ error: "That email is already in use.", field: "email" });
      }
    }

    const updated = await prisma.sME.update({
      where: { smeID: req.sme.smeId },
      data: {
        ...(businessName && { businessName }),
        ...(email && { email }),
      },
      select: { businessName: true, email: true, rcNumber: true },
    });

    res.status(200).json({ message: "Profile updated.", sme: updated });
  } catch (error) {
    console.error("Profile Update Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const updatePassword = async (req: any, res: any): Promise<any> => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters.", field: "newPassword" });
  }

  try {
    const sme = await prisma.sME.findUnique({ where: { smeID: req.sme.smeId } });
    if (!sme) return res.status(404).json({ error: "Account not found." });

    const valid = await bcrypt.compare(currentPassword, sme.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect.", field: "currentPassword" });
    }

    const hash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await prisma.sME.update({
      where: { smeID: req.sme.smeId },
      data: { passwordHash: hash },
    });

    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Password Update Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const getProfile = async (req: any, res: any): Promise<any> => {
  try {
    const sme = await prisma.sME.findUnique({
      where: { smeID: req.sme.smeId },
      select: {
        smeID: true,
        businessName: true,
        rcNumber: true,
        email: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { products: true } },
      },
    });

    if (!sme) {
      return res.status(404).json({ error: "SME not found." });
    }

    // Count scan events for all products of this SME
    const scanCount = await prisma.scanEvent.count({
      where: {
        parentQR: {
          product: { smeID: req.sme.smeId },
        },
      },
    });

    res.status(200).json({ ...sme, productCount: sme._count.products, scanCount });
  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
