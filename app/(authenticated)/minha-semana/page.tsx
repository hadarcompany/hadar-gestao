"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/page-header";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, ChevronLeft, ChevronRight, Send, Calendar, MessageSquare } from "lucide-react";
import { startOfWeek, format, subWeeks, addWeeks, isFriday, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WeeklyReview {
  id: string;
  weekStart: string;
  howWasWeek: string;
  difficulties: string;
  improvements: string;
  tasksCompleted: number;
  userId: string;
  user: { id: string; name: string };
  createdAt: string;
}

interface RankingEntry {
  userId: string;
  userName: string;
  completed: number;
}

export default function MinhaSemanaPage() {
  const { data: session } = useSession();
  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [howWasWeek, setHowWasWeek] = useState("");
  const [difficulties, setDifficulties] = useState("");
  const [improvements, setImprovements] = useState("");

  const isCurrentWeek =
    format(currentWeek, "yyyy-MM-dd") ===
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const weekEnd = new Date(currentWeek);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${format(currentWeek, "dd/MM", { locale: ptBR })} — ${format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}`;

  const todayIsFriday = isFriday(new Date());
  const isAfterFriday = isAfter(new Date(), new Date(currentWeek.getFullYear(), currentWeek.getMonth(), currentWeek.getDate() + 4));
  const canSubmit = isCurrentWeek && (todayIsFriday || isAfterFriday);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const weekStr = currentWeek.toISOString();
      const res = await fetch(`/api/weekly-reviews?week=${weekStr}`);
      if (res.ok) {
        const data: WeeklyReview[] = await res.json();
        setReviews(data);

        // Build ranking
        const rankMap = new Map<string, RankingEntry>();
        data.forEach((r) => {
          rankMap.set(r.userId, {
            userId: r.userId,
            userName: r.user.name,
            completed: r.tasksCompleted,
          });
        });
        const sorted = Array.from(rankMap.values()).sort((a, b) => b.completed - a.completed);
        setRanking(sorted);

        // Pre-fill form if current user already submitted
        if (session?.user?.id) {
          const myReview = data.find((r) => r.userId === session.user.id);
          if (myReview) {
            setHowWasWeek(myReview.howWasWeek);
            setDifficulties(myReview.difficulties);
            setImprovements(myReview.improvements);
          } else {
            setHowWasWeek("");
            setDifficulties("");
            setImprovements("");
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [currentWeek, session?.user?.id]);

  // Fetch ranking from tasks for current week
  const fetchRankingFromTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?status=COMPLETED");
      if (res.ok) {
        const tasks = await res.json();
        const weekStart = new Date(currentWeek);
        weekStart.setHours(0, 0, 0, 0);
        const weekEndDate = new Date(currentWeek);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        weekEndDate.setHours(23, 59, 59, 999);

        const userMap = new Map<string, RankingEntry>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tasks.forEach((t: any) => {
          const updatedAt = new Date(t.updatedAt);
          if (updatedAt >= weekStart && updatedAt <= weekEndDate) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            t.assignees?.forEach((a: any) => {
              const existing = userMap.get(a.user.id);
              if (existing) {
                existing.completed++;
              } else {
                userMap.set(a.user.id, {
                  userId: a.user.id,
                  userName: a.user.name,
                  completed: 1,
                });
              }
            });
          }
        });

        const sorted = Array.from(userMap.values()).sort((a, b) => b.completed - a.completed);
        if (sorted.length > 0) {
          setRanking(sorted);
        }
      }
    } catch {}
  }, [currentWeek]);

  useEffect(() => {
    fetchReviews();
    fetchRankingFromTasks();
  }, [fetchReviews, fetchRankingFromTasks]);

  async function handleSubmit() {
    if (!howWasWeek.trim()) return;
    setSubmitting(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/weekly-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ howWasWeek, difficulties, improvements }),
      });
      if (res.ok) {
        setSuccess(true);
        fetchReviews();
        fetchRankingFromTasks();
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function prevWeek() {
    setCurrentWeek(subWeeks(currentWeek, 1));
  }

  function nextWeek() {
    setCurrentWeek(addWeeks(currentWeek, 1));
  }

  const myReview = reviews.find((r) => r.userId === session?.user?.id);

  const medalColors = ["text-amber-400", "text-zinc-300", "text-amber-700"];

  return (
    <div>
      <PageHeader title="Minha Semana" description="Reflexão semanal e ranking da equipe." />

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ChevronLeft size={18} className="text-white/60" />
          </button>
          <div className="flex items-center gap-2 min-w-[220px] justify-center">
            <Calendar size={16} className="text-amber-500" />
            <span className="text-sm font-medium text-white/80">{weekLabel}</span>
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ChevronRight size={18} className="text-white/60" />
          </button>
        </div>
        {!isCurrentWeek && (
          <button
            onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 text-xs bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 rounded-lg transition-colors"
          >
            Semana Atual
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form / My review */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submit form - only on current week, from Friday on */}
          {isCurrentWeek && (
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={18} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-white/80">
                  {myReview ? "Atualizar sua Reflexão Semanal" : "Reflexão Semanal"}
                </h3>
                {!canSubmit && (
                  <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full text-white/30 ml-auto">
                    Disponível a partir de sexta-feira
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">
                    Como foi sua semana?
                  </label>
                  <Textarea
                    value={howWasWeek}
                    onChange={(e) => setHowWasWeek(e.target.value)}
                    placeholder="Descreva como foi sua semana de trabalho..."
                    rows={3}
                    disabled={!canSubmit}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Dificuldades?</label>
                  <Textarea
                    value={difficulties}
                    onChange={(e) => setDifficulties(e.target.value)}
                    placeholder="Quais dificuldades você enfrentou?"
                    rows={3}
                    disabled={!canSubmit}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">
                    Pontos de melhoria
                  </label>
                  <Textarea
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    placeholder="O que pode ser melhorado?"
                    rows={3}
                    disabled={!canSubmit}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting || !howWasWeek.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    <Send size={14} />
                    {submitting ? "Enviando..." : myReview ? "Atualizar" : "Enviar"}
                  </button>
                  {success && (
                    <span className="text-xs text-emerald-400">Enviado com sucesso!</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* All reviews for the week */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white/80 mb-4">
              Reflexões da Semana {!isCurrentWeek && `(${weekLabel})`}
            </h3>
            {loading ? (
              <p className="text-sm text-white/20">Carregando...</p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-white/30">
                Nenhuma reflexão enviada nesta semana ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-white/[0.02] border border-white/5 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold">
                        {review.user.name[0]}
                      </span>
                      <span className="text-sm font-medium text-white/70">{review.user.name}</span>
                      <span className="text-[10px] text-white/20 ml-auto">
                        {format(new Date(review.createdAt), "dd/MM HH:mm")}
                      </span>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/20 mb-0.5">
                          Como foi a semana
                        </p>
                        <p className="text-white/60 whitespace-pre-wrap">{review.howWasWeek}</p>
                      </div>
                      {review.difficulties && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/20 mb-0.5">
                            Dificuldades
                          </p>
                          <p className="text-white/60 whitespace-pre-wrap">
                            {review.difficulties}
                          </p>
                        </div>
                      )}
                      {review.improvements && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/20 mb-0.5">
                            Pontos de melhoria
                          </p>
                          <p className="text-white/60 whitespace-pre-wrap">
                            {review.improvements}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ranking sidebar */}
        <div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={18} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-white/80">Ranking da Semana</h3>
            </div>

            {ranking.length === 0 ? (
              <p className="text-sm text-white/30">Sem dados nesta semana.</p>
            ) : (
              <div className="space-y-2">
                {ranking.map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      idx === 0 ? "bg-amber-500/10 border border-amber-500/20" : "bg-white/[0.02]"
                    }`}
                  >
                    <span
                      className={`text-lg font-bold w-7 text-center ${
                        medalColors[idx] || "text-white/20"
                      }`}
                    >
                      {idx + 1}°
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          idx === 0 ? "text-amber-400" : "text-white/60"
                        }`}
                      >
                        {entry.userName}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-lg font-bold ${
                          idx === 0 ? "text-amber-400" : "text-white/40"
                        }`}
                      >
                        {entry.completed}
                      </span>
                      <p className="text-[10px] text-white/20">tarefas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-[10px] text-white/20 text-center">
                Baseado nas tarefas concluídas na semana
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
