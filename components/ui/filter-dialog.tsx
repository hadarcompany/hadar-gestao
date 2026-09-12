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
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-all"
      >
        <Filter size={15} />
        Filtrar
        <span className="ml-1 text-xs font-normal text-gray-400">{displayLabel}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Dialog */}
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Filter size={14} className="text-accent" /> Filtrar período
                </h3>
                <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-900 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Mode selector */}
              <div className="px-5 pt-4">
                <div className="flex gap-2 bg-gray-50 rounded-xl p-1">
                  <button
                    onClick={() => setMode("month")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                      mode === "month"
                        ? "bg-accent text-white shadow-lg shadow-[#FF5A00]/20"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <Calendar size={13} /> Por mês
                  </button>
                  <button
                    onClick={() => setMode("custom")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                      mode === "custom"
                        ? "bg-accent text-white shadow-lg shadow-[#FF5A00]/20"
                        : "text-gray-400 hover:text-gray-600"
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
                      <button onClick={() => setSelectedYear(y => y - 1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-bold text-gray-900">{selectedYear}</span>
                      <button onClick={() => setSelectedYear(y => y + 1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
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
                              ? "bg-accent text-white shadow-lg shadow-[#FF5A00]/20"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                          }`}
                        >
                          {name.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">Selecione mês e ano específico:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Mês</label>
                        <select
                          value={customMonth}
                          onChange={(e) => setCustomMonth(parseInt(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent/50"
                        >
                          {MONTH_NAMES.map((name, i) => (
                            <option key={i} value={i + 1}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Ano</label>
                        <input
                          type="number"
                          value={customYear}
                          onChange={(e) => setCustomYear(parseInt(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent/50"
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
                <button onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button onClick={handleApply} className="flex-1 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-dark rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20">
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
