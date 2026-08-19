ALTER TABLE "ServiceType"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "helperRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

UPDATE "ServiceType"
SET "code" = CASE "name"
  WHEN 'Cuci AC Split' THEN 'MNT'
  WHEN 'Isi Freon AC' THEN 'SVC'
  WHEN 'Service AC Berat' THEN 'SVC-BERAT'
  ELSE 'LYN-' || substring("id" from 1 for 8)
END;

ALTER TABLE "ServiceType" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "ServiceType_code_key" ON "ServiceType"("code");

ALTER TABLE "Order"
  ADD COLUMN "serviceItem" TEXT,
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "reminderDate" TIMESTAMP(3);
