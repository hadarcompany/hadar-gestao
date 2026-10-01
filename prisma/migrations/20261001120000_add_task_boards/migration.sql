CREATE TABLE "task_boards" (
    "taskId" TEXT NOT NULL,
    "elements" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_boards_pkey" PRIMARY KEY ("taskId")
);

ALTER TABLE "task_boards"
ADD CONSTRAINT "task_boards_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
