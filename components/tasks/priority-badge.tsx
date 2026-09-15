"use client";

import { useRef, useState } from "react";
import { Flag, Check } from "lucide-react";
import { Floating } from "@/components/ui/floating";
import { cn } from "@/lib/utils";

export const PRIORITY_STYLES: Record<string, { label: string; className: string; dot: string }> = {
  URGENT: { label: "Urgente", className: "bg-red-600 text-white", dot: "bg-red-600" },
  HIGH: { label: "Alta", className: "bg-orange-500 text-white", dot: "bg-orange-500" },
  MEDIUM: { label: "Média", className: "bg-amber-100 text-amber-800", dot: "bg-amber-400" },
  LOW: { label: "Baixa", className: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
};

const ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export function PriorityBadge({ priority, onChange }: { priority: string; onChange?: (priority: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.MEDIUM;

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={!onChange}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={onChange ? "Alterar prioridade" : "Prioridade"}
        className={cn(
          "shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap transition-opacity",
          style.className,
          onChange && "hover:opacity-85"
        )}
      >
        <Flag size={10} /> {style.label}
      </button>
      {onChange && (
        <Floating anchorRef={ref} open={open} onClose={() => setOpen(false)} width={170} className="p-1">
          {ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setOpen(false); if (p !== priority) onChange(p); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", PRIORITY_STYLES[p].dot)} />
              <span className="flex-1 text-left">{PRIORITY_STYLES[p].label}</span>
              {p === priority && <Check size={13} className="text-accent-dark" />}
            </button>
          ))}
        </Floating>
      )}
    </>
  );
}
