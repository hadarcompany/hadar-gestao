-- Projetos, área das tarefas e vínculo tarefa → projeto.
-- Execute no SQL Editor do Supabase ANTES de publicar o código que usa essas colunas.
-- Não apaga nada. Pode ser executado de novo sem efeito colateral.

CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'GERAL',
  "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
  "color" TEXT,
  "dueDate" TIMESTAMP(3),
  "clientId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "projects_kind_idx" ON "projects"("kind");
CREATE INDEX IF NOT EXISTS "projects_clientId_idx" ON "projects"("clientId");

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "area" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "tasks_projectId_idx" ON "tasks"("projectId");

-- Preenche a área das tarefas existentes pelo tipo (só onde ainda está vazia).
UPDATE "tasks" SET "area" = CASE "type"
  WHEN 'reels' THEN 'EDICAO'
  WHEN 'captacao' THEN 'CAPTACAO'
  WHEN 'post_avulso' THEN 'DESIGN'
  WHEN 'carrossel' THEN 'DESIGN'
  WHEN 'criativo_trafego' THEN 'DESIGN'
  WHEN 'landing_page' THEN 'DESIGN'
  WHEN 'calendario_editorial' THEN 'OPERACAO'
  WHEN 'relatorio_mensal' THEN 'OPERACAO'
  WHEN 'onboarding' THEN 'OPERACAO'
  WHEN 'reuniao_cliente' THEN 'OPERACAO'
  WHEN 'briefing' THEN 'OPERACAO'
  WHEN 'google_meu_negocio' THEN 'OPERACAO'
END
WHERE "area" IS NULL AND "type" IS NOT NULL;

-- Tabela nova nasce sem RLS: fecha a API pública, como nas demais.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;

-- Conferência
SELECT "area", COUNT(*) AS tarefas FROM "tasks" GROUP BY "area" ORDER BY tarefas DESC;
