"use client";

import { useState } from "react";
import { CreditCard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";
import { canEdit } from "@/lib/permissions";
import { useFetch } from "@/lib/hooks";
import type { CreditCardInfo } from "./expense-payment-fields";

const EMPTY_CARD = { name: "", bank: "", brand: "", color: "#FF5A00", isActive: true };
const COLORS = ["#FF5A00", "#7C3AED", "#2563EB", "#059669", "#DB2777", "#1F2937"];

export function CreditCardsTab() {
  const { user } = useAuth();
  const editable = !!user && canEdit(user, "financeiro");
  const { data: cards, loading, error: loadError, refetch } = useFetch<CreditCardInfo[]>("/api/financeiro/credit-cards");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_CARD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCard(card?: CreditCardInfo) {
    setEditId(card?.id ?? null);
    setForm(card ? { name: card.name, bank: card.bank ?? "", brand: card.brand ?? "", color: card.color, isActive: card.isActive } : EMPTY_CARD);
    setError("");
    setShowModal(true);
  }

  async function saveCard() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/financeiro/credit-cards", {
        method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(editId ? { id: editId } : {}) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Não foi possível salvar o cartão.");
      setShowModal(false);
      await refetch();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o cartão."); }
    finally { setSaving(false); }
  }

  async function deleteCard(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/financeiro/credit-cards?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Não foi possível excluir o cartão.");
      await refetch();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível excluir o cartão."); }
  }

  return (
    <div className="animate-in fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-500">Identifique os cartões usados nas despesas apenas com nome, banco, bandeira e cor.</p>
        {editable && <button onClick={() => openCard()} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent-dark text-white rounded-xl transition-colors">
          <Plus size={16} /> Novo Cartão
        </button>}
      </div>
      {(loadError || (error && !showModal)) && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
        {loadError ? "Não foi possível carregar os cartões." : error}
        {loadError && <button onClick={refetch} className="ml-2 underline">Tentar novamente</button>}
      </p>}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
        : !loadError && !cards?.length ? <div className="rounded-2xl border border-gray-200 bg-white/80 px-6 py-12 text-center">
          <CreditCard size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">Nenhum cartão cadastrado.</p>
          <p className="text-xs text-gray-400 mt-1">Os cartões cadastrados ficam disponíveis nas despesas fixas e avulsas.</p>
        </div>
        : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards?.map((card) => <div key={card.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white/80">
            <div className="min-h-40 p-6 text-white flex flex-col justify-between gap-6" style={{ backgroundColor: card.color }}>
              <div className="flex justify-between items-center gap-3"><CreditCard size={27} /><span className="text-xs bg-black/30 rounded-full px-2.5 py-1">{card.isActive ? "Ativo" : "Inativo"}</span></div>
              <div className="min-w-0 rounded-lg bg-black/25 p-3">
                <h3 className="font-bold text-lg break-words">{card.name}</h3>
                <p className="text-xs text-white/90 mt-1 break-words">{[card.bank, card.brand].filter(Boolean).join(" · ") || "Cartão de crédito"}</p>
              </div>
            </div>
            {editable && <div className="flex justify-end gap-4 p-4">
              <button onClick={() => openCard(card)} className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-accent"><Pencil size={13} /> Editar</button>
              <button onClick={() => setDeleteId(card.id)} className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-600"><Trash2 size={13} /> Excluir</button>
            </div>}
          </div>)}
        </div>}
      <Modal open={showModal} onClose={() => { if (!saving) setShowModal(false); }} title={editId ? "Editar Cartão" : "Novo Cartão"}>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); saveCard(); }}>
          <Input label="Nome do cartão" placeholder="Ex: Nubank Empresa" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Banco (opcional)" placeholder="Ex: Nubank" maxLength={100} value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
            <Input label="Bandeira (opcional)" placeholder="Ex: Mastercard" maxLength={50} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs text-gray-500 uppercase tracking-wider font-medium">Cor do cartão</legend>
            <div className="flex flex-wrap gap-2 items-center">
              {COLORS.map((color) => <button key={color} type="button" aria-label={`Usar cor ${color}`} aria-pressed={form.color === color}
                onClick={() => setForm({ ...form, color })} style={{ backgroundColor: color }}
                className={`h-8 w-8 rounded-full border-2 ${form.color === color ? "ring-2 ring-accent ring-offset-2 border-white" : "border-transparent"}`} />)}
              <input aria-label="Cor personalizada do cartão" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-8 w-10 cursor-pointer" />
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Cartão ativo
          </label>
          <p className="text-xs text-gray-500">Cartões inativos permanecem no histórico das despesas e deixam de aparecer para novos lançamentos.</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" disabled={saving} onClick={() => setShowModal(false)} className="px-5 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">Cancelar</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="px-6 py-2 text-sm bg-accent hover:bg-accent-dark disabled:opacity-40 text-white font-bold rounded-xl">
              {saving ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar Cartão"}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteId} title="Excluir Cartão" message="Deseja excluir este cartão? Cartões com despesas vinculadas devem ser desativados para manter o histórico."
        confirmLabel="Excluir" cancelLabel="Cancelar" onConfirm={() => { const id = deleteId!; setDeleteId(null); deleteCard(id); }} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
