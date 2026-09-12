"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Badge } from "@/components/ui/badge";
import {
  Target, Plus, Loader2, Trash2, TrendingUp, Users, BarChart3,
  CheckCircle, Clock, AlertTriangle,
} from "lucide-react";

// ── types ────────────────────────────────────────────────────────
interface Goal {
  id: string; title: string; type: string; targetValue: number;
  period: string; month: number; year: number; status: string;
  customValue: number | null; currentValue: number; progress: number;
}

// ── constants ───────────────────────────────────────────────────
const NOW = new Date();
const CURRENT_MONTH = NOW.getMonth() + 1;
const CURRENT_YEAR = NOW.getFullYear();

const GOAL_TYPES = [
  { value: "REVENUE", label: "Faturamento mensal", icon: <TrendingUp size={14} />, unit: "R$", color: "text-emerald-600" },
  { value: "NEW_CLIENTS", label: "Novos clientes", icon: <Users size={14} />, unit: "", color: "text-blue-600" },
  { value: "RETENTION", label: "Taxa de retenção", icon: <BarChart3 size={14} />, unit: "%", color: "text-purple-600" },
  { value: "TASKS_ON_TIME", label: "Tarefas no prazo", icon: <CheckCircle size={14} />, unit: "%", color: "text-cyan-600" },
  { value: "AVG_NPS", label: "NPS médio", icon: <Target size={14} />, unit: "", color: "text-accent" },
  { value: "CUSTOM", label: "Meta personalizada", icon: <Target size={14} />, unit: "", color: "text-gray-600" },
];

function getGoalType(type: string) {
  return GOAL_TYPES.find((t) => t.value === type) || GOAL_TYPES[5];
}

function formatValue(value: number, type: string): string {
  const gt = getGoalType(type);
  if (gt.unit === "R$") return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (gt.unit === "%") return `${value.toFixed(1)}%`;
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function statusBadge(status: string) {
  switch (status) {
    case "ACHIEVED": return <Badge variant="success">Atingido</Badge>;
    case "BEHIND": return <Badge variant="danger">Atrasado</Badge>;
    default: return <Badge variant="info">No caminho</Badge>;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "ACHIEVED": return <CheckCircle size={16} className="text-emerald-600" />;
    case "BEHIND": return <AlertTriangle size={16} className="text-red-600" />;
    default: return <Clock size={16} className="text-blue-600" />;
  }
}

// ── main component ──────────────────────────────────────────────
export default function MetasPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [period, setPeriod] = useState<"MONTHLY" | "QUARTERLY">("MONTHLY");

  // Form
  const [form, setForm] = useState({
    title: "", type: "REVENUE", targetValue: "", period: "MONTHLY" as string,
    customValue: "",
  });

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/goals?month=${month}&year=${year}&period=${period}`);
      if (res.ok) setGoals(await res.json());
    } finally { setLoading(false); }
  }, [month, year, period]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  async function handleCreate() {
    setSaving(true);
    try {
      const gt = getGoalType(form.type);
      const title = form.title || gt.label;
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type: form.type,
          targetValue: form.targetValue,
          period: form.period,
          month,
          year,
          customValue: form.type === "CUSTOM" ? form.customValue : null,
        }),
      });
      setShowModal(false);
      setForm({ title: "", type: "REVENUE", targetValue: "", period: "MONTHLY", customValue: "" });
      fetchGoals();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    fetchGoals();
  }

  async function updateCustomValue(id: string, value: string) {
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customValue: value }),
    });
    fetchGoals();
  }

  // Summary
  const achieved = goals.filter((g) => g.status === "ACHIEVED").length;
  const behind = goals.filter((g) => g.status === "BEHIND").length;
  const onTrack = goals.filter((g) => g.status === "ON_TRACK").length;

  return (
    <div>
      <PageHeader title="Metas / OKRs" description="Acompanhamento de metas e objetivos.">
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors">
          <Plus size={14} /> Nova Meta
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
          <button onClick={() => setPeriod("MONTHLY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === "MONTHLY" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-600"}`}>
            Mensal
          </button>
          <button onClick={() => setPeriod("QUARTERLY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === "QUARTERLY" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-600"}`}>
            Trimestral
          </button>
        </div>

        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
          className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 outline-none">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2000, i).toLocaleString("pt-BR", { month: "long" })}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
          className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 outline-none">
          {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {goals.length > 0 && (
          <div className="flex items-center gap-3 ml-auto text-xs">
            <span className="text-emerald-600 font-medium">{achieved} atingidas</span>
            <span className="text-blue-600 font-medium">{onTrack} no caminho</span>
            <span className="text-red-600 font-medium">{behind} atrasadas</span>
          </div>
        )}
      </div>

      {/* Goals grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-accent-dark" />
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <Target size={40} className="text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhuma meta definida para este período.</p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 text-xs bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors">
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const gt = getGoalType(goal.type);
            const progressColor = goal.status === "ACHIEVED" ? "bg-emerald-500" : goal.status === "BEHIND" ? "bg-red-500" : "bg-accent-dark";

            return (
              <div key={goal.id} className="bg-white border border-gray-200 rounded-xl p-5 relative group">
                {/* Delete button */}
                <button onClick={() => handleDelete(goal.id)}
                  className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={14} />
                </button>

                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={gt.color}>{gt.icon}</span>
                  <h3 className="text-sm font-medium text-gray-700 flex-1 truncate">{goal.title}</h3>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 mb-4">
                  {statusIcon(goal.status)}
                  {statusBadge(goal.status)}
                  <span className="text-[10px] text-gray-400 ml-auto uppercase">
                    {goal.period === "MONTHLY" ? "Mensal" : "Trimestral"}
                  </span>
                </div>

                {/* Values */}
                <div className="flex items-end gap-2 mb-3">
                  <span className={`text-2xl font-bold ${gt.color}`}>
                    {formatValue(goal.currentValue, goal.type)}
                  </span>
                  <span className="text-sm text-gray-400 mb-0.5">
                    / {formatValue(goal.targetValue, goal.type)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full ${progressColor} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(goal.progress, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400">{goal.progress.toFixed(1)}% concluído</p>

                {/* Custom value input */}
                {goal.type === "CUSTOM" && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Valor atual"
                        defaultValue={goal.customValue || ""}
                        onBlur={(e) => updateCustomValue(goal.id, e.target.value)}
                        className="flex-1 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 outline-none focus:border-accent-dark/50"
                      />
                      <span className="text-[10px] text-gray-400">manual</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Meta">
        <div className="space-y-4">
          <SelectField label="Tipo de Meta" value={form.type}
            onChange={(v) => {
              const gt = GOAL_TYPES.find((t) => t.value === v);
              setForm({ ...form, type: v, title: gt?.label || "" });
            }}
            options={GOAL_TYPES.map((t) => ({ value: t.value, label: t.label }))} />

          <Input label="Título" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={getGoalType(form.type).label} />

          <Input label={`Alvo${getGoalType(form.type).unit ? ` (${getGoalType(form.type).unit})` : ""}`}
            type="number" step="0.01" value={form.targetValue}
            onChange={(e) => setForm({ ...form, targetValue: e.target.value })} />

          <SelectField label="Período" value={form.period}
            onChange={(v) => setForm({ ...form, period: v })}
            options={[{ value: "MONTHLY", label: "Mensal" }, { value: "QUARTERLY", label: "Trimestral" }]} />

          {form.type === "CUSTOM" && (
            <Input label="Valor Atual (manual)" type="number" step="0.01" value={form.customValue}
              onChange={(e) => setForm({ ...form, customValue: e.target.value })} />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !form.targetValue}
              className="px-5 py-2 text-sm bg-accent hover:bg-accent-dark disabled:opacity-40 text-white rounded-lg">
              {saving ? "Criando..." : "Criar Meta"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
