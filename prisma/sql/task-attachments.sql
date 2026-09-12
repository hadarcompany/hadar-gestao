-- Execute no SQL Editor do banco usado por este projeto.
-- Não altera nem apaga tabelas existentes. Pode ser executado novamente.
CREATE TABLE IF NOT EXISTS "task_attachments" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "task_attachments_taskId_idx" ON "task_attachments"("taskId");
-- Acesso pelos endpoints autenticados via Prisma, sem exposição pela API pública do Supabase.
ALTER TABLE "task_attachments" ENABLE ROW LEVEL SECURITY;
