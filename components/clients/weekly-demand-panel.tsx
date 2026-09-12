"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Check } from "lucide-react";

interface DemandRow {
  deliveryType: string;
  label: string;
  quantity: number;
  configured: boolean;
}

export function WeeklyDemandPanel({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasAnyDemand, setHasAnyDemand] = useState(false);

  const fetchDemand = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/weekly-demand`);
      const data = await res.json();
      setRows(data.current ?? []);
      setHasAnyDemand(!!data.hasAnyDemand);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchDemand(); }, [fetchDemand]);

  function updateQty(deliveryType: string, quantity: number) {
    setRows((prev) => prev.map((r) => (r.deliveryType === deliveryType ? { ...r, quantity } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/weekly-demand`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: rows.map((r) => ({ deliveryType: r.deliveryType, quantity: r.quantity })) }),
      });
      if (res.ok) {
        const data = await res.json();
        setRows(data.current ?? []);
        setHasAnyDemand(data.current?.some((r: DemandRow) => r.configured) ?? false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>;

  return (
    <div className="max-w-md">
      <p className="text-xs text-gray-400 mb-4">
        {hasAnyDemand
          ? "Quantidade combinada por tipo de entrega, por semana. Alterar aqui não muda a avaliação de semanas passadas."
          : "Nenhuma demanda semanal configurada para este cliente ainda. Defina abaixo o combinado por tipo de entrega."}
      </p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.deliveryType} className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <span className="text-sm text-gray-700 font-medium">{row.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={row.quantity}
                onChange={(e) => updateQty(row.deliveryType, Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 text-center bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-gray-400">por semana</span>
            </div>
          </div>
        ))}
      </div>

      {success && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-4 flex items-center gap-2">
          <Check size={14} /> Demanda semanal atualizada.
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg transition-colors"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Salvar demanda
      </button>
    </div>
  );
}
