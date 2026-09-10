-- A CAC-verified SME must retain its registered address and state.
-- This will fail rather than silently inventing location data if an existing
-- record is incomplete; correct those records before deploying this migration.
ALTER TABLE "SME" ALTER COLUMN "businessAddress" SET NOT NULL;
ALTER TABLE "SME" ALTER COLUMN "businessState" SET NOT NULL;
