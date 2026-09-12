"use client";

import { ClientIdentity } from "@/components/clients/client-identity";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Calendar, CheckSquare } from "lucide-react";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/task-templates";
import { formatDayMonthBR, isOverdue as isTaskOverdue } from "@/lib/dates";
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

  const isOverdue = isTaskOverdue(task);

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-accent/40 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors line-clamp-2">
          {task.title}
        </h3>
        <Badge variant={priorityVariant} className="shrink-0">{priorityOpt?.label ?? ""}</Badge>
      </div>

      {task.client && <p className="text-xs text-gray-400 mb-3"><ClientIdentity client={task.client} /></p>}

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Badge variant={statusVariant}>{statusOpt?.label ?? ""}</Badge>
        {task.type && (
          <span className="text-[10px] text-gray-400 px-2 py-0.5 rounded bg-gray-100">
            {task.type.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Checklist progress */}
      {checkTotal > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-gray-400">
              <CheckSquare size={12} />
              <span className="text-[10px]">{checkDone}/{checkTotal}</span>
            </div>
            <span className="text-[10px] text-gray-400">{Math.round((checkDone / checkTotal) * 100)}%</span>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-accent-dark/60 rounded-full transition-all" style={{ width: `${(checkDone / checkTotal) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((a, i) => (
            <span key={i} title={a.user.name} className="border-2 border-white rounded-full">
              <Avatar name={a.user.name} image={a.user.image} size={24} className="text-[9px]" />
            </span>
          ))}
          {task.assignees.length > 3 && (
            <span className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] text-gray-500">
              +{task.assignees.length - 3}
            </span>
          )}
        </div>
        {task.dueDate && (
          <div className={`flex items-center gap-1 text-[11px] ${isOverdue ? "text-red-600" : "text-gray-400"}`}>
            <Calendar size={11} />
            {formatDayMonthBR(task.dueDate)}
          </div>
        )}
      </div>
    </div>
  );
}
