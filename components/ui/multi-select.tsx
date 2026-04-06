"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label?: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
}

export function MultiSelect({ label, options, value, onChange, placeholder, allowCustom }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter(
    (o) => o.label.toLowerCase().includes(search.toLowerCase()) && !value.includes(o.value)
  );

  function toggle(val: string) {
    if (value.includes(val)) onChange(value.filter((v) => v !== val));
    else onChange([...value, val]);
  }

  function addCustom() {
    if (search.trim() && allowCustom && !value.includes(search.trim())) {
      onChange([...value, search.trim()]);
      setSearch("");
    }
  }

  const getLabel = (val: string) => options.find((o) => o.value === val)?.label ?? val;

  return (
    <div className="space-y-1.5" ref={ref}>
      {label && (
        <label className="block text-xs text-white/40 uppercase tracking-wider font-medium">{label}</label>
      )}
      <div
        className={cn(
          "min-h-[38px] px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg cursor-pointer flex flex-wrap gap-1.5 items-center",
          open && "border-amber-500/50 ring-1 ring-amber-500/20"
        )}
        onClick={() => setOpen(true)}
      >
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
            {getLabel(v)}
            <X
              size={12}
              className="cursor-pointer hover:text-white"
              onClick={(e) => { e.stopPropagation(); toggle(v); }}
            />
          </span>
        ))}
        {value.length === 0 && <span className="text-sm text-white/20">{placeholder}</span>}
        <ChevronDown size={14} className="ml-auto text-white/20" />
      </div>
      {open && (
        <div className="mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 relative">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
            placeholder="Buscar..."
            className="w-full px-3 py-2 bg-transparent text-sm text-white placeholder-white/20 border-b border-white/5 focus:outline-none"
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { toggle(opt.value); setSearch(""); }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
              >
                {opt.label}
              </button>
            ))}
            {filtered.length === 0 && search && allowCustom && (
              <button
                onClick={addCustom}
                className="w-full text-left px-3 py-2 text-sm text-amber-400 hover:bg-white/5"
              >
                + Adicionar &quot;{search}&quot;
              </button>
            )}
            {filtered.length === 0 && !search && (
              <p className="px-3 py-2 text-xs text-white/20">Sem opções</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
