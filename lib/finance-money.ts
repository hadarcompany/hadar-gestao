/** Existing database amounts remain compatible; all new arithmetic uses integer cents. */
export function toCents(value: number | string | { toString(): string }): number {
  const amount = Number(value.toString());
  if (!Number.isFinite(amount) || Math.abs(amount) > 999_999_999_999.99) throw new Error("Valor financeiro inválido.");
  return Math.round((amount + Math.sign(amount) * Number.EPSILON) * 100);
}

export function moneyInput(value: unknown, allowZero = false): number {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") throw new Error("Informe um valor válido.");
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Informe um valor com até duas casas decimais.");
  const cents = toCents(text);
  if (cents < (allowZero ? 0 : 1)) throw new Error(allowZero ? "O valor não pode ser negativo." : "O valor deve ser maior que zero.");
  return cents / 100;
}

/** Distribute the remainder, rather than losing/creating cents in the last installment. */
export function splitInstallments(amount: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 600) throw new Error("Informe de 1 a 600 parcelas.");
  const cents = toCents(amount);
  if (cents < count) throw new Error("Cada parcela deve ter pelo menos R$ 0,01.");
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, i) => (base + (i < cents % count ? 1 : 0)) / 100);
}

export function sumMoney(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + toCents(value), 0) / 100;
}
