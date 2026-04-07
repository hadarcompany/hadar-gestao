"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus, Edit3, Trash2, CheckCircle2, Link2, Unlink,
  ChevronDown, ChevronUp, Search, X, CalendarDays, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────

interface CalTask {
  id: string;
  title: string;
  status: string;
}

interface CalItem {
  id: string;
  type: string;
  index: number;
  published: boolean;
  taskId: string | null;
  task: CalTask | null;
}

interface ContentCalendar {
  id: string;
  clientId: string;
  client: { id: string; name: string };
  weekStart: string;
  reels: number;
  carroseis: number;
  criativosTrafico: number;
  items: CalItem[];
}

interface CalendarForm {
  clientId: string;
  weekStart: string;
  reels: string;
  carroseis: string;
  criativosTrafico: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function getWeekBorderClass(weekStart: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  if (end < today) return "border-l-4 border-red-500/70";
  if (start <= today && today <= end) return "border-l-4 border-amber-500/70";

  const nextWeekEnd = new Date(today);
  nextWeekEnd.setDate(today.getDate() + 7);
  if (start <= nextWeekEnd) return "border-l-4 border-blue-500/70";

  const monthEnd = new Date(today);
  monthEnd.setMonth(today.getMonth() + 1);
  if (start <= monthEnd) return "border-l-4 border-green-500/70";

  return "border-l-4 border-zinc-700/60";
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

const TYPE_LABELS: Record<string, string> = {
  REEL: "Reels",
  CARROSSEL: "Carrosséis",
  CRIATIVO: "Criativos de Tráfego",
};

const TYPE_SINGULAR: Record<string, string> = {
  REEL: "Reel",
  CARROSSEL: "Carrossel",
  CRIATIVO: "Criativo",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "A Fazer",              color: "bg-zinc-500/20 text-zinc-400" },
  IN_PROGRESS: { label: "Em Progresso",         color: "bg-blue-500/20 text-blue-400" },
  IN_REVIEW:   { label: "Aguardando Aprovação", color: "bg-purple-500/20 text-purple-400" },
  COMPLETED:   { label: "Concluída",            color: "bg-emerald-500/20 text-emerald-400" },
  CANCELLED:   { label: "Cancelada",            color: "bg-red-500/20 text-red-400" },
};

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-zinc-600" />
    </div>
  );
}

// ── LinkTaskModal ──────────────────────────────────────────────────

function LinkTaskModal({
  open,
  onClose,
  onSelect,
  currentTaskId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (task: CalTask | null) => void;
  currentTaskId: string | null;
}) {
  const [allTasks, setAllTasks] = useState<(CalTask & { clientName?: string })[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    setLoading(true);
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: { id: string; title: string; status: string; client?: { name: string } }[]) => {
        setAllTasks(
          data
            .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
            .map((t) => ({ id: t.id, title: t.title, status: t.status, clientName: t.client?.name }))
        );
      })
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTasks;
    const q = search.toLowerCase();
    return allTasks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.clientName?.toLowerCase().includes(q)
    );
  }, [allTasks, search]);

  return (
    <Modal open={open} onClose={onClose} title="Vincular Tarefa">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou cliente..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5A00]/50 transition-colors"
          />
        </div>

        {currentTaskId && (
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2"
          >
            <Unlink size={13} /> Desvincular tarefa atual
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-zinc-600" />
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-zinc-600 py-6">Nenhuma tarefa encontrada</p>
            ) : (
              filtered.map((t) => {
                const s = STATUS_LABELS[t.status];
                const isActive = t.id === currentTaskId;
                return (
                  <button
                    key={t.id}
                    onClick={() => { onSelect(t); onClose(); }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between gap-3",
                      isActive
                        ? "bg-[#FF5A00]/10 border border-[#FF5A00]/30"
                        : "hover:bg-zinc-800/60"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 font-medium truncate">{t.title}</p>
                      {t.clientName && (
                        <p className="text-xs text-zinc-600 truncate">{t.clientName}</p>
                      )}
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded shrink-0", s?.color)}>
                      {s?.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── ItemRow ────────────────────────────────────────────────────────

function ItemRow({
  item,
  calendarId,
  onUpdate,
}: {
  item: CalItem;
  calendarId: string;
  onUpdate: (updated: CalItem) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function togglePublished() {
    setToggling(true);
    try {
      const res = await fetch(
        `/api/content-calendar/${calendarId}/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: !item.published }),
        }
      );
      if (res.ok) onUpdate(await res.json());
    } finally {
      setToggling(false);
    }
  }

  async function handleTaskLink(task: CalTask | null) {
    const res = await fetch(
      `/api/content-calendar/${calendarId}/items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task?.id ?? null }),
      }
    );
    if (res.ok) onUpdate(await res.json());
  }

  const taskStatus = item.task ? STATUS_LABELS[item.task.status] : null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors group",
        item.published ? "bg-emerald-500/5" : "hover:bg-zinc-800/30"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={togglePublished}
        disabled={toggling}
        title={item.published ? "Desfazer publicação" : "Marcar como publicado"}
        className={cn(
          "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
          item.published
            ? "bg-emerald-500 border-emerald-500"
            : "border-zinc-600 hover:border-emerald-500/70"
        )}
      >
        {item.published && <CheckCircle2 size={11} className="text-white" />}
      </button>

      {/* Label */}
      <span
        className={cn(
          "text-sm font-medium flex-1 min-w-0",
          item.published ? "text-zinc-600 line-through" : "text-zinc-200"
        )}
      >
        {TYPE_SINGULAR[item.type] ?? item.type} {item.index}
      </span>

      {/* Task Link */}
      {item.task ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded hidden sm:block",
              taskStatus?.color
            )}
          >
            {taskStatus?.label}
          </span>
          <button
            onClick={() => setLinkOpen(true)}
            title="Alterar tarefa vinculada"
            className="p-1 text-[#FF5A00]/60 hover:text-[#FF5A00] transition-colors"
          >
            <Link2 size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setLinkOpen(true)}
          title="Vincular tarefa"
          className="p-1 text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Link2 size={12} />
        </button>
      )}

      <LinkTaskModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onSelect={handleTaskLink}
        currentTaskId={item.taskId}
      />
    </div>
  );
}

// ── CalendarCard ───────────────────────────────────────────────────

function CalendarCard({
  calendar,
  onEdit,
  onDelete,
  onItemUpdate,
}: {
  calendar: ContentCalendar;
  onEdit: () => void;
  onDelete: () => void;
  onItemUpdate: (itemId: string, updated: CalItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const borderClass = getWeekBorderClass(calendar.weekStart);
  const totalItems = calendar.items.length;
  const publishedCount = calendar.items.filter((i) => i.published).length;
  const progressPct = totalItems > 0 ? Math.round((publishedCount / totalItems) * 100) : 0;

  const groups = useMemo(() => {
    const g: Record<string, CalItem[]> = {};
    for (const item of calendar.items) {
      if (!g[item.type]) g[item.type] = [];
      g[item.type].push(item);
    }
    const order = ["REEL", "CARROSSEL", "CRIATIVO"];
    return Object.entries(g).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  }, [calendar.items]);

  return (
    <div
      className={cn(
        "bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden flex flex-col",
        borderClass
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white truncate">
              {calendar.client.name}
            </h3>
            {totalItems > 0 && (
              <span
                className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
                  progressPct === 100
                    ? "bg-emerald-500/15 text-emerald-400"
                    : publishedCount > 0
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-zinc-800 text-zinc-500"
                )}
              >
                {publishedCount}/{totalItems} publicados
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <CalendarDays size={12} className="text-zinc-600 shrink-0" />
            <span className="text-xs text-zinc-500">
              {formatWeekRange(calendar.weekStart)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onEdit}
            title="Editar"
            className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={onDelete}
            title="Excluir"
            className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {totalItems > 0 && (
        <div className="px-5 pb-3">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progressPct === 100
                  ? "bg-emerald-500"
                  : progressPct >= 50
                  ? "bg-blue-500"
                  : "bg-[#FF5A00]"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      {expanded && (
        <div className="border-t border-zinc-800/40">
          {groups.length === 0 ? (
            <p className="px-5 py-4 text-xs text-zinc-600">
              Nenhum item neste calendário.
            </p>
          ) : (
            <div className="px-4 py-3 space-y-4">
              {groups.map(([type, items]) => (
                <div key={type}>
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 px-3">
                    {TYPE_LABELS[type]}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        calendarId={calendar.id}
                        onUpdate={(updated) => onItemUpdate(item.id, updated)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CalendarFormModal ──────────────────────────────────────────────

function CalendarFormModal({
  open,
  onClose,
  onSave,
  clients,
  initial,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: CalendarForm) => Promise<void>;
  clients: { id: string; name: string }[];
  initial?: Partial<CalendarForm>;
  title: string;
}) {
  const defaultForm: CalendarForm = {
    clientId: "",
    weekStart: "",
    reels: "0",
    carroseis: "0",
    criativosTrafico: "0",
  };

  const [form, setForm] = useState<CalendarForm>({ ...defaultForm, ...initial });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...defaultForm, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isValid = !!form.clientId && !!form.weekStart;

  async function handleSubmit() {
    if (!isValid) return;
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <SelectField
          label="Cliente"
          value={form.clientId}
          onChange={(v) => setForm({ ...form, clientId: v })}
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Selecione um cliente"
        />
        <Input
          label="Início da semana de publicação"
          type="date"
          value={form.weekStart}
          onChange={(e) => setForm({ ...form, weekStart: e.target.value })}
        />
        <div>
          <p className="text-xs font-medium text-zinc-400 mb-2">Quantidade de conteúdos</p>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Reels"
              type="number"
              min="0"
              value={form.reels}
              onChange={(e) => setForm({ ...form, reels: e.target.value })}
            />
            <Input
              label="Carrosséis"
              type="number"
              min="0"
              value={form.carroseis}
              onChange={(e) => setForm({ ...form, carroseis: e.target.value })}
            />
            <Input
              label="Criativos"
              type="number"
              min="0"
              value={form.criativosTrafico}
              onChange={(e) => setForm({ ...form, criativosTrafico: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !isValid}
            className="px-6 py-2 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-40 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function CalendarioClientesPage() {
  const [calendars, setCalendars] = useState<ContentCalendar[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ContentCalendar | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState("");

  const fetchCalendars = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterClient ? `?clientId=${filterClient}` : "";
      const res = await fetch(`/api/content-calendar${params}`);
      if (res.ok) setCalendars(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filterClient]);

  useEffect(() => { fetchCalendars(); }, [fetchCalendars]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d: { id: string; name: string; status: string }[]) =>
        setClients(d.filter((c) => c.status === "ACTIVE").map((c) => ({ id: c.id, name: c.name })))
      );
  }, []);

  async function handleCreate(form: CalendarForm) {
    await fetch("/api/content-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.clientId,
        weekStart: form.weekStart,
        reels: Number(form.reels),
        carroseis: Number(form.carroseis),
        criativosTrafico: Number(form.criativosTrafico),
      }),
    });
    setShowCreate(false);
    fetchCalendars();
  }

  async function handleEdit(form: CalendarForm) {
    if (!editTarget) return;
    await fetch(`/api/content-calendar/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStart: form.weekStart,
        reels: Number(form.reels),
        carroseis: Number(form.carroseis),
        criativosTrafico: Number(form.criativosTrafico),
      }),
    });
    setEditTarget(null);
    fetchCalendars();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/content-calendar/${id}`, { method: "DELETE" });
    fetchCalendars();
  }

  function updateItem(calendarId: string, itemId: string, updated: CalItem) {
    setCalendars((prev) =>
      prev.map((cal) =>
        cal.id === calendarId
          ? { ...cal, items: cal.items.map((it) => (it.id === itemId ? updated : it)) }
          : cal
      )
    );
  }

  const editInitial: Partial<CalendarForm> | undefined = editTarget
    ? {
        clientId: editTarget.clientId,
        weekStart: editTarget.weekStart.split("T")[0],
        reels: String(editTarget.reels),
        carroseis: String(editTarget.carroseis),
        criativosTrafico: String(editTarget.criativosTrafico),
      }
    : undefined;

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Calendário dos Clientes
          </h1>
          <p className="text-zinc-400 mt-2 text-sm font-medium">
            Planejamento e monitoramento de publicações semanais
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 self-start sm:self-auto shrink-0"
        >
          <Plus size={16} /> Criar Calendário
        </button>
      </div>

      {/* Filter + Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-56">
          <SelectField
            label=""
            value={filterClient}
            onChange={setFilterClient}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Filtrar por cliente"
          />
        </div>
        {filterClient && (
          <button
            onClick={() => setFilterClient("")}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={12} /> Limpar
          </button>
        )}

        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {[
            { color: "bg-red-500",   label: "Atrasado" },
            { color: "bg-amber-500", label: "Esta semana" },
            { color: "bg-blue-500",  label: "Próx. semana" },
            { color: "bg-green-500", label: "Este mês" },
          ].map(({ color, label }) => (
            <div key={label} className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={cn("w-2.5 h-2.5 rounded-sm", color)} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Spinner />
      ) : calendars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CalendarDays size={44} className="text-zinc-700 mb-4" />
          <p className="text-zinc-400 font-semibold text-lg">Nenhum calendário encontrado</p>
          <p className="text-zinc-600 text-sm mt-1">
            Crie o primeiro calendário para começar a planejar
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {calendars.map((cal) => (
            <CalendarCard
              key={cal.id}
              calendar={cal}
              onEdit={() => setEditTarget(cal)}
              onDelete={() => setDeleteId(cal.id)}
              onItemUpdate={(itemId, updated) => updateItem(cal.id, itemId, updated)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CalendarFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        clients={clients}
        title="Criar Calendário"
      />
      <CalendarFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEdit}
        clients={clients}
        initial={editInitial}
        title="Editar Calendário"
      />
      <ConfirmDialog
        open={!!deleteId}
        title="Excluir Calendário"
        message="Tem certeza que deseja excluir este calendário? Todos os itens serão removidos."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { const id = deleteId!; setDeleteId(null); handleDelete(id); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
