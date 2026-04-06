"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterDialog } from "@/components/ui/filter-dialog";
import {
  BarChart3, Receipt, CreditCard, ShoppingBag, PiggyBank, Users2,
  Wallet, Plus, Loader2, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  TrendingDown, DollarSign, Settings,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── helpers ──────────────────────────────────────────────────────
function R$(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();

type Tab = "dashboard" | "receivables" | "fixed" | "variable" | "investments" | "prolabore" | "cash";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "receivables", label: "A Receber", icon: <Receipt size={16} /> },
  { key: "fixed", label: "Fixas", icon: <CreditCard size={16} /> },
  { key: "variable", label: "Avulsas", icon: <ShoppingBag size={16} /> },
  { key: "investments", label: "Investimentos", icon: <PiggyBank size={16} /> },
  { key: "prolabore", label: "Pró-labore", icon: <Users2 size={16} /> },
  { key: "cash", label: "Caixa", icon: <Wallet size={16} /> },
];

const FIXED_CATEGORIES = [
  { value: "IMPOSTOS", label: "Impostos" },
  { value: "MARKETING", label: "Marketing" },
  { value: "SOFTWARES", label: "Softwares" },
  { value: "EQUIPE", label: "Equipe" },
  { value: "LOCACAO", label: "Locação" },
  { value: "OUTROS", label: "Outros" },
];

const VARIABLE_CATEGORIES = [
  { value: "ALIMENTACAO", label: "Alimentação" },
  { value: "LOCOMOCAO", label: "Locomoção" },
  { value: "MATERIAL", label: "Material" },
  { value: "OUTROS", label: "Outros" },
];

const CATEGORY_LABELS: Record<string, string> = {
  IMPOSTOS: "Impostos", MARKETING: "Marketing", SOFTWARES: "Softwares",
  EQUIPE: "Equipe", LOCACAO: "Locação", OUTROS: "Outros",
  ALIMENTACAO: "Alimentação", LOCOMOCAO: "Locomoção", MATERIAL: "Material",
  INVESTIMENTOS: "Investimentos",
};

const PERIOD_PRESETS = [
  { label: "Mês", months: 1 },
  { label: "Trimestre", months: 3 },
  { label: "Semestre", months: 6 },
  { label: "Ano", months: 12 },
];

// ── main component ──────────────────────────────────────────────
export default function FinanceiroPage() {
  useSession();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            Gestão Financeira 🍌
          </h1>
          <p className="text-zinc-500 mt-1">Controle de receitas, despesas, caixa e pró-labore.</p>
        </div>

        {/* TABS (Estilo Hadar) */}
        <div className="flex bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-800 p-1 overflow-x-auto custom-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "receivables" && <ReceivablesTab month={month} year={year} setMonth={setMonth} setYear={setYear} />}
      {activeTab === "fixed" && <FixedExpensesTab month={month} year={year} setMonth={setMonth} setYear={setYear} />}
      {activeTab === "variable" && <VariableExpensesTab month={month} year={year} setMonth={setMonth} setYear={setYear} />}
      {activeTab === "investments" && <InvestmentsTab />}
      {activeTab === "prolabore" && <ProLaboreTab year={year} setYear={setYear} />}
      {activeTab === "cash" && <CashTab />}
    </div>
  );
}

// MonthYearSelector removido — substituído por FilterDialog

// ══════════════════════════════════════════════════════════════════
// 1. DASHBOARD TAB
// ══════════════════════════════════════════════════════════════════
function DashboardTab() {
  const [period, setPeriod] = useState(1);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<{
    activeClients: number; expectedRevenue: number; receivedRevenue: number;
    totalExpenses: number; grossProfit: number;
    chartData: { name: string; faturamento: number; despesas: number }[];
    clientRevenue: { clientId: string; name: string; expected: number; received: number }[];
    expenseByCategory: { category: string; amount: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    let startMonth = CURRENT_MONTH;
    let startYear = CURRENT_YEAR;
    let endMonth = CURRENT_MONTH;
    let endYear = CURRENT_YEAR;

    if (period === -1 && customStart && customEnd) {
      const [sy, sm] = customStart.split("-").map(Number);
      const [ey, em] = customEnd.split("-").map(Number);
      startMonth = sm; startYear = sy;
      endMonth = em; endYear = ey;
    } else if (period > 1) {
      let m = CURRENT_MONTH - (period - 1);
      let y = CURRENT_YEAR;
      while (m < 1) { m += 12; y--; }
      startMonth = m; startYear = y;
    }

    try {
      const res = await fetch(
        `/api/financeiro/summary?startMonth=${startMonth}&startYear=${startYear}&endMonth=${endMonth}&endYear=${endYear}`
      );
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Period filter */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.months}
            onClick={() => setPeriod(p.months)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
              period === p.months 
                ? "bg-[#FF5A00]/10 text-[#FF5A00] border-[#FF5A00]/30" 
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setPeriod(-1)}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
            period === -1 
              ? "bg-[#FF5A00]/10 text-[#FF5A00] border-[#FF5A00]/30" 
              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Personalizado
        </button>
        
        {period === -1 && (
          <div className="flex items-center gap-2 ml-2">
            <input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#FF5A00]" />
            <span className="text-zinc-600">—</span>
            <input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#FF5A00]" />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard icon={<Users2 size={18} />} label="Clientes Ativos" value={String(data?.activeClients || 0)} color="text-blue-400" />
        <KpiCard icon={<TrendingUp size={18} />} label="Fat. Previsto" value={R$(data?.expectedRevenue || 0)} color="text-amber-400" />
        <KpiCard icon={<DollarSign size={18} />} label="Fat. Recebido" value={R$(data?.receivedRevenue || 0)} color="text-emerald-400" />
        <KpiCard icon={<TrendingDown size={18} />} label="Despesas Totais" value={R$(data?.totalExpenses || 0)} color="text-red-400" />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Lucro Bruto"
          value={R$(data?.grossProfit || 0)}
          color={(data?.grossProfit || 0) >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      {/* Chart */}
      {(data?.chartData?.length ?? 0) > 0 && (
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
            <BarChart3 size={16} className="text-[#FF5A00]" /> Faturamento vs Despesas
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data?.chartData ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
              <Tooltip
                contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "12px", fontSize: 12, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)" }}
                itemStyle={{ fontWeight: "bold" }}
                labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [R$(Number(value ?? 0)), ""]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: "20px" }} iconType="circle" />
              <Bar dataKey="faturamento" fill="#10b981" name="Faturamento" radius={[6, 6, 0, 0]} />
              <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client revenue table */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/50">
            <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Clientes x Valor Rendido</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
                <Th>Cliente</Th><Th align="right">Previsto</Th><Th align="right">Recebido</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.clientRevenue || []).map((c: { clientId: string; name: string; expected: number; received: number }) => (
                <tr key={c.clientId} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-medium text-zinc-200">{c.name}</td>
                  <td className="px-6 py-3.5 text-sm font-bold text-amber-400 text-right">{R$(c.expected)}</td>
                  <td className="px-6 py-3.5 text-sm font-bold text-emerald-400 text-right">{R$(c.received)}</td>
                </tr>
              ))}
              {(!data?.clientRevenue || data.clientRevenue.length === 0) && (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-sm text-zinc-500">Sem dados para este período</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Expense by category table */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/50">
            <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Despesas por Categoria</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
                <Th>Categoria</Th><Th align="right">Valor</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.expenseByCategory || []).map((e: { category: string; amount: number }) => (
                <tr key={e.category} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-medium text-zinc-200">
                    <span className="bg-zinc-800 px-2 py-1 rounded text-xs">{CATEGORY_LABELS[e.category] || e.category}</span>
                  </td>
                  <td className="px-6 py-3.5 text-sm font-bold text-red-400 text-right">{R$(e.amount)}</td>
                </tr>
              ))}
              {(!data?.expenseByCategory || data.expenseByCategory.length === 0) && (
                <tr><td colSpan={2} className="px-6 py-10 text-center text-sm text-zinc-500">Sem despesas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 group hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 2. CONTAS A RECEBER
// ══════════════════════════════════════════════════════════════════
interface Receivable {
  id: string; amount: number; dueDate: string; paidDate: string | null;
  status: string; month: number; year: number;
  client: { id: string; name: string };
}

function ReceivablesTab({ month, year, setMonth, setYear }: {
  month: number; year: number; setMonth: (m: number) => void; setYear: (y: number) => void;
}) {
  const [items, setItems] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ clientId: "", amount: "", dueDate: "" });
  const [saving, setSaving] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financeiro/receivables?month=${month}&year=${year}`);
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  }, [month, year]);

  const fetchClients = useCallback(async () => {
    const res = await fetch("/api/clients");
    if (res.ok) {
      const data = await res.json();
      setClients(data.filter((c: { status: string }) => c.status === "ACTIVE").map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    }
  }, []);

  useEffect(() => { fetch_(); fetchClients(); }, [fetch_, fetchClients]);

  async function handleCreate() {
    setSaving(true);
    try {
      await fetch("/api/financeiro/receivables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, month, year }),
      });
      setShowModal(false);
      setForm({ clientId: "", amount: "", dueDate: "" });
      fetch_();
    } finally { setSaving(false); }
  }

  async function markPaid(id: string) {
    await fetch("/api/financeiro/receivables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "PAID", paidDate: new Date().toISOString() }),
    });
    fetch_();
  }

  async function markPending(id: string) {
    await fetch("/api/financeiro/receivables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "PENDING" }),
    });
    fetch_();
  }

  const statusBadge = (s: string) => {
    if (s === "PAID") return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">Pago</span>;
    if (s === "OVERDUE") return <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">Atrasado</span>;
    return <span className="bg-[#FF5A00]/10 text-[#FF5A00] border border-[#FF5A00]/20 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">Pendente</span>;
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <FilterDialog month={month} year={year} onApply={(m, y) => { setMonth(m); setYear(y); }} />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20">
          <Plus size={16} /> Nova Conta
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
                <Th>Cliente</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Recebimento</Th><Th>Status</Th><Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhuma conta a receber neste mês.</td></tr>
              ) : items.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-zinc-200">{r.client.name}</td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-400">{R$(r.amount)}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{new Date(r.dueDate).toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{r.paidDate ? new Date(r.paidDate).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-6 py-4">{statusBadge(r.status)}</td>
                  <td className="px-6 py-4">
                    {r.status !== "PAID" ? (
                      <button onClick={() => markPaid(r.id)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors">
                        <CheckCircle2 size={14} /> Marcar Pago
                      </button>
                    ) : (
                      <button onClick={() => markPending(r.id)} className="text-xs font-bold text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors">
                        <Clock size={14} /> Desfazer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova Conta */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Conta a Receber">
        <div className="space-y-4">
          <SelectField label="Cliente" value={form.clientId} onChange={(v) => setForm({ ...form, clientId: v })}
            options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Selecione um cliente" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor (R$)" type="number" step="0.01" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input label="Data de Vencimento" type="date" value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-medium transition-colors">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !form.clientId || !form.amount}
              className="px-6 py-2 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all">
              {saving ? "Salvando..." : "Criar Lançamento"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 3. DESPESAS FIXAS
// ══════════════════════════════════════════════════════════════════
interface FixedExpense {
  id: string; name: string; category: string; amount: number; paidWithCash: boolean; month: number; year: number;
}

function FixedExpensesTab({ month, year, setMonth, setYear }: {
  month: number; year: number; setMonth: (m: number) => void; setYear: (y: number) => void;
}) {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "OUTROS", amount: "", paidWithCash: false });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financeiro/fixed-expenses?month=${month}&year=${year}`);
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function handleCreate() {
    setSaving(true);
    try {
      await fetch("/api/financeiro/fixed-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, month, year }),
      });
      setShowModal(false);
      setForm({ name: "", category: "OUTROS", amount: "", paidWithCash: false });
      fetch_();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/financeiro/fixed-expenses?id=${id}`, { method: "DELETE" });
    fetch_();
  }

  const total = items.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="animate-in fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <FilterDialog month={month} year={year} onApply={(m, y) => { setMonth(m); setYear(y); }} />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20">
          <Plus size={16} /> Nova Despesa Fixa
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
                <Th>Nome / Título</Th><Th>Categoria</Th><Th>Valor</Th><Th>Origem</Th><Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhuma despesa fixa neste mês.</td></tr>
              ) : items.map((e) => (
                <tr key={e.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-zinc-200">{e.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs">{CATEGORY_LABELS[e.category] || e.category}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-red-400">{R$(e.amount)}</td>
                  <td className="px-6 py-4">
                    {e.paidWithCash 
                      ? <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">Caixa</span> 
                      : <span className="text-xs text-zinc-500">Operacional</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setDeleteId(e.id)} className="text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors">Excluir</button>
                  </td>
                </tr>
              ))}
              {items.length > 0 && (
                <tr className="bg-zinc-950/50">
                  <td colSpan={2} className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Total de Despesas Fixas</td>
                  <td className="px-6 py-4 text-base font-bold text-red-400">{R$(total)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Despesa Fixa */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Despesa Fixa">
        <div className="space-y-4">
          <Input label="Título da Despesa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Aluguel, Contador..." />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Categoria" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={FIXED_CATEGORIES} />
            <Input label="Valor (R$)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="pt-2">
            <label className="flex items-center gap-3 text-sm text-zinc-300 font-medium cursor-pointer bg-zinc-950 p-4 rounded-xl border border-zinc-800 hover:border-[#FF5A00]/50 transition-colors">
              <input type="checkbox" checked={form.paidWithCash}
                onChange={(e) => setForm({ ...form, paidWithCash: e.target.checked })}
                className="w-5 h-5 rounded border-zinc-700 text-[#FF5A00] focus:ring-[#FF5A00] focus:ring-offset-zinc-950 bg-zinc-900" />
              Descontar do Saldo do Caixa (Reserva)
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-medium transition-colors">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !form.name || !form.amount}
              className="px-6 py-2 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all">
              {saving ? "Salvando..." : "Adicionar Despesa"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir Despesa Fixa"
        message="Tem certeza que deseja excluir esta despesa fixa?"
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { const id = deleteId!; setDeleteId(null); handleDelete(id); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 4. DESPESAS AVULSAS
// ══════════════════════════════════════════════════════════════════
interface VariableExpense {
  id: string; name: string; category: string; amount: number; date: string; paidWithCash: boolean;
}

function VariableExpensesTab({ month, year, setMonth, setYear }: {
  month: number; year: number; setMonth: (m: number) => void; setYear: (y: number) => void;
}) {
  const [items, setItems] = useState<VariableExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "OUTROS", amount: "", date: "", paidWithCash: false });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financeiro/variable-expenses?month=${month}&year=${year}`);
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function handleCreate() {
    setSaving(true);
    try {
      await fetch("/api/financeiro/variable-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowModal(false);
      setForm({ name: "", category: "OUTROS", amount: "", date: "", paidWithCash: false });
      fetch_();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/financeiro/variable-expenses?id=${id}`, { method: "DELETE" });
    fetch_();
  }

  const total = items.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="animate-in fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <FilterDialog month={month} year={year} onApply={(m, y) => { setMonth(m); setYear(y); }} />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20">
          <Plus size={16} /> Nova Despesa Avulsa
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
                <Th>Nome / Título</Th><Th>Categoria</Th><Th>Valor</Th><Th>Data</Th><Th>Origem</Th><Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhuma despesa avulsa neste mês.</td></tr>
              ) : items.map((e) => (
                <tr key={e.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-zinc-200">{e.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs">{CATEGORY_LABELS[e.category] || e.category}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-red-400">{R$(e.amount)}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{new Date(e.date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4">
                    {e.paidWithCash 
                      ? <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">Caixa</span> 
                      : <span className="text-xs text-zinc-500">Operacional</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setDeleteId(e.id)} className="text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors">Excluir</button>
                  </td>
                </tr>
              ))}
              {items.length > 0 && (
                <tr className="bg-zinc-950/50">
                  <td colSpan={2} className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Total de Despesas Avulsas</td>
                  <td className="px-6 py-4 text-base font-bold text-red-400">{R$(total)}</td>
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Despesa Avulsa */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Despesa Avulsa">
        <div className="space-y-4">
          <Input label="Título da Despesa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Almoço Reunião, Material..." />
          <SelectField label="Categoria" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={VARIABLE_CATEGORIES} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor (R$)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input label="Data" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          
          <div className="pt-2">
            <label className="flex items-center gap-3 text-sm text-zinc-300 font-medium cursor-pointer bg-zinc-950 p-4 rounded-xl border border-zinc-800 hover:border-[#FF5A00]/50 transition-colors">
              <input type="checkbox" checked={form.paidWithCash}
                onChange={(e) => setForm({ ...form, paidWithCash: e.target.checked })}
                className="w-5 h-5 rounded border-zinc-700 text-[#FF5A00] focus:ring-[#FF5A00] focus:ring-offset-zinc-950 bg-zinc-900" />
              Descontar do Saldo do Caixa (Reserva)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-medium transition-colors">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !form.name || !form.amount || !form.date}
              className="px-6 py-2 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all">
              {saving ? "Salvando..." : "Adicionar Despesa"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir Despesa Avulsa"
        message="Tem certeza que deseja excluir esta despesa avulsa?"
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { const id = deleteId!; setDeleteId(null); handleDelete(id); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 5. INVESTIMENTOS
// ══════════════════════════════════════════════════════════════════
interface Investment {
  id: string; description: string; amount: number; paymentMethod: string; installments: number | null;
  date: string; paidWithCash: boolean;
}

function InvestmentsTab() {
  const [items, setItems] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ description: "", amount: "", paymentMethod: "A_VISTA", installments: "", firstPaymentDate: "", paidWithCash: false });
  const [saving, setSaving] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      // Busca todos os investimentos (sem filtro de mês)
      const res = await fetch("/api/financeiro/investments");
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function handleCreate() {
    setSaving(true);
    try {
      await fetch("/api/financeiro/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          amount: form.amount,
          paymentMethod: form.paymentMethod,
          installments: form.paymentMethod === "PARCELADO" ? form.installments : undefined,
          date: form.firstPaymentDate,
          paidWithCash: form.paidWithCash,
          autoCreateExpenses: true,
        }),
      });
      setShowModal(false);
      setForm({ description: "", amount: "", paymentMethod: "A_VISTA", installments: "", firstPaymentDate: "", paidWithCash: false });
      fetch_();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/financeiro/investments?id=${id}`, { method: "DELETE" });
    fetch_();
  }

  const total = items.reduce((s, e) => s + e.amount, 0);

  // Preview de parcelas
  const installmentCount = parseInt(form.installments) || 0;
  const installmentValue = form.amount && installmentCount > 0
    ? parseFloat(form.amount) / installmentCount
    : 0;

  return (
    <div className="animate-in fade-in">
      {/* Header - sem filtro de mês */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl px-6 py-4">
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Total Investido (Geral)</p>
          <p className="text-2xl font-bold text-red-400">{R$(total)}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20">
          <Plus size={16} /> Novo Investimento
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
                <Th>Descrição</Th><Th>Valor Total</Th><Th>Forma Pgto</Th><Th>Data Início</Th><Th>Origem</Th><Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhum investimento registrado.</td></tr>
              ) : items.map((inv) => (
                <tr key={inv.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-zinc-200">{inv.description}</td>
                  <td className="px-6 py-4 text-sm font-bold text-red-400">{R$(inv.amount)}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {inv.paymentMethod === "A_VISTA" ? "À vista" : (
                      <span>
                        Parcelado ({inv.installments}x de {R$(inv.amount / (inv.installments || 1))})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{new Date(inv.date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4">
                    {inv.paidWithCash
                      ? <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">Caixa</span>
                      : <span className="text-xs text-zinc-500">Operacional</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setDeleteId(inv.id)} className="text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Investimento */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Investimento">
        <div className="space-y-4">
          <Input label="Descrição (Equipamento, Curso, Software, etc)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor Total (R$)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <SelectField label="Forma de Pagamento" value={form.paymentMethod}
              onChange={(v) => setForm({ ...form, paymentMethod: v, installments: "" })}
              options={[{ value: "A_VISTA", label: "À vista" }, { value: "PARCELADO", label: "Parcelado" }]} />
          </div>

          {form.paymentMethod === "A_VISTA" ? (
            <Input label="Data do Pagamento" type="date" value={form.firstPaymentDate}
              onChange={(e) => setForm({ ...form, firstPaymentDate: e.target.value })} />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Data da 1ª Parcela" type="date" value={form.firstPaymentDate}
                onChange={(e) => setForm({ ...form, firstPaymentDate: e.target.value })} />
              <Input label="Número de Parcelas" type="number" min="2" value={form.installments}
                onChange={(e) => setForm({ ...form, installments: e.target.value })} />
            </div>
          )}

          {/* Preview de parcelas */}
          {form.paymentMethod === "PARCELADO" && installmentCount > 0 && form.amount && form.firstPaymentDate && (
            <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Preview das parcelas</p>
              <p className="text-sm text-zinc-300">
                {installmentCount}x de <span className="text-[#FF5A00] font-bold">{R$(installmentValue)}</span> — lançadas automaticamente no financeiro a partir de {new Date(form.firstPaymentDate + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </p>
            </div>
          )}

          <div className="pt-2">
            <label className="flex items-center gap-3 text-sm text-zinc-300 font-medium cursor-pointer bg-zinc-950 p-4 rounded-xl border border-zinc-800 hover:border-[#FF5A00]/50 transition-colors">
              <input type="checkbox" checked={form.paidWithCash}
                onChange={(e) => setForm({ ...form, paidWithCash: e.target.checked })}
                className="w-5 h-5 rounded border-zinc-700 text-[#FF5A00] focus:ring-[#FF5A00] focus:ring-offset-zinc-950 bg-zinc-900" />
              Investimento pago com Saldo do Caixa
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-medium transition-colors">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !form.description || !form.amount || !form.firstPaymentDate || (form.paymentMethod === "PARCELADO" && !form.installments)}
              className="px-6 py-2 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all">
              {saving ? "Registrando..." : "Registrar Investimento"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir Investimento"
        message="Tem certeza que deseja excluir este investimento? As despesas vinculadas no financeiro não serão removidas automaticamente."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { const id = deleteId!; setDeleteId(null); handleDelete(id); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 6. PRÓ-LABORE
// ══════════════════════════════════════════════════════════════════
interface ProLaboreData {
  current: {
    month: number; year: number; label: string;
    receivedRevenue: number; totalExpenses: number; grossProfit: number;
    cashReserve: number; distributable: number; felipe: number; alexandre: number;
  };
  history: Array<{
    month: number; year: number; label: string;
    receivedRevenue: number; totalExpenses: number; grossProfit: number;
    cashReserve: number; distributable: number; felipe: number; alexandre: number;
  }>;
}

function ProLaboreTab({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  const [data, setData] = useState<ProLaboreData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financeiro/pro-labore?year=${year}`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const c = data.current;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center gap-3 mb-4 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50 w-fit">
        <span className="text-sm font-medium text-zinc-400">Ano de Referência:</span>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-[#FF5A00]/50 transition-colors">
          {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Current month cards - Estilo Hadar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard icon={<DollarSign size={16} />} label="Fat. Recebido" value={R$(c.receivedRevenue)} color="text-emerald-400" />
        <KpiCard icon={<TrendingDown size={16} />} label="Despesas" value={R$(c.totalExpenses)} color="text-red-400" />
        <KpiCard icon={<TrendingUp size={16} />} label="Lucro Bruto" value={R$(c.grossProfit)} color={c.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"} />
        <KpiCard icon={<Wallet size={16} />} label="Caixa (10%)" value={R$(c.cashReserve)} color="text-blue-400" />
        <KpiCard icon={<PiggyBank size={16} />} label="Distribuível" value={R$(c.distributable)} color="text-[#FF5A00]" />
        
        {/* Destaque para os sócios */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 border-l-4 border-l-purple-500">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-3">Felipe (60%)</span>
          <p className="text-2xl font-bold text-purple-400">{R$(c.felipe)}</p>
        </div>
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 border-l-4 border-l-cyan-500">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-3">Alexandre (40%)</span>
          <p className="text-2xl font-bold text-cyan-400">{R$(c.alexandre)}</p>
        </div>
      </div>

      {/* History table */}
      <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/50">
          <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Histórico de Distribuição {year}</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
                <Th>Mês</Th><Th>Faturamento</Th><Th>Despesas</Th><Th>Lucro Bruto</Th><Th>Caixa (10%)</Th><Th>Felipe</Th><Th>Alexandre</Th>
              </tr>
            </thead>
            <tbody>
              {data.history.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">Sem dados processados neste ano.</td></tr>
              ) : data.history.map((h) => (
                <tr key={h.label} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-zinc-200">{h.label}</td>
                  <td className="px-6 py-4 text-sm font-medium text-emerald-400">{R$(h.receivedRevenue)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-red-400">{R$(h.totalExpenses)}</td>
                  <td className={`px-6 py-4 text-sm font-bold ${h.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{R$(h.grossProfit)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-blue-400">{R$(h.cashReserve)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-purple-400">{R$(h.felipe)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-cyan-400">{R$(h.alexandre)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 7. CAIXA
// ══════════════════════════════════════════════════════════════════
interface CashEntry {
  id: string; type: string; amount: number; description: string | null; date: string;
}

function CashTab() {
  const [balance, setBalance] = useState(0);
  const [minBalance, setMinBalance] = useState(1000);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAporte, setShowAporte] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [aporteAmount, setAporteAmount] = useState("");
  const [aporteDesc, setAporteDesc] = useState("");
  const [configMin, setConfigMin] = useState("");
  const [saving, setSaving] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/cash");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setMinBalance(data.minBalance);
        setEntries(data.entries);
        setConfigMin(String(data.minBalance));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function handleAporte() {
    setSaving(true);
    try {
      await fetch("/api/financeiro/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "APORTE", amount: aporteAmount, description: aporteDesc || "Aporte manual" }),
      });
      setShowAporte(false);
      setAporteAmount("");
      setAporteDesc("");
      fetch_();
    } finally { setSaving(false); }
  }

  async function handleConfigSave() {
    setSaving(true);
    try {
      await fetch("/api/financeiro/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateConfig", minBalance: configMin }),
      });
      setShowConfig(false);
      fetch_();
    } finally { setSaving(false); }
  }

  const entryTypeLabels: Record<string, string> = {
    APORTE: "Aporte Manual",
    RESERVA_MENSAL: "Reserva Mensal (10%)",
    RETIRADA_DESPESA: "Retirada - Despesa Fixa/Avulsa",
  };

  const isLow = balance < minBalance;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Big Balance card */}
      <div className={`bg-zinc-900/80 backdrop-blur-xl border rounded-2xl p-8 relative overflow-hidden transition-colors ${isLow ? "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.1)]" : "border-zinc-800/60"}`}>
        
        {/* Background glow sutil */}
        <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none ${isLow ? 'bg-red-500' : 'bg-[#FF5A00]'}`}></div>

        <div className="flex flex-col md:flex-row md:items-end justify-between relative z-10 gap-6">
          <div>
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Wallet size={16} /> Saldo de Reserva (Caixa)
            </p>
            <p className={`text-6xl font-bold tracking-tight ${isLow ? "text-red-400" : "text-white"}`}>{R$(balance)}</p>
            {isLow && (
              <div className="flex items-center gap-2 mt-4 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg w-fit">
                <AlertTriangle size={16} />
                Atenção: Saldo abaixo do limite de segurança configurado ({R$(minBalance)})
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button onClick={() => setShowConfig(true)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-bold bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#FF5A00]/50 rounded-xl transition-all shadow-sm">
              <Settings size={16} /> Configurar Limite
            </button>
            <button onClick={() => setShowAporte(true)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-bold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20">
              <Plus size={16} /> Novo Aporte
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/50">
          <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Histórico de Movimentações</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
              <Th>Data</Th><Th>Tipo de Operação</Th><Th>Descrição do Lançamento</Th><Th align="right">Valor</Th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhuma movimentação registrada.</td></tr>
            ) : entries.map((e) => {
              const isOut = e.type === "RETIRADA_DESPESA";
              return (
                <tr key={e.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-zinc-400 font-medium">{new Date(e.date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${isOut ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {entryTypeLabels[e.type] || e.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-300">{e.description || "—"}</td>
                  <td className={`px-6 py-4 text-base font-bold text-right ${isOut ? "text-red-400" : "text-emerald-400"}`}>
                    {isOut ? "- " : "+ "}{R$(e.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Aporte Modal */}
      <Modal open={showAporte} onClose={() => setShowAporte(false)} title="Incluir Aporte Manual">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400 mb-2">Utilize esta opção para injetar dinheiro diretamente na reserva do caixa, independente do faturamento dos serviços.</p>
          <Input label="Valor do Aporte (R$)" type="number" step="0.01" value={aporteAmount} onChange={(e) => setAporteAmount(e.target.value)} />
          <Input label="Descrição ou Origem (Opcional)" value={aporteDesc} onChange={(e) => setAporteDesc(e.target.value)} placeholder="Ex: Aporte dos sócios, Venda de equipamento..." />
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onClick={() => setShowAporte(false)} className="px-5 py-2.5 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-medium transition-colors">Cancelar</button>
            <button onClick={handleAporte} disabled={saving || !aporteAmount}
              className="px-6 py-2.5 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all">
              {saving ? "Processando..." : "Confirmar Aporte"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Config Modal */}
      <Modal open={showConfig} onClose={() => setShowConfig(false)} title="Configuração de Segurança do Caixa">
        <div className="space-y-4">
          <Input label="Saldo Mínimo Desejado (R$)" type="number" step="0.01" value={configMin} onChange={(e) => setConfigMin(e.target.value)} />
          <p className="text-sm text-zinc-500 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            O sistema exibirá um alerta vermelho na tela de Caixa sempre que o saldo disponível for inferior a este valor. Ideal para manter a reserva de emergência da agência intacta.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onClick={() => setShowConfig(false)} className="px-5 py-2.5 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-medium transition-colors">Cancelar</button>
            <button onClick={handleConfigSave} disabled={saving}
              className="px-6 py-2.5 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all">
              {saving ? "Salvando..." : "Salvar Limite"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── shared tiny components ──────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={32} className="animate-spin text-[#FF5A00]" />
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode, align?: "left" | "right" | "center" }) {
  return (
    <th className={`text-[10px] text-zinc-500 font-bold px-6 py-3 uppercase tracking-wider text-${align}`}>
      {children}
    </th>
  );
}