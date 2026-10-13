CREATE TABLE IF NOT EXISTS "asaas_integration" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "environment" TEXT NOT NULL DEFAULT 'sandbox',
  "apiKeyEncrypted" TEXT,
  "webhookTokenEncrypted" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asaas_integration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asaas_integration_environment_check" CHECK ("environment" IN ('sandbox', 'production'))
);
ALTER TABLE "asaas_integration" ENABLE ROW LEVEL SECURITY;
