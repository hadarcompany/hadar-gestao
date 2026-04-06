"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning";
}

export function ConfirmDialog({
  open,
  title = "Confirmar ação",
  message,
  confirmLabel = "Sim, excluir",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  variant = "danger",
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => cancelRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (open) window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  const iconColor = variant === "danger" ? "text-red-400" : "text-amber-400";
  const iconBg = variant === "danger" ? "bg-red-500/10" : "bg-amber-500/10";
  const confirmBtnClass = variant === "danger"
    ? "bg-red-500 hover:bg-red-600 text-white"
    : "bg-amber-500 hover:bg-amber-600 text-white";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-4`}>
            <AlertTriangle size={24} className={iconColor} />
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-white text-center mb-2">{title}</h3>

          {/* Message */}
          <p className="text-sm text-zinc-400 text-center leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-xl transition-colors shadow-lg ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
