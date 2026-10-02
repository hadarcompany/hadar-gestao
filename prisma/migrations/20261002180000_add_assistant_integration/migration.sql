CREATE TABLE "assistant_integration" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "apiKeyEncrypted" TEXT,
  "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_integration_pkey" PRIMARY KEY ("id")
);

-- Somente rotas do servidor acessam a credencial. Nenhuma policy pública.
ALTER TABLE "assistant_integration" ENABLE ROW LEVEL SECURITY;
