"use client";

import { Avatar } from "@/components/ui/avatar";
import { ClientIdentity } from "@/components/clients/client-identity";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SelectField } from "@/components/ui/select-field";
import {
  Activity, ClipboardCheck, BarChart3, ChevronRight, Loader2, Save,
  Gauge, Star, TrendingUp, AlertTriangle
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── types ────────────────────────────────────────────────────────
interface ChurnScores {
  satisfactionDelivery: number; serviceQuality: number;
  deadlineCompliance: number; perceivedResult: number; npsScore: number;
  avg: number;
}
interface QualityScores {
  respondsTimely: number; changeVolume: number;
  complaints: number; outOfScope: number; financiallyWorth: number;
  avg: number;
}
interface ClientScore {
  clientId: string; clientName: string; logoUrl?: string | null; hasScore: boolean; scoreId: string | null;
  churn: ChurnScores; quality: QualityScores; observations: string | null;
}
interface HistoryEntry {
  clientId: string; clientName: string; month: number; year: number;
  label: string; churnAvg: number; qualityAvg: number; npsScore: number;
}

// ── helpers ──────────────────────────────────────────────────────
const NOW = new Date();
const CURRENT_MONTH = NOW.getMonth() + 1;
const CURRENT_YEAR = NOW.getFullYear();

// Atualizado para as cores Hadar
function semaphoreColor(avg: number): string {
  if (avg >= 4) return "text-emerald-600";
  if (avg >= 2.5) return "text-accent"; // Laranja Hadar
  return "text-red-600";
}
function semaphoreBg(avg: number): string {
  if (avg >= 4) return "bg-emerald-500/10 border-emerald-500/20";
  if (avg >= 2.5) return "bg-accent/10 border-accent/20";
  return "bg-red-500/10 border-red-500/20";
}
function semaphoreLabel(avg: number): string {
  if (avg >= 4) return "Saudável";
  if (avg >= 2.5) return "Atenção";
  return "Crítico";
}

type Tab = "dashboard" | "history";

const CHURN_FIELDS: { key: keyof Omit<ChurnScores, "avg">; label: string }[] = [
  { key: "satisfactionDelivery", label: "Satisfação com entregas" },
  { key: "serviceQuality", label: "Qualidade do atendimento" },
  { key: "deadlineCompliance", label: "Cumprimento de prazos" },
  { key: "perceivedResult", label: "Resultado percebido" },
  { key: "npsScore", label: "Probabilidade de indicar (NPS)" },
];

const QUALITY_FIELDS: { key: keyof Omit<QualityScores, "avg">; label: string }[] = [
  { key: "respondsTimely", label: "Responde em tempo hábil?" },
  { key: "changeVolume", label: "Volume de alterações" },
  { key: "complaints", label: "Houve reclamações?" },
  { key: "outOfScope", label: "Demandas fora do escopo?" },
  { key: "financiallyWorth", label: "Vale a pena financeiramente?" },
];

// ── main component ──────────────────────────────────────────────
export default function NpsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [scores, setScores] = useState<ClientScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Evaluation modal
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalClient, setEvalClient] = useState<ClientScore | null>(null);
  const [evalForm, setEvalForm] = useState(defaultEvalForm());
  const [saving, setSaving] = useState(false);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nps?month=${month}&year=${year}`);
      if (res.ok) setScores(await res.json());
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  function openEval(client: ClientScore) {
    setEvalClient(client);
    setEvalForm({
      satisfactionDelivery: String(client.churn.satisfactionDelivery),
      serviceQuality: String(client.churn.serviceQuality),
      deadlineCompliance: String(client.churn.deadlineCompliance),
      perceivedResult: String(client.churn.perceivedResult),
      npsScore: String(client.churn.npsScore),
      respondsTimely: String(client.quality.respondsTimely),
      changeVolume: String(client.quality.changeVolume),
      complaints: String(client.quality.complaints),
      outOfScope: String(client.quality.outOfScope),
      financiallyWorth: String(client.quality.financiallyWorth),
      observations: client.observations || "",
    });
    setEvalOpen(true);
  }

  async function handleSaveEval() {
    if (!evalClient) return;
    setSaving(true);
    try {
      await fetch("/api/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: evalClient.clientId,
          month, year,
          ...evalForm,
        }),
      });
      setEvalOpen(false);
      fetchScores();
    } finally { setSaving(false); }
  }

  // Summary stats
  const scored = scores.filter((s) => s.hasScore);
  const avgChurn = scored.length > 0 ? scored.reduce((sum, s) => sum + s.churn.avg, 0) / scored.length : 0;
  const avgQuality = scored.length > 0 ? scored.reduce((sum, s) => sum + s.quality.avg, 0) / scored.length : 0;
  const avgNps = scored.length > 0 ? scored.reduce((sum, s) => sum + s.churn.npsScore, 0) / scored.length : 0;

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Atendimento e NPS Hadar
          </h1>
          <p className="text-gray-400 mt-1">Avaliação de risco de churn e qualidade dos clientes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tabs estilo Hadar */}
          <div className="flex bg-white/80 backdrop-blur-md rounded-xl border border-gray-200 p-1">
            <button onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-accent text-white shadow-lg shadow-[#FF5A00]/20"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}>
              <Activity size={16} /> Visão Geral
            </button>
            <button onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "history"
                  ? "bg-accent text-white shadow-lg shadow-[#FF5A00]/20"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}>
              <BarChart3 size={16} /> Histórico (Gráfico)
            </button>
          </div>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <>
          {/* SELETOR DE MÊS */}
          <div className="flex items-center gap-3 mb-6 bg-white/40 p-4 rounded-2xl border border-gray-200/50 w-fit">
            <span className="text-sm font-medium text-gray-500">Período de Análise:</span>
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 outline-none focus:border-accent/50 transition-colors">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString("pt-BR", { month: "long" }).toUpperCase()}
                </option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 outline-none focus:border-accent/50 transition-colors">
              {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 size={32} className="animate-spin text-accent" />
            </div>
          ) : (
            <>
              {/* DASHBOARD - 3 CARTÕES LADO A LADO */}
              {scored.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                  {/* Card 1: NPS Geral */}
                  <div className="bg-white/80 backdrop-blur-xl border border-gray-200/60 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between group hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-500">NPS Geral Hadar</h3>
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                        <Gauge size={20} />
                      </div>
                    </div>
                    <div>
                      <p className={`text-5xl font-bold ${semaphoreColor(avgNps)}`}>{avgNps.toFixed(1)}<span className="text-2xl text-gray-400">/5</span></p>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <Star size={12} className="text-accent" /> Probabilidade média de indicação
                      </p>
                    </div>
                    {/* Linha decorativa de "gauge" embaixo */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-100">
                      <div className="h-full bg-accent" style={{ width: `${(avgNps / 5) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Card 2: Qualidade do Cliente */}
                  <div className="bg-white/80 backdrop-blur-xl border border-gray-200/60 rounded-2xl p-6 flex flex-col justify-between group hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-500">Qualidade Média</h3>
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                        <ClipboardCheck size={20} />
                      </div>
                    </div>
                    <div>
                      <p className={`text-4xl font-bold ${semaphoreColor(avgQuality)}`}>{avgQuality.toFixed(1)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant={avgQuality >= 4 ? "success" : avgQuality >= 2.5 ? "warning" : "danger"}>
                          {semaphoreLabel(avgQuality)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Risco de Churn */}
                  <div className="bg-white/80 backdrop-blur-xl border border-gray-200/60 rounded-2xl p-6 flex flex-col justify-between group hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-500">Risco de Churn (Saúde)</h3>
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
                        <AlertTriangle size={20} />
                      </div>
                    </div>
                    <div>
                      <p className={`text-4xl font-bold ${semaphoreColor(avgChurn)}`}>{avgChurn.toFixed(1)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant={avgChurn >= 4 ? "success" : avgChurn >= 2.5 ? "warning" : "danger"}>
                          {semaphoreLabel(avgChurn)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-white/40 border border-gray-200 border-dashed rounded-2xl p-10 text-center mb-8">
                  <p className="text-gray-400">Nenhum cliente foi avaliado neste período ainda.</p>
                </div>
              )}

              {/* LISTA DE CLIENTES E AVALIAÇÕES */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">Avaliações Individuais</h2>
                {scores.map((client) => (
                  <div
                    key={client.clientId}
                    onClick={() => openEval(client)}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md border border-gray-200/60 rounded-xl p-4 cursor-pointer hover:bg-gray-100/80 hover:border-gray-300 transition-all group"
                  >
                    {/* Client name */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center font-bold text-gray-500 group-hover:text-accent transition-colors shadow-inner shrink-0">
                        <Avatar name={client.clientName} image={client.logoUrl} size={36} className="object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-gray-800 group-hover:text-gray-900 transition-colors truncate">{client.clientName}</p>
                        {client.observations ? (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{client.observations}</p>
                        ) : (
                          <p className="text-xs text-gray-400 truncate mt-0.5 italic">Sem observações</p>
                        )}
                      </div>
                    </div>

                    {/* Semaphores Container */}
                    <div className="flex flex-wrap items-center gap-3 md:gap-6">

                      {/* Churn semaphore */}
                      <div className={`flex flex-col gap-1 px-4 py-2 rounded-xl border ${client.hasScore ? semaphoreBg(client.churn.avg) : "bg-gray-50/50 border-gray-200/50"} min-w-[120px]`}>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Saúde/Churn</span>
                        {client.hasScore ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${semaphoreColor(client.churn.avg)}`}>
                              {client.churn.avg.toFixed(1)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 font-medium">Pendente</span>
                        )}
                      </div>

                      {/* Quality semaphore */}
                      <div className={`flex flex-col gap-1 px-4 py-2 rounded-xl border ${client.hasScore ? semaphoreBg(client.quality.avg) : "bg-gray-50/50 border-gray-200/50"} min-w-[120px]`}>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Qualidade</span>
                        {client.hasScore ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${semaphoreColor(client.quality.avg)}`}>
                              {client.quality.avg.toFixed(1)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 font-medium">Pendente</span>
                        )}
                      </div>

                      <div className="hidden md:flex w-8 justify-end">
                        <ChevronRight size={20} className="text-gray-400 group-hover:text-accent transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}

                {scores.length === 0 && (
                  <div className="text-center text-sm text-gray-400 py-12 bg-white/40 rounded-xl border border-gray-200 border-dashed">
                    Nenhum cliente ativo para avaliar.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "history" && <HistoryTab />}

      {/* Evaluation Modal */}
      <Modal open={evalOpen} onClose={() => setEvalOpen(false)} title={`Avaliação de Performance`} size="xl">
        <div className="space-y-6">

          <div className="pb-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">{evalClient && <ClientIdentity client={{ name: evalClient.clientName, logoUrl: evalClient.logoUrl }} size={28} />}</h2>
            <p className="text-sm text-gray-400">Refere-se a: {new Date(year, month - 1).toLocaleString("pt-BR", { month: "long" }).toUpperCase()} {year}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Churn Risk */}
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
              <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-5 flex items-center gap-2">
                <Activity size={16} className="text-accent" /> Risco de Churn (Satisfação)
              </h3>
              <div className="space-y-4">
                {CHURN_FIELDS.map((field) => (
                  <ScoreSlider
                    key={field.key}
                    label={field.label}
                    value={evalForm[field.key]}
                    onChange={(v) => setEvalForm({ ...evalForm, [field.key]: v })}
                  />
                ))}
              </div>
            </div>

            {/* Client Quality */}
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
              <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-5 flex items-center gap-2">
                <ClipboardCheck size={16} className="text-blue-600" /> Qualidade do Cliente
              </h3>
              <div className="space-y-4">
                {QUALITY_FIELDS.map((field) => (
                  <ScoreSlider
                    key={field.key}
                    label={field.label}
                    value={evalForm[field.key]}
                    onChange={(v) => setEvalForm({ ...evalForm, [field.key]: v })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
            <Textarea
              label="Observações / Feedback Mensal"
              value={evalForm.observations}
              onChange={(e) => setEvalForm({ ...evalForm, observations: e.target.value })}
              placeholder="Notas adicionais sobre o comportamento do cliente este mês..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button onClick={() => setEvalOpen(false)} className="px-5 py-2.5 text-sm text-gray-500 font-medium bg-white hover:bg-gray-100 transition-colors rounded-xl">Cancelar</button>
            <button onClick={handleSaveEval} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 text-sm bg-accent hover:bg-accent-dark disabled:opacity-40 text-white font-bold rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Salvando..." : "Salvar Avaliação"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Score Slider Component (Ajustado para Hadar) ────────────────
function ScoreSlider({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const numVal = parseFloat(value) || 0;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <span className="text-sm font-medium text-gray-600 w-full sm:w-56 shrink-0">{label}</span>
      <div className="flex items-center gap-4 flex-1">
        <input
          type="range"
          min="0" max="5" step="0.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{
            // Slider com cores da identidade (Verde, Laranja, Vermelho)
            background: `linear-gradient(to right, ${numVal >= 4 ? "#10b981" : numVal >= 2.5 ? "#FF5A00" : "#ef4444"} ${(numVal / 5) * 100}%, rgba(255,255,255,0.1) ${(numVal / 5) * 100}%)`,
          }}
        />
        <div className={`text-lg font-bold w-10 text-right ${semaphoreColor(numVal)} bg-white px-2 py-0.5 rounded-md border border-gray-200`}>
          {numVal.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

// ── History Tab (Ajustado para Hadar) ───────────────────────────
function HistoryTab() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const clientParam = selectedClient ? `&clientId=${selectedClient}` : "";
      const res = await fetch(`/api/nps/history?year=${year}${clientParam}`);
      if (res.ok) setHistory(await res.json());
    } finally { setLoading(false); }
  }, [year, selectedClient]);

  const fetchClients = useCallback(async () => {
    const res = await fetch("/api/clients");
    if (res.ok) {
      const data = await res.json();
      setClients(data.filter((c: { status: string }) => c.status === "ACTIVE").map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const monthEntries = history.filter((h) => h.month === i + 1);
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    if (monthEntries.length === 0) return { name: monthNames[i], churn: null, qualidade: null, nps: null };
    return {
      name: monthNames[i],
      churn: Math.round((monthEntries.reduce((s, e) => s + e.churnAvg, 0) / monthEntries.length) * 10) / 10,
      qualidade: Math.round((monthEntries.reduce((s, e) => s + e.qualityAvg, 0) / monthEntries.length) * 10) / 10,
      nps: Math.round((monthEntries.reduce((s, e) => s + e.npsScore, 0) / monthEntries.length) * 10) / 10,
    };
  }).filter((d) => d.churn !== null);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-wrap items-center gap-4 bg-white/40 p-4 rounded-2xl border border-gray-200/50 w-fit">
        <div className="w-64">
          <SelectField label="" value={selectedClient} onChange={setSelectedClient}
            options={[{ value: "", label: "Todos os clientes" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
          className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-accent/50 transition-colors">
          {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="bg-white/40 border border-gray-200 border-dashed rounded-2xl p-10 text-center">
          <p className="text-gray-400">Sem dados históricos para exibir neste período.</p>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/60 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-accent" /> Evolução Geral de {year}
          </h3>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis domain={[0, 5]} tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e5e3", borderRadius: "12px", fontSize: 12, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                itemStyle={{ fontWeight: "bold" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: "20px" }} iconType="circle" />
              {/* Cores alinhadas à nova identidade */}
              <Line type="monotone" dataKey="churn" stroke="#10b981" name="Risco Churn (Saúde)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="qualidade" stroke="#3b82f6" name="Qualidade" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="nps" stroke="#FF5A00" name="NPS Médio" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
// ── helpers ──────────────────────────────────────────────────────
function defaultEvalForm() {
  return {
    satisfactionDelivery: "0", serviceQuality: "0", deadlineCompliance: "0",
    perceivedResult: "0", npsScore: "0",
    respondsTimely: "0", changeVolume: "0", complaints: "0",
    outOfScope: "0", financiallyWorth: "0",
    observations: "",
  };
}