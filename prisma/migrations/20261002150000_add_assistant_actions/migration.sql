CREATE TABLE "assistant_runs" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "assistant_runs_userId_requestId_key" ON "assistant_runs"("userId", "requestId");
CREATE INDEX "assistant_runs_userId_createdAt_idx" ON "assistant_runs"("userId", "createdAt");
ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "assistant_actions" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assistant_actions_runId_createdAt_idx" ON "assistant_actions"("runId", "createdAt");
CREATE UNIQUE INDEX "assistant_actions_runId_dedupeKey_key" ON "assistant_actions"("runId", "dedupeKey");
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "assistant_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assistant_actions" ENABLE ROW LEVEL SECURITY;
