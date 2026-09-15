"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MentionUser { id: string; name: string; image?: string | null }

/** "@texto" logo antes do cursor: é o que abre a lista de pessoas para marcar. */
const MENTION_AT_CURSOR = /@([\p{L}0-9._-]*)$/u;

function firstName(name: string) {
  return name.split(" ")[0];
}

/** Texto com as @menções da equipe destacadas. */
export function MentionText({ content, users }: { content: string; users: MentionUser[] }) {
  const handles = new Set(users.map((u) => firstName(u.name).toLowerCase()));
  return (
    <>
      {content.split(/(@[\p{L}0-9._-]+)/u).map((part, i) =>
        part.startsWith("@") && handles.has(part.slice(1).toLowerCase()) ? (
          <span key={i} className="font-semibold text-accent-dark bg-accent/10 rounded px-0.5">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  excludeUserId?: string;
  /** Ctrl/Cmd + Enter. */
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** Textarea em que digitar @ abre a lista da equipe (setas + Enter para escolher). */
export function MentionTextarea({
  value, onChange, users, excludeUserId, onSubmit, placeholder, rows = 3, autoFocus, ariaLabel, className,
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const suggestions = query === null
    ? []
    : users
        .filter((u) => u.id !== excludeUserId)
        .filter((u) => u.name.toLowerCase().split(" ").some((part) => part.startsWith(query.toLowerCase())))
        .slice(0, 6);

  function updateQuery(text: string, cursor: number) {
    const match = MENTION_AT_CURSOR.exec(text.slice(0, cursor));
    setQuery(match ? match[1] : null);
    setHighlight(0);
  }

  function pick(u: MentionUser) {
    const el = ref.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor).replace(MENTION_AT_CURSOR, `@${firstName(u.name)} `);
    onChange(before + value.slice(cursor));
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(suggestions[highlight]); return; }
      // Fecha só a lista, sem fechar o modal por trás.
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setQuery(null); return; }
    }
    if (onSubmit && e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit(); }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => { onChange(e.target.value); updateQuery(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onKeyDown={onKeyDown}
        onClick={(e) => updateQuery(value, e.currentTarget.selectionStart ?? value.length)}
        onBlur={() => setQuery(null)}
        rows={rows}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={cn(
          "w-full resize-y bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-accent/50",
          className
        )}
      />
      {suggestions.length > 0 && (
        <div role="listbox" className="absolute left-2 top-full -mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => { e.preventDefault(); pick(u); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left",
                i === highlight ? "bg-accent/10 text-accent-dark" : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Avatar name={u.name} image={u.image} size={20} className="text-[9px]" />
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
