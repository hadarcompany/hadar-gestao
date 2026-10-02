CREATE TYPE "ExpensePaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'OTHER');

CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank" TEXT,
    "brand" TEXT,
    "color" TEXT NOT NULL DEFAULT '#FF5A00',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- O acesso ocorre pelo Prisma; a API pública do Supabase não recebe políticas.
ALTER TABLE "credit_cards" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "fixed_expenses" ADD COLUMN "paymentMethod" "ExpensePaymentMethod",
    ADD COLUMN "creditCardId" TEXT;
ALTER TABLE "variable_expenses" ADD COLUMN "paymentMethod" "ExpensePaymentMethod",
    ADD COLUMN "creditCardId" TEXT;

CREATE INDEX "fixed_expenses_creditCardId_idx" ON "fixed_expenses"("creditCardId");
CREATE INDEX "variable_expenses_creditCardId_idx" ON "variable_expenses"("creditCardId");

ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_creditCardId_fkey"
    FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "variable_expenses" ADD CONSTRAINT "variable_expenses_creditCardId_fkey"
    FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
