ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'HELPER';

CREATE TABLE "Helper" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Helper_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "helperId" TEXT;
ALTER TABLE "OrderHelper" ADD COLUMN "helperId" TEXT;
CREATE UNIQUE INDEX "User_helperId_key" ON "User"("helperId");
CREATE INDEX "OrderHelper_helperId_idx" ON "OrderHelper"("helperId");
ALTER TABLE "User" ADD CONSTRAINT "User_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "Helper"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderHelper" ADD CONSTRAINT "OrderHelper_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "Helper"("id") ON DELETE SET NULL ON UPDATE CASCADE;
