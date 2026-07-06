-- Rename ipLocation to gpsLocation and make it nullable
ALTER TABLE "ScanEvent" RENAME COLUMN "ipLocation" TO "gpsLocation";
ALTER TABLE "ScanEvent" ALTER COLUMN "gpsLocation" DROP NOT NULL;
