"use client";

import { useRef, useState } from "react";
import { useLabels } from "@/contexts/labels-context";
import { Floating } from "@/components/ui/floating";
import { LABEL_PALETTE, labelTextColor } from "@/lib/labels";
import { Check, Pencil, Plus, Trash2, ArrowLeft, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

export function LabelChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      title={name}
      className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap max-w-[130px] truncate", className)}
      style={{ backgroundColor: color, color: labelTextColor(color) }}
    >
      {name}
    </span>
  );
}

/** Etiquetas da tarefa + botão que abre o seletor. Salvar fica a cargo de quem usa (onChange). */
export function TaskLabels({
  labelIds, onChange, compact = false,
}: {
  labelIds: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
}) {
  const { byId } = useLabels();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const active = labelIds.map((id) => byId.get(id)).filter((l): l is NonNullable<typeof l> => !!l);
  const shown = compact ? active.slice(0, 2) : active;

  return (
    <div className="flex items-center gap-1 min-w-0 flex-wrap">
      {shown.map((l) => <LabelChip key={l.id} name={l.name} color={l.color} />)}
      {compact && active.length > shown.length && (
        <span className="text-[10px] text-gray-400" title={active.slice(2).map((l) => l.name).join(", ")}>+{active.length - shown.length}</span>
      )}
      <button
        ref={ref}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Etiquetas"
        aria-label="Editar etiquetas da tarefa"
        className={cn(
          "inline-flex items-center gap-1 rounded-md text-[11px] text-gray-400 hover:text-accent-dark hover:bg-gray-100 transition-colors",
          active.length ? "p-0.5" : "px-1.5 py-0.5 border border-dashed border-gray-300",
          compact && !active.length && "opacity-0 group-hover:opacity-100 focus:opacity-100"
        )}
      >
        {active.length ? <Plus size={12} /> : <><Tag size={11} /> Etiqueta</>}
      </button>
      <Floating anchorRef={ref} open={open} onClose={() => setOpen(false)} width={392}>
        <LabelPicker selected={labelIds} onChange={onChange} />
      </Floating>
    </div>
  );
}

function Palette({ value, onPick }: { value: string; onPick: (color: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5 mt-2 p-2 bg-gray-50 rounded-lg">
      {LABEL_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          aria-label={`Cor ${c}`}
          className={cn("w-6 h-6 rounded-md border border-black/10", c === value && "ring-2 ring-offset-1 ring-gray-700")}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export function LabelPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { labels, createLabel, updateLabel, deleteLabel } = useLabels();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_PALETTE[15]);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const created = await createLabel(name, newColor);
    if (created) setNewName("");
  }

  if (editing) {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => { setEditing(false); setPaletteFor(null); }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <ArrowLeft size={13} /> Voltar
          </button>
          <span className="text-xs font-semibold text-gray-700">Editar etiquetas</span>
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {labels.map((l) => (
            <div key={l.id}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaletteFor(paletteFor === l.id ? null : l.id)}
                  title="Trocar cor"
                  className="w-7 h-7 rounded-md shrink-0 border border-black/10"
                  style={{ backgroundColor: l.color }}
                />
                <input
                  defaultValue={l.name}
                  aria-label="Nome da etiqueta"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== l.name) updateLabel(l.id, { name: v }); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-accent/50"
                />
                <button
                  type="button"
                  onClick={() => { if (window.confirm(`Excluir a etiqueta "${l.name}"? Ela sai de todas as tarefas.`)) deleteLabel(l.id); }}
                  title="Excluir etiqueta"
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {paletteFor === l.id && <Palette value={l.color} onPick={(c) => { updateLabel(l.id, { color: c }); setPaletteFor(null); }} />}
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteFor(paletteFor === "__new" ? null : "__new")}
              title="Cor da nova etiqueta"
              className="w-7 h-7 rounded-md shrink-0 border border-black/10"
              style={{ backgroundColor: newColor }}
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder="Nova etiqueta"
              maxLength={40}
              className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={add}
              disabled={!newName.trim()}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-dark rounded-md disabled:opacity-50"
            >
              <Plus size={12} /> Criar
            </button>
          </div>
          {paletteFor === "__new" && <Palette value={newColor} onPick={(c) => { setNewColor(c); setPaletteFor(null); }} />}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      {labels.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Nenhuma etiqueta ainda. Crie a primeira em &quot;Editar etiquetas&quot;.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {labels.map((l) => {
            const on = selected.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggle(l.id)}
                aria-pressed={on}
                className={cn(
                  "relative flex items-center justify-center min-h-[32px] px-2 py-1 rounded-md text-xs font-medium transition-transform hover:scale-[1.03]",
                  on && "ring-2 ring-offset-1 ring-gray-800"
                )}
                style={{ backgroundColor: l.color, color: labelTextColor(l.color) }}
              >
                <span className="truncate">{l.name}</span>
                {on && <Check size={12} className="absolute right-1 top-1" />}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 py-1.5 rounded-lg hover:bg-gray-50"
      >
        <Pencil size={12} /> Editar etiquetas
      </button>
    </div>
  );
}
