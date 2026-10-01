"use client";

import { useRef, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Settings2 } from "lucide-react";
import { Floating } from "@/components/ui/floating";
import type { SortKey, SortState } from "@/lib/task-sort";
import { DEFAULT_TASK_COLUMNS, TASK_COLUMN_OPTIONS, type TaskColumnKey } from "@/lib/task-columns";
import { cn } from "@/lib/utils";

/** Cabeçalho da lista de tarefas: clicar na coluna ordena, clicar de novo inverte. */
export function TaskListHeader({
  sort, onSort, showClient = true, showLabels = true,
  visibleColumns = DEFAULT_TASK_COLUMNS, onVisibleColumnsChange,
}: {
  sort: SortState;
  onSort: (key: SortKey) => void;
  showClient?: boolean;
  showLabels?: boolean;
  visibleColumns?: TaskColumnKey[];
  onVisibleColumnsChange?: (columns: TaskColumnKey[]) => void;
}) {
  const [showColumns, setShowColumns] = useState(false);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const isVisible = (key: TaskColumnKey) => visibleColumns.includes(key);

  function toggleColumn(key: TaskColumnKey) {
    if (!onVisibleColumnsChange) return;
    onVisibleColumnsChange(
      isVisible(key) ? visibleColumns.filter((column) => column !== key) : [...visibleColumns, key]
    );
  }

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
      {isVisible("status") && <Col k="status" label="Status" className="w-[84px] shrink-0" />}
      {isVisible("priority") && <Col k="priority" label="Prioridade" className="w-[78px] shrink-0" />}
      <Col k="title" label="Tarefa" className="flex-1 min-w-0" />
      {showLabels && isVisible("labels") && <span className="hidden lg:block w-[240px] shrink-0">Etiquetas</span>}
      {showClient && isVisible("client") && <Col k="client" label="Cliente" className="hidden sm:flex w-28 shrink-0" />}
      {isVisible("assignee") && <Col k="assignee" label="Responsável" className="w-[104px] shrink-0" />}
      {isVisible("dueDate") && <Col k="dueDate" label="Prazo" className="w-24 shrink-0 justify-end" />}
      {isVisible("publishDate") && <Col k="publishDate" label="Publicação" className="w-24 shrink-0 justify-end" />}
      <div className="relative w-[118px] shrink-0 flex justify-end">
        {onVisibleColumnsChange && (
          <>
            <button
              ref={columnsButtonRef}
              type="button"
              onClick={() => setShowColumns((current) => !current)}
              title="Escolher colunas"
              aria-label="Escolher colunas visíveis"
              aria-expanded={showColumns}
              className="inline-flex items-center gap-1 normal-case tracking-normal text-[11px] text-gray-500 hover:text-gray-800"
            >
              <Settings2 size={13} /> Colunas
            </button>
            <Floating
              anchorRef={columnsButtonRef}
              open={showColumns}
              onClose={() => setShowColumns(false)}
              width={192}
              className="p-2 normal-case tracking-normal"
            >
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Exibir na lista</p>
              {TASK_COLUMN_OPTIONS.map((option) => (
                <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-normal text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={isVisible(option.key)}
                    onChange={() => toggleColumn(option.key)}
                    className="rounded accent-current text-accent"
                  />
                  {option.label}
                </label>
              ))}
              <p className="px-2 pt-1.5 text-[10px] font-normal leading-tight text-gray-400">A tarefa e as ações permanecem sempre visíveis.</p>
            </Floating>
          </>
        )}
      </div>
    </div>
  );
}
