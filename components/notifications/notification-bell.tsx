"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { type TaskData, type UserSummary } from "@/lib/types";
import { Bell, AtSign, ArrowLeftRight, Banknote, CheckCheck, Check, CircleAlert, ExternalLink, ListTodo, Loader2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  taskId: string | null;
  clientId: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 30_000;

function timeAgo(iso: string): string {
  const min = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function TypeIcon({ type }: { type: string }) {
  if (type === "MENTION") return <AtSign size={14} className="text-blue-600" />;
  if (type === "TRANSFER") return <ArrowLeftRight size={14} className="text-accent-dark" />;
  if (type === "PAYMENT_RECEIVED") return <Banknote size={14} className="text-emerald-600" />;
  if (type === "PAYMENT_OVERDUE") return <CircleAlert size={14} className="text-red-600" />;
  if (type === "TASK_OVERDUE") return <ListTodo size={14} className="text-amber-600" />;
  return <Bell size={14} className="text-gray-400" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskData | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const ref = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const playSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current || new AudioContextClass();
      audioRef.current = context;
      if (context.state === "suspended") context.resume().catch(() => {});
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(740, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1040, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.32);
    } catch {
      // O navegador pode bloquear áudio antes da primeira interação do usuário.
    }
  }, []);

  const showDesktopAlerts = useCallback((notifications: NotificationItem[]) => {
    if (!alertsEnabled || permission !== "granted" || notifications.length === 0) return;
    playSound();
    notifications.slice(0, 3).forEach((item) => {
      const desktop = new window.Notification(item.title, { body: item.body || undefined, tag: item.id, icon: "/favicon.ico" });
      desktop.onclick = () => {
        window.focus();
        window.location.href = item.taskId ? "/meu-trabalho" : "/financeiro";
        desktop.close();
      };
    });
  }, [alertsEnabled, permission, playSound]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const d = await res.json();
      const nextItems = (d.notifications ?? []) as NotificationItem[];
      if (knownIdsRef.current) {
        const fresh = nextItems.filter((item) => !item.read && !knownIdsRef.current!.has(item.id));
        showDesktopAlerts(fresh);
      }
      knownIdsRef.current = new Set(nextItems.map((item) => item.id));
      setItems(nextItems);
      setUnread(d.unreadCount ?? 0);
    } catch {
      // mantém a lista anterior; tenta de novo no próximo ciclo
    }
  }, [showDesktopAlerts]);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(window.Notification.permission);
    setAlertsEnabled(localStorage.getItem("hadar-desktop-alerts") === "enabled" && window.Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (!alertsEnabled) return;
    const unlockAudio = () => {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass && !audioRef.current) audioRef.current = new AudioContextClass();
      audioRef.current?.resume().catch(() => {});
    };
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => document.removeEventListener("pointerdown", unlockAudio);
  }, [alertsEnabled]);

  async function toggleDesktopAlerts() {
    if (!("Notification" in window)) return;
    if (alertsEnabled) {
      localStorage.removeItem("hadar-desktop-alerts");
      setAlertsEnabled(false);
      return;
    }
    const nextPermission = window.Notification.permission === "granted"
      ? "granted"
      : await window.Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      localStorage.setItem("hadar-desktop-alerts", "enabled");
      setAlertsEnabled(true);
      playSound();
      new window.Notification("Alertas da Hadar ativados", { body: "Pagamentos, cobranças vencidas e tarefas atrasadas aparecerão aqui." });
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    load();
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  function markRead(n: NotificationItem) {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((c) => Math.max(0, c - 1));
    fetch(`/api/notifications/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }

  async function openItem(n: NotificationItem) {
    markRead(n);
    if (!n.taskId) {
      if (n.type === "PAYMENT_RECEIVED" || n.type === "PAYMENT_OVERDUE") window.location.href = "/financeiro";
      return;
    }

    setOpeningId(n.id);
    try {
      const [taskRes] = await Promise.all([
        fetch(`/api/tasks/${n.taskId}`),
        users.length ? null : fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {}),
        clients.length
          ? null
          : fetch("/api/clients")
              .then((r) => r.json())
              .then((d) => setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))))
              .catch(() => {}),
      ]);
      if (taskRes.ok) {
        setTask(await taskRes.json());
        setOpen(false);
      }
    } finally {
      setOpeningId(null);
    }
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    }).catch(() => {});
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
        aria-expanded={open}
        className={cn(
          "relative p-2 rounded-lg border transition-colors",
          open ? "bg-accent/10 border-accent/30 text-accent-dark" : "bg-white border-gray-200 text-gray-500 hover:text-gray-900"
        )}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Notificações</p>
            <div className="flex items-center gap-2">
              {permission !== "unsupported" && (
                <button onClick={toggleDesktopAlerts} disabled={permission === "denied"} title={permission === "denied" ? "Permissão bloqueada no navegador" : undefined} className={cn("flex items-center gap-1 text-[11px] font-medium", alertsEnabled ? "text-emerald-600" : "text-gray-400 hover:text-accent", permission === "denied" && "cursor-not-allowed opacity-50")}>
                  {alertsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}{permission === "denied" ? "Bloqueado" : alertsEnabled ? "Som ativo" : "Ativar alertas"}
                </button>
              )}
              {unread > 0 && (
                <button onClick={markAllRead} title="Marcar todas como lidas" className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-dark">
                  <CheckCheck size={13} /><span className="hidden sm:inline">Ler todas</span>
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-10">Nenhuma notificação por aqui.</p>
            ) : (
              items.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-1 pr-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors",
                    !n.read && "bg-accent/5"
                  )}
                >
                  <button onClick={() => openItem(n)} className="flex-1 min-w-0 flex items-start gap-3 text-left pl-4 py-3">
                    <span className="mt-0.5 shrink-0"><TypeIcon type={n.type} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={cn("text-sm truncate", n.read ? "text-gray-600" : "text-gray-900 font-semibold")}>{n.title}</span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                      </span>
                      {n.body && <span className="block text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</span>}
                      <span className="block text-[11px] text-gray-300 mt-1">{timeAgo(n.createdAt)}</span>
                    </span>
                    {openingId === n.id
                      ? <Loader2 size={13} className="text-accent animate-spin shrink-0 mt-1" />
                      : n.taskId && <ExternalLink size={13} className="text-gray-300 shrink-0 mt-1" />}
                  </button>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markRead(n)}
                      title="Marcar como lida"
                      aria-label="Marcar como lida"
                      className="mt-2.5 p-1.5 rounded-md text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 shrink-0 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <Link
            href="/meu-trabalho"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-gray-500 hover:text-accent-dark py-2.5 border-t border-gray-100"
          >
            Ver tudo em Meu Trabalho
          </Link>
        </div>
      )}

      {/* Fora do cabeçalho: dentro dele o modal herdaria o z-index do header e ficaria atrás do menu. */}
      {task && createPortal(
        <TaskDetailModal
          open
          onClose={() => setTask(null)}
          task={task}
          onUpdated={() => setTask(null)}
          users={users}
          clients={clients}
        />,
        document.body
      )}
    </div>
  );
}
