-- CreateEnum
CREATE TYPE "AsaasBillingType" AS ENUM ('UNDEFINED', 'BOLETO', 'CREDIT_CARD', 'PIX');

-- AlterTable
ALTER TABLE "clients"
ADD COLUMN "cpfCnpj" TEXT,
ADD COLUMN "asaasCustomerId" TEXT;

-- AlterTable
ALTER TABLE "receivables"
ADD COLUMN "description" TEXT,
ADD COLUMN "billingType" "AsaasBillingType",
ADD COLUMN "asaasPaymentId" TEXT,
ADD COLUMN "asaasStatus" TEXT,
ADD COLUMN "asaasInvoiceUrl" TEXT,
ADD COLUMN "asaasBankSlipUrl" TEXT,
ADD COLUMN "asaasNetValue" DOUBLE PRECISION,
ADD COLUMN "asaasSyncedAt" TIMESTAMP(3),
ADD COLUMN "asaasSyncError" TEXT;

-- CreateTable
CREATE TABLE "asaas_webhook_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "paymentId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asaas_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_asaasCustomerId_key" ON "clients"("asaasCustomerId");
CREATE UNIQUE INDEX "receivables_asaasPaymentId_key" ON "receivables"("asaasPaymentId");
CREATE INDEX "asaas_webhook_events_paymentId_idx" ON "asaas_webhook_events"("paymentId");
