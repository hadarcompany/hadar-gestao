"use client";
import { useId } from "react";
import { TASK_CATEGORIES } from "@/lib/task-category";

export function TaskCategoryField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="space-y-1.5">
    <label htmlFor={id} className="block text-xs text-gray-500 uppercase tracking-wider font-medium">Categoria da tarefa</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)} className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-accent-dark/50 focus:ring-1 focus:ring-accent-dark/20">
      <option value="">Automática pelo tipo ou pela origem</option>
      {TASK_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
    </select>
  </div>;
}
