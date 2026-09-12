-- Pipeline comercial (tabela leads). Execute no SQL Editor do banco deste projeto.
-- Não altera nem apaga tabelas existentes. Pode ser executado novamente sem efeito colateral.

DO $$ BEGIN
  CREATE TYPE "LeadStage" AS ENUM (
    'NOVO', 'FOLLOW_UP', 'PROSPECCAO_ATIVA', 'REUNIAO_AGENDADA',
    'PROPOSTA_ENVIADA', 'FECHADO', 'PERDIDO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "leads" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "company" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "origin" TEXT,
  "product" TEXT,
  "stage" "LeadStage" NOT NULL DEFAULT 'NOVO',
  "value" DOUBLE PRECISION,
  "notes" TEXT,
  "lostReason" TEXT,
  "ownerId" TEXT,
  "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leads_ownerId_fkey" FOREIGN KEY ("ownerId")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads"("stage");
CREATE INDEX IF NOT EXISTS "leads_createdAt_idx" ON "leads"("createdAt");

-- Acesso apenas pelos endpoints autenticados via Prisma, sem exposição pela API pública.
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
