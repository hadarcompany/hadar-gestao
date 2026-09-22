ALTER TABLE "tasks"
ADD COLUMN "descriptionUpdatedById" TEXT,
ADD COLUMN "descriptionUpdatedAt" TIMESTAMP(3);

UPDATE "tasks"
SET "descriptionUpdatedById" = "createdById",
    "descriptionUpdatedAt" = "createdAt"
WHERE "description" IS NOT NULL;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_descriptionUpdatedById_fkey"
FOREIGN KEY ("descriptionUpdatedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_descriptionUpdatedById_idx"
ON "tasks"("descriptionUpdatedById");
