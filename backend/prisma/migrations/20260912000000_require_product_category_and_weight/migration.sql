-- Every AuditQR product must have a category and a positive unit weight.
-- This migration deliberately fails if existing records are incomplete rather
-- than inventing values that do not describe the real product.
ALTER TABLE "Product" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "weight" SET NOT NULL;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_weight_positive" CHECK ("weight" > 0);
