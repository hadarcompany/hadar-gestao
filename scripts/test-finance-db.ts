// This integration suite can only write to an explicitly selected disposable local DB.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { investmentData } from "../lib/investments";
import { syncInvestmentExpenses, adoptInvestmentExpenses, validateInvestmentCard } from "../lib/investments-server";
import { syncExpenseCash } from "../lib/expense-cash";
import { loadCardInvoice } from "../lib/card-invoices-server";
import { sumMoney } from "../lib/finance-money";
import fs from "node:fs";
import { splitSql } from "./prepare-social";

const url = new URL(process.env.TEST_DATABASE_URL || "https://missing.invalid");
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && /^\/finance_test_[a-z0-9_]+$/.test(url.pathname), "Choose an isolated local finance_test_* database.");
const db = new PrismaClient({ datasourceUrl: url.href });
async function run() {
  assert.equal((await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`)[0].name, url.pathname.slice(1));
  // Roll back every fixture, even after a successful test.
  const marker = new Error("TEST_ROLLBACK");
  try {
    await db.$transaction(async tx => {
      const card = await tx.creditCard.create({ data: { name: "Nubank integration test", closingDay: 25, dueDay: 5 } });
      const other = await tx.creditCard.create({ data: { name: "Other card", closingDay: 10, dueDay: 20 } });
      const inv = await tx.investment.create({ data: { ...investmentData({ description: "iPhone " + randomUUID(), amount: 6000, paymentMethod: "PARCELADO", installments: 10, date: "2026-10-25", creditCardId: card.id }), requestId: randomUUID() } });
      await validateInvestmentCard(tx, card.id);
      await syncInvestmentExpenses(tx, inv); await syncInvestmentExpenses(tx, inv);
      let expenses = await tx.variableExpense.findMany({ where: { investmentId: inv.id }, orderBy: { installmentNumber: "asc" } });
      assert.equal(expenses.length, 10); assert.equal(sumMoney(expenses.map(e => e.amount)), 6000);
      const stableIds = expenses.map(e => e.id);
      for (let index = 0; index < 10; index++) {
        const monthIndex = 10 + index;
        const invoice = await loadCardInvoice(tx, card.id, { month: monthIndex % 12 + 1, year: 2026 + Math.floor(monthIndex / 12) });
        assert.equal(invoice!.total, 600); assert.equal(invoice!.lines.length, 1);
      }
      assert.equal((await loadCardInvoice(tx, other.id, { month: 11, year: 2026 }))!.total, 0);
      await tx.creditCardInvoice.upsert({ where: { creditCardId_year_month: { creditCardId: card.id, year: 2026, month: 11 } }, create: { creditCardId: card.id, year: 2026, month: 11, paidAmount: 250 }, update: { paidAmount: 250 } });
      let invoice = (await loadCardInvoice(tx, card.id, { month: 11, year: 2026 }))!;
      assert.equal(invoice.remaining, 350); assert.equal(invoice.status, "PARTIALLY_PAID");
      assert.equal(await tx.cashEntry.count({ where: { investmentId: inv.id } }), 0);
      let edited = await tx.investment.update({ where: { id: inv.id }, data: investmentData({ description: "Edited phone", amount: 100, installments: 3, creditCardId: other.id }, inv) });
      await syncInvestmentExpenses(tx, edited);
      expenses = await tx.variableExpense.findMany({ where: { investmentId: inv.id }, orderBy: { installmentNumber: "asc" } });
      assert.deepEqual(expenses.map(e => e.id), stableIds.slice(0, 3));
      assert.deepEqual(expenses.map(e => e.amount), [33.34, 33.33, 33.33]);
      assert.ok(expenses.every(e => e.creditCardId === other.id && e.name.startsWith("Edited phone")));
      assert.equal((await loadCardInvoice(tx, card.id, { month: 11, year: 2026 }))!.total, 0);
      const beforeDelete = (await loadCardInvoice(tx, other.id, { month: 11, year: 2026 }))!.total;
      await tx.investment.delete({ where: { id: inv.id } });
      assert.equal((await loadCardInvoice(tx, other.id, { month: 11, year: 2026 }))!.total, beforeDelete);
      assert.equal(await tx.variableExpense.count({ where: { id: { in: stableIds } } }), 3);
      // Same title/value/day duplicates are rejected; explicit adoption reuses the row.
      const manual = await tx.variableExpense.create({ data: { name: "Manual phone", category: "OUTROS", amount: 20, date: new Date("2026-11-05T03:00:00Z"), creditCardId: card.id, paymentMethod: "CREDIT_CARD" } });
      const adopt = await tx.investment.create({ data: investmentData({ description: "Manual phone", amount: 20, date: "2026-10-01", creditCardId: card.id }) });
      await assert.rejects(syncInvestmentExpenses(tx, adopt), /Já existe uma despesa/);
      await adoptInvestmentExpenses(tx, adopt, [manual.id]); await syncInvestmentExpenses(tx, adopt);
      assert.equal(await tx.variableExpense.count({ where: { investmentId: adopt.id } }), 1);
      assert.equal((await tx.variableExpense.findUniqueOrThrow({ where: { id: manual.id } })).investmentId, adopt.id);
      // Cash tracks source edits, toggle, and source deletion, without duplicate withdrawals.
      const source = await tx.variableExpense.create({ data: { name: "Cash test", category: "OUTROS", amount: 25, date: new Date(), paidWithCash: true } });
      await syncExpenseCash(tx, { variableExpenseId: source.id }, source, "Despesa Avulsa: Cash test");
      await syncExpenseCash(tx, { variableExpenseId: source.id }, { ...source, amount: 30 }, "Despesa Avulsa: Cash edited");
      assert.equal(await tx.cashEntry.count({ where: { variableExpenseId: source.id } }), 1);
      assert.equal((await tx.cashEntry.findFirstOrThrow({ where: { variableExpenseId: source.id } })).amount, 30);
      await syncExpenseCash(tx, { variableExpenseId: source.id }, { ...source, paidWithCash: false }, "Cash test");
      assert.ok((await tx.cashEntry.findFirstOrThrow({ where: { variableExpenseId: source.id } })).voidedAt);
      await syncExpenseCash(tx, { variableExpenseId: source.id }, source, "Cash test");
      assert.equal(await tx.cashEntry.count({ where: { variableExpenseId: source.id, voidedAt: null } }), 1);
      await tx.variableExpense.delete({ where: { id: source.id } });
      assert.equal(await tx.cashEntry.count({ where: { variableExpenseId: source.id } }), 0);
      // Jan 30, closing 29, avoids two installments appearing in the same invoice.
      await tx.creditCard.update({ where: { id: card.id }, data: { closingDay: 29 } });
      const short = await tx.investment.create({ data: investmentData({ description: "Short month", amount: 100, paymentMethod: "PARCELADO", installments: 3, date: "2026-01-30", creditCardId: card.id }) });
      await syncInvestmentExpenses(tx, short);
      for (let month = 3; month <= 5; month++) assert.equal((await loadCardInvoice(tx, card.id, { month, year: 2026 }))!.lines.filter(e => e.name.startsWith("Short month")).length, 1);
      const fixed = await tx.fixedExpense.create({ data: { name: "Recurring card expense", amount: 10, category: "OUTROS", month: 10, year: 2026, paymentMethod: "CREDIT_CARD", creditCardId: other.id } });
      invoice = (await loadCardInvoice(tx, other.id, { month: 12, year: 2026 }))!;
      assert.equal(invoice.lines.filter(e => e.id.startsWith(`fixed:${fixed.id}:`)).length, 1);
      // New invoices must work for a restricted server role, not just PostgreSQL admin.
      const role = "finance_test_role_" + randomUUID().replace(/-/g, "");
      await tx.$executeRawUnsafe(`CREATE ROLE "${role}" NOLOGIN NOBYPASSRLS`);
      await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await tx.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON credit_cards TO "${role}"`);
      await tx.$executeRawUnsafe(`CREATE POLICY "${role}" ON credit_cards FOR ALL TO "${role}" USING (true) WITH CHECK (true)`);
      for (const statement of splitSql(fs.readFileSync("prisma/migrations/20261027120000_card_invoices_investment_links/migration.sql", "utf8")).filter(sql => sql.startsWith("DO $$"))) await tx.$executeRawUnsafe(statement);
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      assert.equal((await tx.creditCardInvoice.findMany({ where: { creditCardId: card.id } })).length, 1);
      await tx.creditCardInvoice.update({ where: { creditCardId_year_month: { creditCardId: card.id, year: 2026, month: 11 } }, data: { paidAmount: 300 } });
      await tx.$executeRawUnsafe("RESET ROLE");
      console.log("PASS: isolated DB — installments, cents, stable edit IDs, card reassignment, payment, deletion history, explicit adoption, cash lifecycle and short months.");
      throw marker;
    }, { timeout: 120000 });
  } catch (error) { if (error !== marker) throw error; }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
