-- AlterTable
ALTER TABLE "receivables"
ADD COLUMN "revenueCompetenceMonth" INTEGER,
ADD COLUMN "revenueCompetenceYear" INTEGER,
ADD COLUMN "competenceNote" TEXT,
ADD COLUMN "competenceAdjustedAt" TIMESTAMP(3),
ADD COLUMN "competenceAdjustedById" TEXT;

-- CreateTable
CREATE TABLE "revenue_competence_adjustments" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "fromMonth" INTEGER,
    "fromYear" INTEGER,
    "toMonth" INTEGER NOT NULL,
    "toYear" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedById" TEXT NOT NULL,
    "adjustedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenue_competence_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revenue_competence_adjustments_receivableId_createdAt_idx"
ON "revenue_competence_adjustments"("receivableId", "createdAt");

-- AddForeignKey
ALTER TABLE "revenue_competence_adjustments"
ADD CONSTRAINT "revenue_competence_adjustments_receivableId_fkey"
FOREIGN KEY ("receivableId") REFERENCES "receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
