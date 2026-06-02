import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import smeRoutes from "./routes/smeRoutes";
import productRoutes from "./routes/productRoutes";
import qrRoutes from "./routes/qrRoutes";
import scanRoutes from "./routes/scanRoutes";

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json());

// Test route
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", database: "connected" });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", database: "disconnected", error: String(error) });
  }
});

// Mount SME Routes
app.use("/api/sme", smeRoutes);
// Mount Product Routes
app.use("/api/products", productRoutes);
// Mount QR Routes
app.use("/api", qrRoutes);
// Mount Scan & Handoff Routes
app.use("/api", scanRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
