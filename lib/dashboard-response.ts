/** Never put an HTTP error object in the dashboard's render state. */
export async function readDashboardResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(response.status === 403
    ? "Você não tem permissão para visualizar o Dashboard."
    : "Não foi possível atualizar o Dashboard. Tente novamente.");
  const data = await response.json();
  if (!data || !data.stats || !Array.isArray(data.nextDeliveries) || !Array.isArray(data.upcomingRenewals) ||
      (data.financialSummary != null && (!Array.isArray(data.financialSummary.overdueClients) || !Array.isArray(data.financialSummary.upcomingCharges)))) {
    throw new Error("O Dashboard recebeu uma resposta incompleta. Tente novamente.");
  }
  return data as T;
}
