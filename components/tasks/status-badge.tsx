"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Floating } from "@/components/ui/floating";
import { STATUS_OPTIONS } from "@/lib/task-templates";
import { cn } from "@/lib/utils";

/** Selo de status; com `onChange`, clicar abre o menu para trocar sem abrir a tarefa. */
export function StatusBadge({ status, onChange }: { status: string; onChange?: (status: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = STATUS_OPTIONS.find((s) => s.value === status);

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={!onChange}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={onChange ? "Alterar status" : undefined}
        className={cn(
          "shrink-0 inline-flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap transition-opacity",
          current?.color ?? "bg-gray-100 text-gray-600",
          onChange && "hover:opacity-80"
        )}
      >
        {current?.label ?? status}
        {onChange && <ChevronDown size={10} className="opacity-60" />}
      </button>
      {onChange && (
        <Floating anchorRef={ref} open={open} onClose={() => setOpen(false)} width={210} className="p-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => { setOpen(false); if (s.value !== status) onChange(s.value); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", s.color)}>{s.label}</span>
              <span className="flex-1" />
              {s.value === status && <Check size={13} className="text-accent-dark" />}
            </button>
          ))}
        </Floating>
      )}
    </>
  );
}
