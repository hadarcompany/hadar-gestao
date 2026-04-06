"use client";

import { Badge } from "@/components/ui/badge";
import { Calendar, CheckSquare } from "lucide-react";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/task-templates";
import { type TaskData } from "@/lib/types";

interface TaskCardProps {
  task: TaskData;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const statusOpt = STATUS_OPTIONS.find((s) => s.value === task.status);
  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const checkDone = checklist.filter((c) => c.checked).length;
  const checkTotal = checklist.length;

  const statusVariant = ({
    PENDING: "default", IN_PROGRESS: "info", IN_REVIEW: "purple", COMPLETED: "success", CANCELLED: "danger",
  } as const)[task.status] || "default";

  const priorityVariant = ({
    LOW: "default", MEDIUM: "warning", HIGH: "warning", URGENT: "danger",
  } as const)[task.priority] || "default";

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" && task.status !== "CANCELLED";

  return (
    <div
      onClick={onClick}
      className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium text-white/80 group-hover:text-white transition-colors line-clamp-2">
          {task.title}
        </h3>
        <Badge variant={priorityVariant} className="shrink-0">{priorityOpt?.label ?? ""}</Badge>
      </div>

      {task.client && <p className="text-xs text-white/30 mb-3">{task.client.name}</p>}

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Badge variant={statusVariant}>{statusOpt?.label ?? ""}</Badge>
        {task.type && (
          <span className="text-[10px] text-white/20 px-2 py-0.5 rounded bg-white/5">
            {task.type.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Checklist progress */}
      {checkTotal > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-white/30">
              <CheckSquare size={12} />
              <span className="text-[10px]">{checkDone}/{checkTotal}</span>
            </div>
            <span className="text-[10px] text-white/20">{Math.round((checkDone / checkTotal) * 100)}%</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500/60 rounded-full transition-all" style={{ width: `${(checkDone / checkTotal) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((a, i) => (
            <span
              key={i}
              className="w-6 h-6 rounded-full bg-amber-500/20 border-2 border-[#0a0a0a] flex items-center justify-center text-[9px] text-amber-400 font-bold"
              title={a.user.name}
            >
              {a.user.name[0]}
            </span>
          ))}
          {task.assignees.length > 3 && (
            <span className="w-6 h-6 rounded-full bg-white/10 border-2 border-[#0a0a0a] flex items-center justify-center text-[9px] text-white/40">
              +{task.assignees.length - 3}
            </span>
          )}
        </div>
        {task.dueDate && (
          <div className={`flex items-center gap-1 text-[11px] ${isOverdue ? "text-red-400" : "text-white/25"}`}>
            <Calendar size={11} />
            {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}
