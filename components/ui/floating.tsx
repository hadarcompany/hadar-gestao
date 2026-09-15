"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface FloatingProps {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  className?: string;
}

/**
 * Painel preso a um elemento âncora, renderizado no body: assim não é cortado por
 * listas com overflow nem fica atrás do modal da tarefa (z-[100]).
 */
export function Floating({ anchorRef, open, onClose, children, width = 288, className }: FloatingProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const height = panelRef.current?.offsetHeight ?? 0;
      const fitsBelow = window.innerHeight - anchor.bottom >= height + 12;
      const top = fitsBelow || anchor.top < height + 12 ? anchor.bottom + 6 : anchor.top - height - 6;
      const left = Math.min(Math.max(8, anchor.left), window.innerWidth - width - 8);
      setPos({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    // Captura antes do modal, para Esc fechar só o painel.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      // Eventos de portal sobem pela árvore do React: sem isso, clicar aqui abriria a tarefa da linha.
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      className={cn("z-[150] bg-white border border-gray-200 rounded-xl shadow-xl", className)}
    >
      {children}
    </div>,
    document.body
  );
}
