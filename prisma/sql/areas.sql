-- Áreas de trabalho com nome editável. O código da área (EDICAO, CAPTACAO...) continua
-- sendo o que fica gravado em tasks.area; aqui ficam só o nome e a cor exibidos.
-- Rode ANTES de publicar. Não apaga nada; pode rodar de novo.

CREATE TABLE IF NOT EXISTS "task_areas" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_areas_pkey" PRIMARY KEY ("id")
);

-- Nomes atuais das áreas. Só entram se a tabela estiver vazia: renomear depois não é desfeito.
INSERT INTO "task_areas" ("id", "name", "color", "position")
SELECT v.id, v.name, v.color, v.position
FROM (VALUES
  ('EDICAO', 'Edição de vídeo', '#8b5cf6', 1),
  ('CAPTACAO', 'Captação', '#3b82f6', 2),
  ('DESIGN', 'Design e programação', '#f59e0b', 3),
  ('OPERACAO', 'Operação', '#10b981', 4)
) AS v(id, name, color, position)
WHERE NOT EXISTS (SELECT 1 FROM "task_areas");

ALTER TABLE "task_areas" ENABLE ROW LEVEL SECURITY;

SELECT id, name FROM "task_areas" ORDER BY position;
