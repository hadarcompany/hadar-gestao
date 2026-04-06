"use client";

import { useState, useEffect } from "react";
import { Filter, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface FilterDialogProps {
  month: number;
  year: number;
  onApply: (month: number, year: number) => void;
  label?: string;
}

export function FilterDialog({ month, year, onApply, label }: FilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedYear, setSelectedYear] = useState(year);
  const [customMonth, setCustomMonth] = useState(month);
  const [customYear, setCustomYear] = useState(year);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode("month");
      setSelectedMonth(month);
      setSelectedYear(year);
      setCustomMonth(month);
      setCustomYear(year);
    }
  }, [open, month, year]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleApply() {
    if (mode === "month") {
      onApply(selectedMonth, selectedYear);
    } else {
      onApply(customMonth, customYear);
    }
    setOpen(false);
  }

  const displayLabel = label || `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
      >
        <Filter size={15} />
        Filtrar
        <span className="ml-1 text-xs font-normal text-zinc-500">{displayLabel}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Dialog */}
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter size={14} className="text-[#FF5A00]" /> Filtrar período
                </h3>
                <button onClick={() => setOpen(false)} className="p-1 text-zinc-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Mode selector */}
              <div className="px-5 pt-4">
                <div className="flex gap-2 bg-zinc-950 rounded-xl p-1">
                  <button
                    onClick={() => setMode("month")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                      mode === "month"
                        ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Calendar size={13} /> Por mês
                  </button>
                  <button
                    onClick={() => setMode("custom")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                      mode === "custom"
                        ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Calendar size={13} /> Data personalizada
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-5 py-4">
                {mode === "month" ? (
                  <div className="space-y-4">
                    {/* Year nav */}
                    <div className="flex items-center justify-between">
                      <button onClick={() => setSelectedYear(y => y - 1)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-bold text-white">{selectedYear}</span>
                      <button onClick={() => setSelectedYear(y => y + 1)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* Month grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {MONTH_NAMES.map((name, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedMonth(i + 1)}
                          className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all ${
                            selectedMonth === i + 1
                              ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          {name.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Selecione mês e ano específico:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Mês</label>
                        <select
                          value={customMonth}
                          onChange={(e) => setCustomMonth(parseInt(e.target.value))}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5A00]/50"
                        >
                          {MONTH_NAMES.map((name, i) => (
                            <option key={i} value={i + 1}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Ano</label>
                        <input
                          type="number"
                          value={customYear}
                          onChange={(e) => setCustomYear(parseInt(e.target.value))}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5A00]/50"
                          min={2020}
                          max={2099}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 px-5 pb-5">
                <button onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button onClick={handleApply} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#FF5A00] hover:bg-[#E04D00] rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20">
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
