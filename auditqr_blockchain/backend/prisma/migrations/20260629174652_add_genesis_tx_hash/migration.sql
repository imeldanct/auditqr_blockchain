-- CreateEnum
CREATE TYPE "QRStage" AS ENUM ('pending', 'transit', 'delivered');

-- CreateTable
CREATE TABLE "SME" (
    "smeID" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "rcNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SME_pkey" PRIMARY KEY ("smeID")
);

-- CreateTable
CREATE TABLE "Product" (
    "productID" TEXT NOT NULL,
    "smeID" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "weight" DOUBLE PRECISION,
    "mfgDate" TIMESTAMP(3),
    "expDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("productID")
);

-- CreateTable
CREATE TABLE "ParentQRCode" (
    "parentQRID" TEXT NOT NULL,
    "productID" TEXT NOT NULL,
    "qrData" TEXT NOT NULL,
    "currentStage" "QRStage" NOT NULL DEFAULT 'pending',
    "genesisTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentQRCode_pkey" PRIMARY KEY ("parentQRID")
);

-- CreateTable
CREATE TABLE "ChildQRCode" (
    "childQRID" TEXT NOT NULL,
    "parentQRID" TEXT NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "qrData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildQRCode_pkey" PRIMARY KEY ("childQRID")
);

-- CreateTable
CREATE TABLE "ScanEvent" (
    "scanID" TEXT NOT NULL,
    "parentQRID" TEXT NOT NULL,
    "scannerRole" TEXT NOT NULL,
    "ipLocation" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txHash" TEXT,

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("scanID")
);

-- CreateTable
CREATE TABLE "HandoffCode" (
    "codeID" TEXT NOT NULL,
    "scanID" TEXT NOT NULL,
    "codeValue" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoffCode_pkey" PRIMARY KEY ("codeID")
);

-- CreateIndex
CREATE UNIQUE INDEX "SME_rcNumber_key" ON "SME"("rcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SME_email_key" ON "SME"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HandoffCode_scanID_key" ON "HandoffCode"("scanID");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_smeID_fkey" FOREIGN KEY ("smeID") REFERENCES "SME"("smeID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentQRCode" ADD CONSTRAINT "ParentQRCode_productID_fkey" FOREIGN KEY ("productID") REFERENCES "Product"("productID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildQRCode" ADD CONSTRAINT "ChildQRCode_parentQRID_fkey" FOREIGN KEY ("parentQRID") REFERENCES "ParentQRCode"("parentQRID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_parentQRID_fkey" FOREIGN KEY ("parentQRID") REFERENCES "ParentQRCode"("parentQRID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffCode" ADD CONSTRAINT "HandoffCode_scanID_fkey" FOREIGN KEY ("scanID") REFERENCES "ScanEvent"("scanID") ON DELETE RESTRICT ON UPDATE CASCADE;
