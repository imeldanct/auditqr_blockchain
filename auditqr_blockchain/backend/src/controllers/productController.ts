import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authMiddleware";

const prisma = new PrismaClient();

export const createProduct = async (req: AuthRequest, res: Response): Promise<any> => {
  if (!req.sme) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { productName, description, category } = req.body as {
    productName: string;
    description: string;
    category?: string;
  };

  try {
    const product = await prisma.product.create({
      data: {
        smeID: req.sme.smeId,
        productName,
        description,
        category: category || null,
      },
    });

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    console.error("Product Creation Error:", error);
    res.status(500).json({ error: "Internal server error during product creation." });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<any> => {
  if (!req.sme) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { productId } = req.params as { productId: string };

  try {
    const product = await prisma.product.findFirst({
      where: { productID: productId, smeID: req.sme.smeId },
    });

    if (!product) {
      return res
        .status(404)
        .json({ error: "Product not found or does not belong to you." });
    }

    // Cascade via schema: deleting product deletes all ParentQRs → ChildQRs → ScanEvents
    await prisma.product.delete({ where: { productID: productId } });

    res.status(200).json({ message: "Product and all associated QR codes deleted." });
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.status(500).json({ error: "Internal server error during deletion." });
  }
};

export const getProducts = async (req: AuthRequest, res: Response): Promise<any> => {
  if (!req.sme) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const products = await prisma.product.findMany({
      where: { smeID: req.sme.smeId },
      orderBy: { createdAt: "desc" },
      include: {
        parentQRs: {
          include: {
            _count: { select: { childQRs: true } },
          },
        },
      },
    });

    const productsWithCount = products.map((p) => {
      const childQRCount = p.parentQRs.reduce(
        (sum, parent) => sum + parent._count.childQRs,
        0,
      );
      const { parentQRs, ...rest } = p;
      return { ...rest, childQRCount };
    });

    res.status(200).json(productsWithCount);
  } catch (error) {
    console.error("Fetch Products Error:", error);
    res.status(500).json({ error: "Internal server error while fetching products." });
  }
};
