-- Every AuditQR product must record when it was manufactured.
-- The migration deliberately fails if existing product records have no
-- manufacture date, so incomplete records are corrected rather than guessed.
ALTER TABLE "Product" ALTER COLUMN "mfgDate" SET NOT NULL;
