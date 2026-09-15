-- Etiquetas personalizáveis das tarefas e atualizações (comentários com @menção).
-- Rode ANTES de publicar o código que usa essas tabelas. Não apaga nada; pode rodar de novo.

CREATE TABLE IF NOT EXISTS "task_labels" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "labelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "task_updates" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT,
  "content" TEXT NOT NULL,
  "mentionedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_updates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_updates_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_updates_authorId_fkey" FOREIGN KEY ("authorId")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "task_updates_taskId_createdAt_idx" ON "task_updates"("taskId", "createdAt");

-- Etiquetas iniciais (as mesmas que a equipe já usa). Só entram se a tabela estiver vazia.
INSERT INTO "task_labels" ("id", "name", "color", "position")
SELECT v.id, v.name, v.color, v.position
FROM (VALUES
  ('lbl_reuniao', 'Tarefas da Reunião', '#f7a1d5', 1),
  ('lbl_anotacao', 'Anotação diária', '#3fa9c9', 2),
  ('lbl_progresso', 'Em progresso', '#fdab3d', 3),
  ('lbl_aguard_resp', 'Aguardando resposta', '#579bfc', 4),
  ('lbl_trafego', 'TRÁFEGO', '#ff5ac4', 5),
  ('lbl_aguardando', 'Aguardando', '#8fb3c9', 6),
  ('lbl_aguard_mat', 'Aguardando Material', '#cab641', 7),
  ('lbl_recado', 'Recado', '#ffcb00', 8),
  ('lbl_feito', 'Feito', '#00c875', 9),
  ('lbl_parado', 'Parado', '#e2445c', 10),
  ('lbl_aguard_pag', 'Aguardando pagamento', '#ffadad', 11),
  ('lbl_artes', 'Artes', '#ff158a', 12),
  ('lbl_aprovado', 'Aprovado', '#9cd326', 13),
  ('lbl_ok', 'OK', '#66ccff', 14),
  ('lbl_agendado', 'Agendado', '#b8a3f4', 15),
  ('lbl_sem_resp', 'SEM RESPOSTA', '#bb3354', 16),
  ('lbl_pendente', 'Pendente', '#e484bd', 17)
) AS v(id, name, color, position)
WHERE NOT EXISTS (SELECT 1 FROM "task_labels");

-- Tabelas novas nascem sem RLS: fecha a API pública, como nas demais.
ALTER TABLE "task_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_updates" ENABLE ROW LEVEL SECURITY;

SELECT COUNT(*) AS etiquetas FROM "task_labels";
