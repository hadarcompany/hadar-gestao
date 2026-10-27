import { test } from "node:test";
import assert from "node:assert/strict";
import { addCalendarMonths, calendarDate, invoiceDates, invoiceForPurchase, invoiceSummary, shiftPeriod, validateCycle } from "../lib/card-invoices";
import { moneyInput, splitInstallments, sumMoney, toCents } from "../lib/finance-money";
import { investmentData, investmentInstallments } from "../lib/investments";

test("installments preserve every cent, including uneven divisions", () => {
  assert.deepEqual(splitInstallments(100, 3), [33.34, 33.33, 33.33]);
  assert.equal(sumMoney(splitInstallments(6000, 10)), 6000);
  assert.equal(sumMoney([0.1, 0.2]), 0.3);
  for (let count = 1; count <= 600; count++) assert.equal(toCents(sumMoney(splitInstallments(12345.67, count))), 1234567);
  for (const value of [-1, "1.001", NaN, true, "", "Infinity"]) assert.throws(() => moneyInput(value));
  assert.equal(moneyInput("12,25"), 12.25);
  assert.equal(moneyInput(0, true), 0);
  assert.throws(() => splitInstallments(0.01, 2));
});

test("closing is inclusive and invoice labels use the due month", () => {
  const cycle = { closingDay: 25, dueDay: 5 };
  assert.deepEqual(invoiceForPurchase("2026-10-25", cycle), { month: 11, year: 2026 });
  assert.deepEqual(invoiceForPurchase("2026-10-26", cycle), { month: 12, year: 2026 });
  assert.deepEqual(invoiceForPurchase("2026-12-26", cycle), { month: 2, year: 2027 });
  assert.deepEqual(invoiceForPurchase("2026-10-10", { closingDay: 10, dueDay: 20 }), { month: 10, year: 2026 });
  assert.deepEqual(invoiceDates({ month: 11, year: 2026 }, cycle), { startsAt: "2026-09-26", closesAt: "2026-10-25", dueAt: "2026-11-05", closingPeriod: { month: 10, year: 2026 } });
  assert.throws(() => validateCycle({ closingDay: null, dueDay: 5 }));
});

test("short months clamp and successive installments never collide", () => {
  assert.equal(addCalendarMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addCalendarMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addCalendarMonths("2026-01-31", 2), "2026-03-31");
  assert.throws(() => calendarDate("2026-02-30"));
  assert.throws(() => calendarDate("2026-02-30T00:00:00.000Z"));
  assert.deepEqual(invoiceForPurchase("2026-12-31", { closingDay: 31, dueDay: 31 }), { month: 1, year: 2027 });
  const first = invoiceForPurchase("2026-01-30", { closingDay: 29, dueDay: 5 });
  assert.deepEqual([0, 1, 2].map(i => shiftPeriod(first, i)), [{ month: 3, year: 2026 }, { month: 4, year: 2026 }, { month: 5, year: 2026 }]);
  assert.equal(invoiceDates({ month: 3, year: 2024 }, { closingDay: 31, dueDay: 5 }).closesAt, "2024-02-29");
});

test("summary deduplicates stable IDs and reports actual paid, remainder and credit", () => {
  const row = { id: "one", name: "Purchase", amount: 100, date: "2026-10-01", source: "VARIABLE" as const };
  assert.equal(invoiceSummary([row, row], 0, "2026-10-25", "2026-10-25").total, 100);
  assert.equal(invoiceSummary([row], 0, "2026-10-25", "2026-10-25").status, "OPEN");
  assert.equal(invoiceSummary([row], 0, "2026-10-25", "2026-10-26").status, "CLOSED");
  const partial = invoiceSummary([row], 25.01, "2026-10-25");
  assert.equal(partial.remaining, 74.99); assert.equal(partial.status, "PARTIALLY_PAID");
  const paid = invoiceSummary([row], 110, "2026-10-25");
  assert.equal(paid.status, "PAID"); assert.equal(paid.remaining, 0); assert.equal(paid.credit, 10);
  assert.equal(invoiceSummary([], 0, "2026-10-25", "2026-10-01").total, 0);
});

test("investment edits validate all fields and produce exact dated installments", () => {
  const data = investmentData({ description: "iPhone", amount: 6000, paymentMethod: "PARCELADO", installments: 10, date: "2026-01-31", creditCardId: "nubank" });
  assert.equal(data.autoCreateExpenses, true);
  const parts = investmentInstallments(data);
  assert.equal(parts.length, 10); assert.equal(parts[1].date.toISOString().slice(0, 10), "2026-02-28");
  assert.equal(sumMoney(parts.map(part => part.amount)), 6000);
  assert.throws(() => investmentData({ ...data, installments: 0 }));
  assert.throws(() => investmentData({ ...data, amount: 1.001 }));
});
