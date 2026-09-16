"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { AREAS } from "@/lib/areas";

export interface AreaData {
  id: string;
  name: string;
  color: string;
  position: number;
}

/** Enquanto a lista não chega do banco, usa os nomes padrão do código. */
const FALLBACK: AreaData[] = AREAS.map((a, i) => ({ id: a.value, name: a.label, color: a.bar, position: i + 1 }));

interface AreasContextType {
  areas: AreaData[];
  byId: Map<string, AreaData>;
  renameArea: (id: string, name: string) => Promise<void>;
}

const AreasContext = createContext<AreasContextType | null>(null);

export function AreasProvider({ children }: { children: ReactNode }) {
  const [areas, setAreas] = useState<AreaData[]>(FALLBACK);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/areas");
      if (!res.ok) return;
      const data: AreaData[] = await res.json();
      if (data.length) setAreas(data);
    } catch {
      // segue com os nomes padrão
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renameArea = useCallback(async (id: string, name: string) => {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, name } : a)));
    const res = await fetch(`/api/areas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (!res?.ok) load();
  }, [load]);

  const byId = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  return <AreasContext.Provider value={{ areas, byId, renameArea }}>{children}</AreasContext.Provider>;
}

export function useAreas() {
  const ctx = useContext(AreasContext);
  if (!ctx) throw new Error("useAreas deve ser usado dentro de AreasProvider");
  return ctx;
}
