/** Cada cadastro permanece no orçamento mensal até ser excluído explicitamente. */
export function fixedExpenseTotals(expenses: readonly { amount: number; category: string }[], monthCount = 1) {
  const monthlyTotal = expenses.reduce((total, expense) => total + expense.amount, 0);
  const byCategory = new Map<string, number>();
  for (const expense of expenses) {
    byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + expense.amount * monthCount);
  }
  return { monthlyTotal, periodTotal: monthlyTotal * monthCount, byCategory };
}
