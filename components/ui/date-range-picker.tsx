"use client";

import { formatDateKeyBR } from "@/lib/dates";
import { RotateCcw } from "lucide-react";

interface DateRangePickerProps {
  from: string;
  to: string;
  isCustom: boolean;
  onChange: (from: string, to: string) => void;
  onResetToCurrentWeek: () => void;
}

export function DateRangePicker({ from, to, isCustom, onChange, onResetToCurrentWeek }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="text-xs text-gray-700 bg-transparent outline-none w-[92px]"
        aria-label="Data inicial"
      />
      <span className="text-gray-300 text-xs">→</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="text-xs text-gray-700 bg-transparent outline-none w-[92px]"
        aria-label="Data final"
      />
      {isCustom && (
        <button
          onClick={onResetToCurrentWeek}
          title="Voltar para a semana atual"
          className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-dark px-1.5 py-0.5 rounded transition-colors"
        >
          <RotateCcw size={11} /> Semana atual
        </button>
      )}
      <span className="hidden sm:inline text-[11px] text-gray-400 ml-1">
        {formatDateKeyBR(from)} – {formatDateKeyBR(to)}
      </span>
    </div>
  );
}
