"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutTemplate, Loader2, Search } from "lucide-react";
import { TaskBoard } from "@/components/tasks/task-board";
import { ClientIdentity } from "@/components/clients/client-identity";

type BoardTask = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  board: { updatedAt: string } | null;
  client: { id: string; name: string; logoUrl?: string | null } | null;
};

export default function QuadrosPage() {
  const params = useSearchParams();
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("task"));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/task-boards", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((data: BoardTask[]) => {
        setTasks(data);
        setSelectedId((current) => current && data.some((task) => task.id === current) ? current : data[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? tasks.filter((task) => `${task.title} ${task.client?.name ?? ""}`.toLowerCase().includes(query)) : tasks;
  }, [search, tasks]);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quadros</h1>
        <p className="text-sm text-gray-400">Referências visuais, imagens e textos livres vinculados às tarefas.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
        <aside className="bg-white border border-gray-200 rounded-2xl overflow-hidden xl:sticky xl:top-4">
          <div className="p-3 border-b border-gray-200">
            <div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefa ou cliente" className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-accent" /></div>
          </div>
          <div className="max-h-[680px] overflow-y-auto">
            {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-accent" /></div> : filtered.length === 0 ? <p className="p-6 text-xs text-center text-gray-400">Nenhuma tarefa encontrada.</p> : filtered.map((task) => (
              <button key={task.id} onClick={() => setSelectedId(task.id)} className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 ${selectedId === task.id ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}>
                <p className="text-sm font-semibold text-gray-800 line-clamp-2">{task.title}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-400">
                  {task.client ? <ClientIdentity client={task.client} size={18} /> : <span>Sem cliente</span>}
                  {task.board && <span className="ml-auto text-emerald-600">com quadro</span>}
                </div>
              </button>
            ))}
          </div>
        </aside>
        <main className="min-w-0">
          {selected ? <><div className="flex items-center gap-2 mb-3"><LayoutTemplate size={18} className="text-accent" /><div><h2 className="font-bold text-gray-900">{selected.title}</h2><p className="text-xs text-gray-400">{selected.client?.name ?? "Tarefa sem cliente"}</p></div></div><TaskBoard key={selected.id} taskId={selected.id} /></> : <div className="h-[420px] bg-white border border-gray-200 rounded-2xl flex items-center justify-center text-sm text-gray-400">Selecione uma tarefa.</div>}
        </main>
      </div>
    </div>
  );
}
