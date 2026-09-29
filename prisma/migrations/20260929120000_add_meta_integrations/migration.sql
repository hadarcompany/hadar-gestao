-- CreateTable
CREATE TABLE "meta_connections" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "metaUserId" TEXT NOT NULL,
    "metaUserName" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_accounts" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT,
    "accountStatus" INTEGER,
    "businessId" TEXT,
    "businessName" TEXT,
    "clientId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_accounts_externalId_key" ON "meta_ad_accounts"("externalId");

-- CreateIndex
CREATE INDEX "meta_ad_accounts_clientId_idx" ON "meta_ad_accounts"("clientId");

-- AddForeignKey
ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "WhatsAppContactKind" AS ENUM ('CLIENT', 'EXISTING_LEAD', 'NEW_LEAD', 'UNKNOWN');

-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN "clientId" TEXT,
ADD COLUMN "contactKind" "WhatsAppContactKind" NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE INDEX "whatsapp_conversations_clientId_idx" ON "whatsapp_conversations"("clientId");

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Classifica conversas já existentes sem criar cadastros duplicados.
UPDATE "whatsapp_conversations" AS conversation
SET "clientId" = client."id", "leadId" = NULL, "contactKind" = 'CLIENT'
FROM "clients" AS client
WHERE client."phone" IS NOT NULL
  AND LENGTH(REGEXP_REPLACE(client."phone", '[^0-9]', '', 'g')) >= 8
  AND RIGHT(REGEXP_REPLACE(conversation."phone", '[^0-9]', '', 'g'), 8) = RIGHT(REGEXP_REPLACE(client."phone", '[^0-9]', '', 'g'), 8);

UPDATE "whatsapp_conversations" AS conversation
SET "contactKind" = CASE
  WHEN lead."origin" = 'WhatsApp' AND ABS(EXTRACT(EPOCH FROM (conversation."createdAt" - lead."createdAt"))) < 120 THEN 'NEW_LEAD'::"WhatsAppContactKind"
  ELSE 'EXISTING_LEAD'::"WhatsAppContactKind"
END
FROM "leads" AS lead
WHERE conversation."clientId" IS NULL AND conversation."leadId" = lead."id";
