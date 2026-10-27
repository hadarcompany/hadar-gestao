"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateBR } from "@/lib/dates";
import type { InvoiceLine } from "@/lib/card-invoices";
import type { CreditCardInfo } from "./expense-payment-fields";

type Invoice = { month: number; year: number; startsAt: string; closesAt: string; dueAt: string; total: number; paid: number; remaining: number; credit: number; status: string; lines: InvoiceLine[] };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUSES: Record<string, string> = { OPEN: "Aberta", CLOSED: "Fechada", PAID: "Paga", PARTIALLY_PAID: "Parcialmente paga" };

export function CardInvoicePanel({ card, month, year, editable }: { card: CreditCardInfo; month: number; year: number; editable: boolean }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [paid, setPaid] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const reloadInvoice = useCallback(() => setReload(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setMessage("");
    if (!card.closingDay || !card.dueDay) { setInvoice(null); setLoading(false); return () => controller.abort(); }
    fetch(`/api/financeiro/credit-cards/invoices?creditCardId=${encodeURIComponent(card.id)}&month=${month}&year=${year}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível carregar a fatura."); return result as Invoice; })
      .then(result => { if (!controller.signal.aborted) { setInvoice(result); setPaid(result.paid.toFixed(2)); } })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível carregar a fatura."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [card.id, card.closingDay, card.dueDay, month, year, reload]);

  async function savePayment() {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/financeiro/credit-cards/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creditCardId: card.id, month, year, paidAmount: paid }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o pagamento.");
      setInvoice(result); setPaid(Number(result.paid).toFixed(2)); setEditing(false); setMessage("Valor pago atualizado.");
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o pagamento."); }
    finally { setSaving(false); }
  }

  if (!card.closingDay || !card.dueDay) return <p className="p-4 text-sm text-gray-500">Edite o cartão e informe os dias de fechamento e vencimento para consultar as faturas.</p>;
  return <div className="p-4 space-y-4 border-t border-gray-200">
    {loading ? <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Carregando fatura...</p> : invoice && <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-gray-700">Fatura {String(month).padStart(2, "0")}/{year}</h4><span className={`text-xs rounded px-2 py-1 ${invoice.status === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{STATUSES[invoice.status]}</span></div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{money(invoice.total)}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-gray-500">Valor pago</dt><dd className="font-semibold tabular-nums">{money(invoice.paid)}</dd></div><div><dt className="text-gray-500">Valor restante</dt><dd className="font-semibold tabular-nums">{money(invoice.remaining)}</dd></div></dl>
      {invoice.credit > 0 && <p className="text-sm text-emerald-700">Crédito informado: {money(invoice.credit)}</p>}
      <p className="text-xs text-gray-500">Fechamento: {formatDateBR(invoice.closesAt)} · Vencimento: {formatDateBR(invoice.dueAt)}</p>
      <div className="flex flex-wrap gap-4"><button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="text-sm font-medium text-accent hover:underline">{expanded ? "Ocultar lançamentos" : `Ver lançamentos (${invoice.lines.length})`}</button>{editable && <button type="button" onClick={() => { setEditing(!editing); setPaid(invoice.paid.toFixed(2)); setError(""); }} className="text-sm font-medium text-gray-600 hover:text-accent">Informar valor pago</button>}</div>
      {editing && <form className="space-y-3" onSubmit={event => { event.preventDefault(); savePayment(); }}>
        <Input aria-label={`Valor efetivamente pago da fatura de ${card.name}`} label="Valor efetivamente pago (R$)" type="number" min="0" step="0.01" required value={paid} onChange={event => setPaid(event.target.value)} />
        <p className="text-xs text-gray-500">Informe o total já pago nesta fatura. Este valor substitui o anterior e não cria outra despesa nem retirada do Caixa.</p>
        <button type="submit" disabled={saving} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-accent-dark">{saving ? "Salvando..." : "Salvar valor pago"}</button>
      </form>}
      {expanded && <div className="space-y-3"><p className="text-xs text-gray-500">Compras de {formatDateBR(invoice.startsAt)} a {formatDateBR(invoice.closesAt)}. Despesas fixas são recorrentes; investimentos aparecem uma vez por parcela.</p>{!invoice.lines.length ? <p className="text-sm text-gray-500">Nenhum lançamento nesta fatura.</p> : <ul className="divide-y divide-gray-100">{invoice.lines.map(line => <li key={line.id} className="py-2 flex items-start justify-between gap-3 text-sm"><div className="min-w-0"><p className="break-words text-gray-800">{line.name}</p><p className="text-xs text-gray-500">{formatDateBR(line.date)} · {line.source === "FIXED" ? "Fixa mensal" : line.source === "INVESTMENT" ? "Investimento" : "Avulsa"}</p></div><span className="shrink-0 font-semibold tabular-nums">{money(line.amount)}</span></li>)}</ul>}</div>}
    </>}
    {error && <p role="alert" className="text-sm text-red-600">{error} {!invoice && <button type="button" className="underline" onClick={reloadInvoice}>Tentar novamente</button>}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
  </div>;
}
