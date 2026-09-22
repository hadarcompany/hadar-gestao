CREATE TYPE "WhatsAppDirection" AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TABLE "whatsapp_conversations" (
  "id" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "leadId" TEXT,
  "lastMessage" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_messages" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "conversationId" TEXT NOT NULL,
  "direction" "WhatsAppDirection" NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_conversations_chatId_key" ON "whatsapp_conversations"("chatId");
CREATE INDEX "whatsapp_conversations_leadId_idx" ON "whatsapp_conversations"("leadId");
CREATE INDEX "whatsapp_conversations_lastMessageAt_idx" ON "whatsapp_conversations"("lastMessageAt");
CREATE UNIQUE INDEX "whatsapp_messages_externalId_key" ON "whatsapp_messages"("externalId");
CREATE INDEX "whatsapp_messages_conversationId_sentAt_idx" ON "whatsapp_messages"("conversationId", "sentAt");

ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
