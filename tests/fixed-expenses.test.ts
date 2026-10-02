import assert from "node:assert/strict";
import { test } from "node:test";
import { fixedExpenseTotals } from "../lib/fixed-expenses";

const expenses = [
  { id: "rent", amount: 1500, category: "LOCACAO", month: 4, year: 2026 },
  { id: "software", amount: 120, category: "SOFTWARES", month: 9, year: 2026 },
];

test("cadastros antigos entram todo mês e o período soma uma recorrência por mês", () => {
  assert.equal(fixedExpenseTotals(expenses).monthlyTotal, 1620);
  const quarter = fixedExpenseTotals(expenses, 3);
  assert.equal(quarter.periodTotal, 4860);
  assert.deepEqual(Object.fromEntries(quarter.byCategory), { LOCACAO: 4500, SOFTWARES: 360 });
  assert.equal(fixedExpenseTotals(expenses, 12).periodTotal, 19440);
});

test("editar muda a base mensal; remover só sai quando o cadastro é excluído", () => {
  assert.equal(fixedExpenseTotals(expenses.map((expense) => expense.id === "rent" ? { ...expense, amount: 1600 } : expense)).monthlyTotal, 1720);
  assert.equal(fixedExpenseTotals(expenses.filter((expense) => expense.id !== "rent"), 12).periodTotal, 1440);
  assert.equal(fixedExpenseTotals([], 12).periodTotal, 0);
  // Cadastros distintos não são mesclados só por terem nomes/categorias iguais.
  assert.equal(fixedExpenseTotals([expenses[1], { ...expenses[1], id: "other" }]).monthlyTotal, 240);
});
