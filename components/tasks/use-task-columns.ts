"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TASK_COLUMNS, isTaskColumnKey, type TaskColumnKey } from "@/lib/task-columns";

const STORAGE_KEY = "hadar:task-list-columns:v1";

export function useTaskColumns() {
  const [visibleColumns, setVisibleColumnsState] = useState<TaskColumnKey[]>(DEFAULT_TASK_COLUMNS);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(stored)) {
        setVisibleColumnsState(stored.filter(isTaskColumnKey));
      }
    } catch {
      // Prefer the complete default list if an old browser preference is invalid.
    }
  }, []);

  const setVisibleColumns = useCallback((columns: TaskColumnKey[]) => {
    const valid = columns.filter(isTaskColumnKey);
    setVisibleColumnsState(valid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
  }, []);

  return { visibleColumns, setVisibleColumns };
}
