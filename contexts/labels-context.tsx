"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import type { LabelData } from "@/lib/labels";

interface LabelsContextType {
  labels: LabelData[];
  byId: Map<string, LabelData>;
  createLabel: (name: string, color: string) => Promise<LabelData | null>;
  updateLabel: (id: string, data: Partial<Pick<LabelData, "name" | "color">>) => Promise<void>;
  deleteLabel: (id: string) => Promise<void>;
}

const LabelsContext = createContext<LabelsContextType | null>(null);

/** Etiquetas carregadas uma vez para o sistema todo: editar nome ou cor reflete em todas as tarefas. */
export function LabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<LabelData[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/labels");
      if (res.ok) setLabels(await res.json());
    } catch {
      // sem etiquetas até a próxima carga
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createLabel = useCallback(async (name: string, color: string) => {
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    }).catch(() => null);
    if (!res?.ok) return null;
    const created: LabelData = await res.json();
    setLabels((prev) => [...prev, created]);
    return created;
  }, []);

  const updateLabel = useCallback(async (id: string, data: Partial<Pick<LabelData, "name" | "color">>) => {
    setLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...data } : l)));
    const res = await fetch(`/api/labels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => null);
    if (!res?.ok) load();
  }, [load]);

  const deleteLabel = useCallback(async (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    const res = await fetch(`/api/labels/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) load();
  }, [load]);

  const byId = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  return (
    <LabelsContext.Provider value={{ labels, byId, createLabel, updateLabel, deleteLabel }}>
      {children}
    </LabelsContext.Provider>
  );
}

export function useLabels() {
  const ctx = useContext(LabelsContext);
  if (!ctx) throw new Error("useLabels deve ser usado dentro de LabelsProvider");
  return ctx;
}
