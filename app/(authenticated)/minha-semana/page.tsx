"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/page-header";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
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
  user: { id: string; name: string; image?: string | null };
  createdAt: string;
}

interface RankingEntry {
  userId: string;
  userName: string;
  completed: number;
}

export default function MinhaSemanaPage() {
  const { user } = useAuth();
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
        if (user?.id) {
          const myReview = data.find((r) => r.userId === user!.id);
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
  }, [currentWeek, user?.id]);

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

  const myReview = reviews.find((r) => r.userId === user?.id);

  const medalColors = ["text-accent", "text-gray-600", "text-accent-dark"];

  return (
    <div>
      <PageHeader title="Minha Semana" description="Reflexão semanal e ranking da equipe." />

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2 min-w-[220px] justify-center">
            <Calendar size={16} className="text-accent-dark" />
            <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
        {!isCurrentWeek && (
          <button
            onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 text-xs bg-accent/20 text-accent hover:bg-accent/30 rounded-lg transition-colors"
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
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={18} className="text-accent-dark" />
                <h3 className="text-sm font-semibold text-gray-700">
                  {myReview ? "Atualizar sua Reflexão Semanal" : "Reflexão Semanal"}
                </h3>
                {!canSubmit && (
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-400 ml-auto">
                    Disponível a partir de sexta-feira
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
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
                  <label className="block text-xs text-gray-500 mb-1.5">Dificuldades?</label>
                  <Textarea
                    value={difficulties}
                    onChange={(e) => setDifficulties(e.target.value)}
                    placeholder="Quais dificuldades você enfrentou?"
                    rows={3}
                    disabled={!canSubmit}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
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
                    className="flex items-center gap-2 px-5 py-2.5 text-sm bg-accent hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    <Send size={14} />
                    {submitting ? "Enviando..." : myReview ? "Atualizar" : "Enviar"}
                  </button>
                  {success && (
                    <span className="text-xs text-emerald-600">Enviado com sucesso!</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* All reviews for the week */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Reflexões da Semana {!isCurrentWeek && `(${weekLabel})`}
            </h3>
            {loading ? (
              <p className="text-sm text-gray-400">Carregando...</p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhuma reflexão enviada nesta semana ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar name={review.user.name} image={review.user.image} size={28} className="text-xs" />
                      <span className="text-sm font-medium text-gray-600">{review.user.name}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {format(new Date(review.createdAt), "dd/MM HH:mm")}
                      </span>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">
                          Como foi a semana
                        </p>
                        <p className="text-gray-600 whitespace-pre-wrap">{review.howWasWeek}</p>
                      </div>
                      {review.difficulties && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">
                            Dificuldades
                          </p>
                          <p className="text-gray-600 whitespace-pre-wrap">
                            {review.difficulties}
                          </p>
                        </div>
                      )}
                      {review.improvements && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">
                            Pontos de melhoria
                          </p>
                          <p className="text-gray-600 whitespace-pre-wrap">
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
          <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={18} className="text-accent-dark" />
              <h3 className="text-sm font-semibold text-gray-700">Ranking da Semana</h3>
            </div>

            {ranking.length === 0 ? (
              <p className="text-sm text-gray-400">Sem dados nesta semana.</p>
            ) : (
              <div className="space-y-2">
                {ranking.map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      idx === 0 ? "bg-accent-dark/10 border border-accent-dark/20" : "bg-gray-50"
                    }`}
                  >
                    <span
                      className={`text-lg font-bold w-7 text-center ${
                        medalColors[idx] || "text-gray-400"
                      }`}
                    >
                      {idx + 1}°
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          idx === 0 ? "text-accent" : "text-gray-600"
                        }`}
                      >
                        {entry.userName}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-lg font-bold ${
                          idx === 0 ? "text-accent" : "text-gray-500"
                        }`}
                      >
                        {entry.completed}
                      </span>
                      <p className="text-[10px] text-gray-400">tarefas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-[10px] text-gray-400 text-center">
                Baseado nas tarefas concluídas na semana
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
