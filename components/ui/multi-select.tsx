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
        <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</label>
      )}
      <div
        className={cn(
          "min-h-[38px] px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg cursor-pointer flex flex-wrap gap-1.5 items-center",
          open && "border-accent-dark/50 ring-1 ring-accent-dark/20"
        )}
        onClick={() => setOpen(true)}
      >
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 text-xs bg-accent-dark/20 text-accent px-2 py-0.5 rounded-full">
            {getLabel(v)}
            <X
              size={12}
              className="cursor-pointer hover:text-gray-900"
              onClick={(e) => { e.stopPropagation(); toggle(v); }}
            />
          </span>
        ))}
        {value.length === 0 && <span className="text-sm text-gray-400">{placeholder}</span>}
        <ChevronDown size={14} className="ml-auto text-gray-400" />
      </div>
      {open && (
        <div className="mt-1 bg-gray-100 border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50 relative">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
            placeholder="Buscar..."
            className="w-full px-3 py-2 bg-transparent text-sm text-gray-900 placeholder-gray-400 border-b border-gray-200 focus:outline-none"
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { toggle(opt.value); setSearch(""); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {opt.label}
              </button>
            ))}
            {filtered.length === 0 && search && allowCustom && (
              <button
                onClick={addCustom}
                className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-gray-100"
              >
                + Adicionar &quot;{search}&quot;
              </button>
            )}
            {filtered.length === 0 && !search && (
              <p className="px-3 py-2 text-xs text-gray-400">Sem opções</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
