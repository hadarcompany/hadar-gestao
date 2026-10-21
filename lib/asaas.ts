import type { AsaasBillingType, ReceivableStatus } from "@prisma/client";
import { AsaasApiError } from "./asaas-integration";
import { getAsaasRuntimeConfig } from "./asaas-integration-server";
export { AsaasApiError } from "./asaas-integration";
export { getAsaasConfig } from "./asaas-integration-server";

type AsaasList<T> = {
  object: "list";
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
};

export type AsaasCustomer = {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  billingType: AsaasBillingType;
  status: string;
  dueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  confirmedDate?: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  deleted?: boolean;
};

export async function asaasRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestAsaasWithConfig<T>(await getAsaasRuntimeConfig(), path, init);
}

export async function requestAsaasWithConfig<T>(config: { apiKey: string; baseUrl: string }, path: string, init: RequestInit = {}, request: typeof fetch = fetch): Promise<T> {
  const { apiKey, baseUrl } = config;
  if (!["https://api.asaas.com/v3", "https://api-sandbox.asaas.com/v3"].includes(baseUrl) || !path.startsWith("/") || path.startsWith("//")) throw new AsaasApiError("Endereço do Asaas inválido.", 400);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("User-Agent", process.env.ASAAS_USER_AGENT || "HadarGestao/1.0");
  headers.set("access_token", apiKey);

  const response = await request(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers,
    signal: init.signal || AbortSignal.timeout(30_000),
    redirect: "error",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errors = payload && typeof payload === "object" && "errors" in payload
      ? (payload as { errors?: { description?: string }[] }).errors
      : null;
    const message = errors?.map((item) => item.description).filter(Boolean).join(" ") || `Erro ${response.status} ao comunicar com o Asaas.`;
    throw new AsaasApiError(message.replaceAll(apiKey, "[chave omitida]"), response.status);
  }
  return payload as T;
}

export async function findAsaasCustomerByExternalReference(externalReference: string) {
  const result = await asaasRequest<AsaasList<AsaasCustomer>>(`/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
  return result.data[0] ?? null;
}

export async function createAsaasCustomer(input: {
  name: string;
  cpfCnpj: string;
  email?: string | null;
  phone?: string | null;
  externalReference: string;
}) {
  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
      email: input.email || undefined,
      mobilePhone: input.phone?.replace(/\D/g, "") || undefined,
      externalReference: input.externalReference,
    }),
  });
}

export async function getAsaasCustomer(id: string) {
  return asaasRequest<AsaasCustomer>(`/customers/${encodeURIComponent(id)}`);
}

export async function findAsaasPaymentByExternalReference(externalReference: string) {
  const result = await asaasRequest<AsaasList<AsaasPayment>>(`/payments?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
  return result.data[0] ?? null;
}

export async function getAsaasPayment(id: string, timeoutMs = 30000) {
  return asaasRequest<AsaasPayment>(`/payments/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(timeoutMs)});
}

export async function createAsaasPayment(input: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string | null;
  externalReference: string;
}) {
  return asaasRequest<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description || undefined,
      externalReference: input.externalReference,
    }),
  });
}

export async function listAsaasPayments(input: { dueDateFrom: string; dueDateTo: string }) {
  const payments: AsaasPayment[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const query = new URLSearchParams({
      "dueDate[ge]": input.dueDateFrom,
      "dueDate[le]": input.dueDateTo,
      limit: "100",
      offset: String(offset),
    });
    const page = await asaasRequest<AsaasList<AsaasPayment>>(`/payments?${query}`);
    payments.push(...page.data);
    hasMore = page.hasMore;
    offset += page.limit || 100;
  }
  return payments;
}

export function mapAsaasStatus(status?: string): ReceivableStatus {
  if (["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(status || "")) return "PAID";
  if (status === "OVERDUE") return "OVERDUE";
  return "PENDING";
}

export function paymentDateFromAsaas(payment: AsaasPayment): Date | null {
  const value = payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate;
  return value ? asaasDate(value) : null;
}

function asaasDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AsaasApiError("O Asaas retornou uma data inválida.", 502);
  }
  return date;
}

export function paymentUpdateData(payment: AsaasPayment, previousPaidDate?: Date|null) {
  if(!payment.id || !Number.isFinite(payment.value) || payment.value<0)throw new AsaasApiError('O Asaas retornou uma cobrança inválida.',502);
  const status = mapAsaasStatus(payment.status);
  return {
    amount:payment.value,
    dueDate:asaasDate(payment.dueDate),
    month:Number(payment.dueDate.slice(5,7)),
    year:Number(payment.dueDate.slice(0,4)),
    asaasPaymentId: payment.id,
    asaasStatus: payment.deleted ? 'DELETED' : payment.status,
    billingType: payment.billingType,
    asaasInvoiceUrl: payment.invoiceUrl || null,
    asaasBankSlipUrl: payment.bankSlipUrl || null,
    asaasNetValue: payment.netValue ?? null,
    asaasSyncedAt: new Date(),
    asaasSyncError: null,
    status,
    paidDate: status === "PAID" ? paymentDateFromAsaas(payment) || previousPaidDate || new Date() : null,
  };
}
