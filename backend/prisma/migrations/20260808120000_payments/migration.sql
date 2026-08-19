CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: invoice yang sudah PAID sebelumnya dicatat sebagai satu payment penuh
INSERT INTO "Payment" ("id", "invoiceId", "amount", "method", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "id", "total", COALESCE("paymentMethod", 'OTHER'), COALESCE("paidAt", "updatedAt")
FROM "Invoice"
WHERE "status" = 'PAID';