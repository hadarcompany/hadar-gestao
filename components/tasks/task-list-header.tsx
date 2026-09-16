"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortKey, SortState } from "@/lib/task-sort";
import { cn } from "@/lib/utils";

/** Cabeçalho da lista de tarefas: clicar na coluna ordena, clicar de novo inverte. */
export function TaskListHeader({
  sort, onSort, showClient = true, showLabels = true,
}: {
  sort: SortState;
  onSort: (key: SortKey) => void;
  showClient?: boolean;
  showLabels?: boolean;
}) {
  function Col({ k, label, className }: { k: SortKey; label: string; className?: string }) {
    const active = sort.key === k;
    return (
      <button
        type="button"
        onClick={() => onSort(k)}
        aria-label={`Ordenar por ${label}`}
        className={cn(
          "flex items-center gap-1 hover:text-gray-700 transition-colors",
          active && "text-accent-dark",
          className
        )}
      >
        {label}
        {active
          ? (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <ChevronsUpDown size={11} className="opacity-25" />}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-gray-400 select-none">
      <span className="w-[17px] shrink-0" />
      <Col k="status" label="Status" className="w-[84px] shrink-0" />
      <Col k="priority" label="Prioridade" className="w-[78px] shrink-0" />
      <Col k="title" label="Tarefa" className="flex-1 min-w-0" />
      {showLabels && <span className="hidden lg:block w-[240px] shrink-0">Etiquetas</span>}
      {showClient && <Col k="client" label="Cliente" className="hidden sm:flex w-28 shrink-0" />}
      <Col k="assignee" label="Responsável" className="w-[104px] shrink-0" />
      <Col k="dueDate" label="Prazo" className="w-24 shrink-0 justify-end" />
      <span className="w-[118px] shrink-0" />
    </div>
  );
}
