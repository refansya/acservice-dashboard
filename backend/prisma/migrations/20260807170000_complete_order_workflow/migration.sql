-- Complete fields that existed in the Prisma model before the initial database migration.
CREATE TYPE "JobType" AS ENUM ('INSTALASI', 'MAINTENANCE', 'SERVICE');

ALTER TABLE "Order"
  ADD COLUMN "jobType" "JobType",
  ADD COLUMN "jobCost" DECIMAL(12,2);

CREATE TABLE "OrderHelper" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "commissionRate" DECIMAL(5,2) NOT NULL,
  "commissionAmount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderHelper_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderHelper"
  ADD CONSTRAINT "OrderHelper_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
