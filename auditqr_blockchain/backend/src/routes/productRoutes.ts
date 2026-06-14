import express from "express";
import {
  createProduct,
  deleteProduct,
  getProducts,
} from "../controllers/productController";
import { authenticateSME } from "../middleware/authMiddleware";

const router = express.Router();

router.use(authenticateSME);
router.post("/", createProduct);
router.get("/", getProducts);
router.delete("/:productId", deleteProduct);

export default router;
