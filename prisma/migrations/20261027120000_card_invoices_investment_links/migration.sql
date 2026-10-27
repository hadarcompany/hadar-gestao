-- Additive migration: preserve existing cards, investments, expenses and cash entries.
ALTER TABLE "credit_cards" ADD COLUMN "closingDay" INTEGER, ADD COLUMN "dueDay" INTEGER;
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_cycle_check" CHECK (
  ("closingDay" IS NULL AND "dueDay" IS NULL) OR
  ("closingDay" BETWEEN 1 AND 31 AND "dueDay" BETWEEN 1 AND 31 AND "closingDay" IS NOT NULL AND "dueDay" IS NOT NULL)
);

CREATE TABLE "credit_card_invoices" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creditCardId" TEXT NOT NULL REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "month" INTEGER NOT NULL CHECK ("month" BETWEEN 1 AND 12),
  "year" INTEGER NOT NULL CHECK ("year" BETWEEN 1900 AND 9998),
  "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK ("paidAmount" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_card_invoices_creditCardId_year_month_key" UNIQUE ("creditCardId", "year", "month")
);
ALTER TABLE "credit_card_invoices" ENABLE ROW LEVEL SECURITY;

-- Preserve the existing server-role access while keeping anon/authenticated denied.
DO $$
DECLARE permission RECORD;
BEGIN
  FOR permission IN
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'credit_cards'
      AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      AND grantee NOT IN ('anon', 'authenticated', 'PUBLIC')
  LOOP
    EXECUTE format('GRANT %s ON TABLE public.credit_card_invoices TO %I', permission.privilege_type, permission.grantee);
  END LOOP;
END $$;

DO $$
DECLARE server_role RECORD;
BEGIN
  FOR server_role IN
    SELECT DISTINCT unnest(roles) AS name FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'credit_cards' AND cmd = 'ALL'
      AND permissive = 'PERMISSIVE' AND qual = 'true' AND with_check = 'true'
  LOOP
    IF server_role.name NOT IN ('anon', 'authenticated', 'public') THEN
      EXECUTE format('CREATE POLICY %I ON public.credit_card_invoices FOR ALL TO %I USING (true) WITH CHECK (true)', 'invoice_server_' || server_role.name, server_role.name);
    END IF;
  END LOOP;
END $$;

ALTER TABLE "investments"
  ADD COLUMN "creditCardId" TEXT REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "autoCreateExpenses" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requestId" TEXT;
CREATE INDEX "investments_creditCardId_idx" ON "investments"("creditCardId");
CREATE UNIQUE INDEX "investments_requestId_key" ON "investments"("requestId");

ALTER TABLE "variable_expenses"
  ADD COLUMN "investmentId" TEXT REFERENCES "investments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD COLUMN "installmentNumber" INTEGER CHECK ("installmentNumber" BETWEEN 1 AND 600),
  ADD COLUMN "cardInvoiceMonth" INTEGER,
  ADD COLUMN "cardInvoiceYear" INTEGER,
  ADD CONSTRAINT "variable_expenses_invoice_period_check" CHECK (
    ("cardInvoiceMonth" IS NULL AND "cardInvoiceYear" IS NULL) OR
    ("cardInvoiceMonth" IS NOT NULL AND "cardInvoiceYear" IS NOT NULL AND "cardInvoiceMonth" BETWEEN 1 AND 12 AND "cardInvoiceYear" BETWEEN 1900 AND 9998)
  );
CREATE UNIQUE INDEX "variable_expenses_investmentId_installmentNumber_key" ON "variable_expenses"("investmentId", "installmentNumber");

ALTER TABLE "cash_entries"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "fixedExpenseId" TEXT REFERENCES "fixed_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD COLUMN "variableExpenseId" TEXT REFERENCES "variable_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD COLUMN "investmentId" TEXT REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "cash_entries_single_source_check" CHECK (num_nonnulls("fixedExpenseId", "variableExpenseId", "investmentId") <= 1);
CREATE UNIQUE INDEX "cash_entries_fixedExpenseId_key" ON "cash_entries"("fixedExpenseId");
CREATE UNIQUE INDEX "cash_entries_variableExpenseId_key" ON "cash_entries"("variableExpenseId");
CREATE UNIQUE INDEX "cash_entries_investmentId_key" ON "cash_entries"("investmentId");

-- Only adopt an entire, unambiguous batch created by the former investment API.
-- Name, old installment amount, old date-overflow convention and creation time must match.
-- Nothing is deleted or guessed by fuzzy names/amounts.
WITH expected AS (
  SELECT i.id AS investment_id, n AS installment, cnt,
    CASE WHEN cnt > 1 THEN i.description || ' (' || n || '/' || cnt || ')' ELSE i.description END AS name,
    round((i.amount / cnt)::numeric, 2) AS amount,
    date_trunc('month', i.date) + (n - 1) * INTERVAL '1 month' + (extract(day FROM i.date)::int - 1) * INTERVAL '1 day' AS date,
    i."createdAt"
  FROM investments i
  CROSS JOIN LATERAL (SELECT CASE WHEN i."paymentMethod" = 'PARCELADO' AND i.installments > 1 THEN i.installments ELSE 1 END AS cnt) counts
  CROSS JOIN LATERAL generate_series(1, LEAST(cnt, 600)) AS n
  WHERE cnt BETWEEN 1 AND 600
), candidates AS (
  SELECT e.investment_id, e.installment, e.cnt, v.id AS expense_id,
    count(*) OVER (PARTITION BY e.investment_id, e.installment) AS per_installment,
    count(*) OVER (PARTITION BY v.id) AS per_expense
  FROM expected e JOIN variable_expenses v
    ON v.name = e.name AND round(v.amount::numeric, 2) = e.amount AND v.date::date = e.date::date
    AND v.category = 'OUTROS' AND v."investmentId" IS NULL
    AND abs(extract(epoch FROM (v."createdAt" - e."createdAt"))) <= 30
), complete AS (
  SELECT investment_id FROM candidates GROUP BY investment_id
  HAVING count(*) = max(cnt) AND bool_and(per_installment = 1 AND per_expense = 1)
)
UPDATE variable_expenses v SET "investmentId" = c.investment_id, "installmentNumber" = c.installment
FROM candidates c JOIN complete b USING (investment_id) WHERE v.id = c.expense_id;
UPDATE investments i SET "autoCreateExpenses" = true WHERE EXISTS (SELECT 1 FROM variable_expenses v WHERE v."investmentId" = i.id);

-- Safely attach old cash movements only when both directions have exactly one match.
WITH sources AS (
  SELECT id, 'FIXED' AS kind, 'Despesa Fixa: ' || name AS description, amount, "createdAt" FROM fixed_expenses WHERE "paidWithCash"
  UNION ALL
  SELECT id, 'VARIABLE', 'Despesa Avulsa: ' || name, amount, "createdAt" FROM variable_expenses WHERE "paidWithCash"
  UNION ALL
  SELECT id, 'INVESTMENT', 'Investimento: ' || description, amount, "createdAt" FROM investments WHERE "paidWithCash"
), matches AS (
  SELECT s.id, s.kind, c.id AS cash_id,
    count(*) OVER (PARTITION BY s.kind, s.id) AS per_source,
    count(*) OVER (PARTITION BY c.id) AS per_cash
  FROM sources s JOIN cash_entries c ON c.type = 'RETIRADA_DESPESA'
    AND c.description = s.description AND round(c.amount::numeric, 2) = round(s.amount::numeric, 2)
    AND abs(extract(epoch FROM (c."createdAt" - s."createdAt"))) <= 30
)
UPDATE cash_entries c SET
  "fixedExpenseId" = CASE WHEN m.kind = 'FIXED' THEN m.id END,
  "variableExpenseId" = CASE WHEN m.kind = 'VARIABLE' THEN m.id END,
  "investmentId" = CASE WHEN m.kind = 'INVESTMENT' THEN m.id END
FROM matches m WHERE c.id = m.cash_id AND m.per_source = 1 AND m.per_cash = 1;
