import assert from "node:assert/strict";
import { test } from "node:test";
import { ExpensePaymentError, expensePaymentLabel, parseExpensePayment, validateExpenseCard, type ExpensePayment } from "../lib/expense-payments";

const credit: ExpensePayment = { paymentMethod: "CREDIT_CARD", creditCardId: "card-1" };

test("despesas antigas sem forma de pagamento continuam editáveis", () => {
  assert.deepEqual(parseExpensePayment({}), { paymentMethod: null, creditCardId: null });
  assert.deepEqual(parseExpensePayment({ amount: 100 }, credit), credit);
  assert.equal(expensePaymentLabel({ paymentMethod: null }), "Não informado");
});

test("Pix, boleto e outros pagamentos não mantêm vínculo de cartão", () => {
  for (const paymentMethod of ["PIX", "BOLETO", "CASH", "BANK_TRANSFER", "OTHER"]) {
    assert.deepEqual(parseExpensePayment({ paymentMethod }, credit), { paymentMethod, creditCardId: null });
    assert.deepEqual(parseExpensePayment({ paymentMethod, creditCardId: "card-1" }), { paymentMethod, creditCardId: null });
  }
});

test("crédito exige uma identificação válida de cartão", () => {
  for (const creditCardId of [undefined, null, "", "   ", 123]) {
    assert.throws(() => parseExpensePayment({ paymentMethod: "CREDIT_CARD", creditCardId }), ExpensePaymentError);
  }
  assert.deepEqual(parseExpensePayment({ paymentMethod: "CREDIT_CARD", creditCardId: " card-1 " }), credit);
  assert.deepEqual(parseExpensePayment({ creditCardId: "card-2" }, credit), { ...credit, creditCardId: "card-2" });
});

test("formas inválidas são rejeitadas e não alteram a despesa", () => {
  for (const paymentMethod of ["A_VISTA", "pix", 1, {}, true]) {
    assert.throws(() => parseExpensePayment({ paymentMethod }), ExpensePaymentError);
  }
});

test("cartão ativo é aceito e inexistente é rejeitado", () => {
  assert.doesNotThrow(() => validateExpenseCard(credit, { id: "card-1", isActive: true }));
  assert.throws(() => validateExpenseCard(credit, null), /não encontrado/);
});

test("cartão inativo preserva histórico e não aceita novas associações", () => {
  const card = { id: "card-1", isActive: false };
  assert.throws(() => validateExpenseCard(credit, card), /inativo/);
  assert.doesNotThrow(() => validateExpenseCard(credit, card, credit));
  assert.throws(() => validateExpenseCard(credit, card, { ...credit, creditCardId: "card-2" }), /inativo/);
  assert.throws(() => validateExpenseCard(credit, card, { paymentMethod: "PIX", creditCardId: null }), /inativo/);
});

test("origem da reserva do caixa é independente da forma de pagamento", () => {
  assert.deepEqual(parseExpensePayment({ paymentMethod: "PIX", paidWithCash: true }), { paymentMethod: "PIX", creditCardId: null });
  assert.deepEqual(parseExpensePayment({ ...credit, paidWithCash: false }), credit);
});

test("identificação do cartão aparece no pagamento da despesa", () => {
  assert.equal(expensePaymentLabel({ paymentMethod: "CREDIT_CARD", creditCard: { name: "Nubank Empresa" } }), "Cartão de crédito · Nubank Empresa");
  assert.equal(expensePaymentLabel({ paymentMethod: "BOLETO" }), "Boleto");
});
