export const EXPENSE_PAYMENT_OPTIONS = [
  { value: "PIX", label: "Pix" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CREDIT_CARD", label: "Cartão de crédito" },
  { value: "CASH", label: "Dinheiro" },
  { value: "BANK_TRANSFER", label: "Transferência bancária" },
  { value: "OTHER", label: "Outro" },
] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_OPTIONS)[number]["value"];
export type ExpensePayment = { paymentMethod: ExpensePaymentMethod | null; creditCardId: string | null };

export class ExpensePaymentError extends Error {}

/** Preserva a forma antiga quando um PATCH altera apenas outros campos. */
export function parseExpensePayment(body: Record<string, unknown>, existing?: ExpensePayment): ExpensePayment {
  const rawMethod = body.paymentMethod === undefined ? existing?.paymentMethod : body.paymentMethod;
  const paymentMethod = rawMethod === null || rawMethod === undefined || rawMethod === "" ? null : rawMethod;
  if (paymentMethod !== null && !EXPENSE_PAYMENT_OPTIONS.some((option) => option.value === paymentMethod)) {
    throw new ExpensePaymentError("Forma de pagamento inválida.");
  }
  if (paymentMethod !== "CREDIT_CARD") return { paymentMethod: paymentMethod as ExpensePaymentMethod | null, creditCardId: null };
  const creditCardId = body.creditCardId === undefined ? existing?.creditCardId : body.creditCardId;
  if (typeof creditCardId !== "string" || !creditCardId.trim()) {
    throw new ExpensePaymentError("Selecione o cartão de crédito utilizado.");
  }
  return { paymentMethod, creditCardId: creditCardId.trim() };
}

export function validateExpenseCard(
  payment: ExpensePayment,
  card: { id: string; isActive: boolean } | null,
  existing?: ExpensePayment,
) {
  if (payment.paymentMethod !== "CREDIT_CARD") return;
  if (!card) throw new ExpensePaymentError("Cartão de crédito não encontrado.");
  // Um cartão desativado continua disponível apenas na despesa já vinculada a ele.
  if (!card.isActive && !(existing?.paymentMethod === "CREDIT_CARD" && existing.creditCardId === card.id)) {
    throw new ExpensePaymentError("Este cartão está inativo. Selecione um cartão ativo.");
  }
}

export function expensePaymentLabel(expense: { paymentMethod: string | null; creditCard?: { name: string } | null }) {
  const label = EXPENSE_PAYMENT_OPTIONS.find((option) => option.value === expense.paymentMethod)?.label ?? "Não informado";
  return expense.paymentMethod === "CREDIT_CARD" && expense.creditCard ? `${label} · ${expense.creditCard.name}` : label;
}
