"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";
import { canEdit } from "@/lib/permissions";
import { useFetch } from "@/lib/hooks";
import { addCalendarMonths, invoiceDates, invoiceForPurchase, shiftPeriod } from "@/lib/card-invoices";
import { formatDateBR, getTodayKey } from "@/lib/dates";
import { splitInstallments, sumMoney, toCents } from "@/lib/finance-money";
import type { CreditCardInfo } from "./expense-payment-fields";

type Investment = { id: string; description: string; amount: number; paymentMethod: string; installments: number | null; date: string; paidWithCash: boolean; creditCardId: string | null; creditCard: CreditCardInfo | null; autoCreateExpenses: boolean; _count: { expenses: number } };
type Form = { description: string; amount: string; paymentMethod: string; installments: string; date: string; paidWithCash: boolean; creditCardId: string };
type Preview = { installmentNumber: number; amount: number; date: string; purchaseDate: string };
const emptyForm: Form = { description: "", amount: "", paymentMethod: "A_VISTA", installments: "", date: "", paidWithCash: false, creditCardId: "" };
const money = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function schedule(amount: number, paymentMethod: string, installments: number | null, date: string, card?: CreditCardInfo | null): Preview[] {
  const amounts = splitInstallments(amount, paymentMethod === "PARCELADO" ? installments ?? 1 : 1);
  const first = card?.closingDay && card?.dueDay ? invoiceForPurchase(date, { closingDay: card.closingDay, dueDay: card.dueDay }) : null;
  return amounts.map((value, index) => ({ installmentNumber: index + 1, amount: value, purchaseDate: addCalendarMonths(date, index), date: first && card ? invoiceDates(shiftPeriod(first, index), { closingDay: card.closingDay ?? null, dueDay: card.dueDay ?? null }).dueAt : addCalendarMonths(date, index) }));
}

function ExistingExpensePicker({ preview, cardId, ids, onChange }: { preview: Preview[]; cardId: string; ids: string[]; onChange: (ids: string[]) => void }) {
  const { data, loading, error } = useFetch<Array<{ id: string; name: string; amount: number; date: string; investmentId: string | null; creditCardId: string | null; paidWithCash: boolean }>>("/api/financeiro/variable-expenses");
  if (loading) return <p className="text-sm text-gray-500">Carregando despesas existentes...</p>;
  if (error) return <p role="alert" className="text-sm text-red-600">Não foi possível carregar as despesas existentes. Feche e reabra este formulário para tentar novamente.</p>;
  return <div className="space-y-3 rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Selecione cada lançamento já cadastrado. Ele será vinculado e atualizado, sem criar outra cópia.</p>{preview.map((part, index) => {
    const candidates = (data ?? []).filter(expense => !expense.investmentId && !expense.paidWithCash && (!expense.creditCardId || expense.creditCardId === cardId) && toCents(expense.amount) === toCents(part.amount) && [part.date, part.purchaseDate].includes(expense.date.slice(0, 10)) && (!ids.includes(expense.id) || ids[index] === expense.id));
    return <SelectField key={part.installmentNumber} label={`Parcela ${part.installmentNumber} · ${money(part.amount)}`} value={ids[index] ?? ""} placeholder={candidates.length ? "Selecione a despesa correspondente" : "Nenhuma despesa com este valor e data"} options={candidates.map(expense => ({ value: expense.id, label: `${expense.name} · ${formatDateBR(expense.date)} · ${money(expense.amount)}` }))} onChange={value => { const next = [...ids]; next[index] = value; onChange(next); }} />;
  })}</div>;
}

export function InvestmentsTab({ initialEditId, onEditOpened }: { initialEditId?: string | null; onEditOpened?: () => void }) {
  const { user } = useAuth();
  const editable = !!user && canEdit(user, "financeiro");
  const { data: cards, error: cardsError } = useFetch<CreditCardInfo[]>("/api/financeiro/credit-cards");
  const [items, setItems] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [useExisting, setUseExisting] = useState(false);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch("/api/financeiro/investments", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível carregar os investimentos."); setItems(result); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar os investimentos."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);
  const openInvestment = useCallback((investment?: Investment) => {
    setEditId(investment?.id ?? null); setError(""); setUseExisting(false); setExistingIds([]); setRequestId(crypto.randomUUID());
    setForm(investment ? { description: investment.description, amount: String(investment.amount), paymentMethod: investment.paymentMethod, installments: investment.installments ? String(investment.installments) : "", date: investment.date.slice(0, 10), paidWithCash: investment.paidWithCash, creditCardId: investment.creditCardId ?? "" } : emptyForm); setShowModal(true);
  }, []);
  useEffect(() => { if (!initialEditId || loading || !editable) return; const found = items.find(item => item.id === initialEditId); if (found) openInvestment(found); onEditOpened?.(); }, [initialEditId, loading, items, editable, openInvestment, onEditOpened]);

  const selectedInvestment = items.find(item => item.id === editId);
  const selectedCard = (cards ?? []).find(card => card.id === form.creditCardId) ?? (selectedInvestment?.creditCard?.id === form.creditCardId ? selectedInvestment.creditCard : null);
  const availableCards = (cards ?? []).filter(card => card.isActive || card.id === selectedInvestment?.creditCardId);
  if (selectedInvestment?.creditCard && !availableCards.some(card => card.id === selectedInvestment.creditCardId)) availableCards.push(selectedInvestment.creditCard);
  let preview: Preview[] = [];
  try { if (form.amount && form.date) preview = schedule(Number(form.amount), form.paymentMethod, Number(form.installments) || null, form.date, selectedCard); } catch { /* Validation is shown on save; incomplete forms have no preview. */ }
  function change(values: Partial<Form>) { setForm(current => ({ ...current, ...values })); setExistingIds([]); }

  async function saveInvestment() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/financeiro/investments", { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editId ?? undefined, requestId, installments: form.paymentMethod === "PARCELADO" ? form.installments : null, creditCardId: form.creditCardId || null, autoCreateExpenses: useExisting || (selectedInvestment?.autoCreateExpenses ?? true), existingExpenseIds: useExisting ? existingIds : undefined }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível salvar o investimento.");
      setShowModal(false); setEditId(null); setForm(emptyForm); await fetchItems();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o investimento."); }
    finally { setSaving(false); }
  }
  async function deleteInvestment(id: string) {
    setError("");
    try { const response = await fetch(`/api/financeiro/investments?id=${encodeURIComponent(id)}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível excluir o investimento."); await fetchItems(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível excluir o investimento."); }
  }
  const progress = (investment: Investment) => {
    try {
      const parts = schedule(investment.amount, investment.paymentMethod, investment.installments, investment.date, investment.creditCard);
      const elapsed = sumMoney(parts.filter(part => part.date <= getTodayKey()).map(part => part.amount));
      const next = parts.find(part => part.date > getTodayKey());
      return { elapsed, remaining: Math.max(0, toCents(investment.amount) - toCents(elapsed)) / 100, next: next?.amount ?? 0 };
    } catch { return { elapsed: 0, remaining: investment.amount, next: 0 }; }
  };
  const metrics = [["Total", sumMoney(items.map(item => item.amount)), "text-red-600"], ["Previsto até hoje", sumMoney(items.map(item => progress(item).elapsed)), "text-emerald-600"], ["Ainda previsto", sumMoney(items.map(item => progress(item).remaining)), "text-amber-600"], ["Próximas parcelas", sumMoney(items.map(item => progress(item).next)), "text-blue-600"]] as const;

  return <div className="space-y-5">
    <div className="flex justify-between items-center gap-4 flex-wrap"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{metrics.map(([label, value, color]) => <div key={label} className="bg-white/80 border border-gray-200/60 rounded-2xl px-5 py-3"><p className="text-xs text-gray-500 mb-1">{label}</p><p className={`text-xl font-bold tabular-nums ${color}`}>{money(value)}</p></div>)}</div>{editable && <button type="button" onClick={() => openInvestment()} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent-dark text-white rounded-xl"><Plus size={16} /> Novo Investimento</button>}</div>
    <p className="text-xs text-gray-500">O progresso acima é uma previsão por data, sem confirmar pagamento. Valores efetivamente pagos são informados nas faturas em Cartões.</p>
    {error && !showModal && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> : <div className="bg-white/80 border border-gray-200/60 rounded-2xl overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-gray-500">{["Descrição", "Valor total", "Previsto até hoje", "Ainda previsto", "Próxima parcela", "Pagamento", "Data inicial", "Origem", "Ações"].map(label => <th key={label} className="px-4 py-3 text-left font-medium whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{!items.length ? <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-500">Nenhum investimento registrado.</td></tr> : items.map(investment => <tr key={investment.id} className="border-b border-gray-100 hover:bg-gray-50"><td className="px-4 py-4 font-medium">{investment.description}</td><td className="px-4 py-4 text-right tabular-nums font-semibold">{money(investment.amount)}</td><td className="px-4 py-4 text-right tabular-nums">{money(progress(investment).elapsed)}</td><td className="px-4 py-4 text-right tabular-nums">{money(progress(investment).remaining)}</td><td className="px-4 py-4 text-right tabular-nums">{progress(investment).next ? money(progress(investment).next) : "—"}</td><td className="px-4 py-4">{investment.paymentMethod === "PARCELADO" ? `${investment.installments} parcelas` : "À vista"}<p className="text-xs text-gray-500 mt-1">{investment.creditCard?.name ?? "Sem cartão"}</p></td><td className="px-4 py-4 whitespace-nowrap">{formatDateBR(investment.date)}</td><td className="px-4 py-4">{investment.paidWithCash ? "Caixa" : "Operacional"}</td><td className="px-4 py-4">{editable && <div className="flex gap-4"><button type="button" onClick={() => openInvestment(investment)} aria-label={`Editar investimento ${investment.description}`} className="flex gap-1 items-center text-xs font-bold text-gray-500 hover:text-accent"><Pencil size={13} /> Editar</button><button type="button" onClick={() => setDeleteId(investment.id)} className="text-xs font-bold text-gray-500 hover:text-red-600">Excluir</button></div>}</td></tr>)}</tbody></table></div>}
    <Modal open={showModal} onClose={() => { if (!saving) setShowModal(false); }} title={editId ? "Editar investimento" : "Novo Investimento"}>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); saveInvestment(); }}>
        <Input label="Nome ou descrição (equipamento, curso, software...)" aria-label="Nome ou descrição do investimento" required maxLength={500} value={form.description} onChange={event => change({ description: event.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Input label="Valor total (R$)" aria-label="Valor total do investimento" type="number" required min="0.01" step="0.01" value={form.amount} onChange={event => change({ amount: event.target.value })} /><SelectField label="Forma de pagamento" value={form.paymentMethod} onChange={value => change({ paymentMethod: value, installments: "" })} options={[{ value: "A_VISTA", label: "À vista" }, { value: "PARCELADO", label: "Parcelado" }]} /></div>
        <SelectField label="Cartão vinculado (opcional)" value={form.creditCardId} options={[{ value: "", label: "Sem cartão vinculado" }, ...availableCards.map(card => ({ value: card.id, label: `${card.name}${card.isActive ? "" : " (inativo)"}` }))]} onChange={value => change({ creditCardId: value })} />
        {cardsError && <p role="alert" className="text-sm text-red-600">Não foi possível carregar os cartões. Reabra o formulário para tentar novamente.</p>}
        {selectedCard && (!selectedCard.closingDay || !selectedCard.dueDay) && <p role="alert" className="text-sm text-amber-700">Configure o fechamento e o vencimento deste cartão na aba Cartões antes de vinculá-lo.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Input label={form.creditCardId ? "Data da compra" : form.paymentMethod === "PARCELADO" ? "Data da 1ª parcela" : "Data do pagamento"} aria-label="Data inicial do investimento" type="date" required value={form.date} onChange={event => change({ date: event.target.value })} />{form.paymentMethod === "PARCELADO" && <Input label="Número de parcelas" aria-label="Número de parcelas do investimento" type="number" required min="2" max="600" value={form.installments} onChange={event => change({ installments: event.target.value })} />}</div>
        {!!preview.length && <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-2"><p>{preview.length > 1 ? `${preview.length} parcelas, a partir de ${money(preview[0].amount)}` : `Lançamento de ${money(preview[0].amount)}`}</p><p className="text-gray-500 text-xs">Primeira data: {formatDateBR(preview[0].date)} · Última: {formatDateBR(preview[preview.length - 1].date)}. Os centavos são distribuídos para manter o total exato.{form.creditCardId ? " As datas seguem o vencimento das faturas do cartão." : " As parcelas serão lançadas automaticamente em Despesas Avulsas."}</p></div>}
        {!selectedInvestment?._count.expenses && <label className="flex items-center gap-3 text-sm text-gray-600"><input type="checkbox" checked={useExisting} onChange={event => { setUseExisting(event.target.checked); setExistingIds([]); }} /> Usar despesas já cadastradas</label>}
        {useExisting && !!preview.length && <ExistingExpensePicker preview={preview} cardId={form.creditCardId} ids={existingIds} onChange={setExistingIds} />}
        <label className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-200"><input type="checkbox" checked={form.paidWithCash} onChange={event => change({ paidWithCash: event.target.checked })} /> Investimento pago com Saldo do Caixa</label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200"><button type="button" disabled={saving} onClick={() => setShowModal(false)} className="px-5 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">Cancelar</button><button type="submit" disabled={saving || (useExisting && (!preview.length || preview.some((_, index) => !existingIds[index])))} className="px-6 py-2 text-sm bg-accent hover:bg-accent-dark disabled:opacity-40 text-white font-bold rounded-xl">{saving ? "Salvando..." : editId ? "Salvar alterações" : "Registrar Investimento"}</button></div>
      </form>
    </Modal>
    <ConfirmDialog open={!!deleteId} title="Excluir Investimento" message="Excluir este investimento? As despesas já lançadas serão mantidas e deixarão de estar vinculadas ao investimento. Uma retirada do Caixa vinculada ao investimento será removida." confirmLabel="Sim, excluir" cancelLabel="Cancelar" onConfirm={() => { const id = deleteId!; setDeleteId(null); deleteInvestment(id); }} onCancel={() => setDeleteId(null)} />
  </div>;
}
