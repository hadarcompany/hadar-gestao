"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { type TaskData } from "@/lib/types";
import { Loader2, Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, Edit3 } from "lucide-react";

export default function CalendarioPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Controle de Datas da Semana
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Erro ao buscar tarefas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, [fetchTasks]);

  // Lógica para Navegação de Semanas
  const goToPreviousWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  // Calcula os dias da semana atual (Segunda a Sexta)
  const weekDays = useMemo(() => {
    const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 1 = Segunda
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 5; i++) { // Apenas os 5 dias úteis
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Agrupa as tarefas pelos dias da semana
  const tasksByDay = useMemo(() => {
    const grouped: Record<string, TaskData[]> = {};
    
    // Inicializa os arrays para os 5 dias
    weekDays.forEach(day => {
      grouped[day.toISOString().split('T')[0]] = [];
    });

    tasks.forEach(task => {
      if (!task.dueDate) return;
      const taskDate = new Date(task.dueDate);
      const dateString = taskDate.toISOString().split('T')[0];

      // Só adiciona se a tarefa pertencer a um dos dias desta semana útil
      if (grouped[dateString]) {
        grouped[dateString].push(task);
      }
    });

    return grouped;
  }, [tasks, weekDays]);

  const monthName = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const weekStartStr = weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const weekEndStr = weekDays[4].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const diasDaSemanaNomes = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      
      {/* HEADER DO CALENDÁRIO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Calendário <span className="text-zinc-500 font-normal">| {session?.user?.name?.split(' ')[0] ?? ""}</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          
          {/* Seletor de Mês (Informativo) */}
          <div className="px-4 py-2 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl text-sm font-medium text-white capitalize shadow-sm">
            {monthName}
          </div>

          {/* Navegação de Semana */}
          <div className="flex items-center bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden shadow-sm p-1">
            <button onClick={goToPreviousWeek} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="px-4 text-sm font-medium text-zinc-300">
              Semana ({weekStartStr} - {weekEndStr})
            </div>
            <button onClick={goToNextWeek} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20 h-10"
          >
            <Plus size={18} />
            Novo Evento/Tarefa
          </button>
        </div>
      </div>

      {/* GRID DA SEMANA (5 Colunas Lado a Lado) */}
      {loading ? (
        <div className="flex items-center justify-center py-32 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl">
          <Loader2 size={32} className="animate-spin text-[#FF5A00]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {weekDays.map((day, index) => {
            const dateString = day.toISOString().split('T')[0];
            const dayTasks = tasksByDay[dateString] || [];
            const isToday = new Date().toDateString() === day.toDateString();

            return (
              <div key={dateString} className="flex flex-col h-full min-h-[500px]">
                
                {/* CABEÇALHO DO DIA */}
                <div className={`p-3 rounded-t-2xl border-t border-x ${isToday ? 'bg-zinc-800 border-[#FF5A00]/50' : 'bg-zinc-900/80 border-zinc-800/60'}`}>
                  <h3 className={`text-sm font-semibold ${isToday ? 'text-white' : 'text-zinc-300'}`}>
                    {diasDaSemanaNomes[index]}, {day.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </h3>
                </div>

                {/* ÁREA DE TAREFAS EM CASCATA */}
                <div className={`flex-1 p-2 rounded-b-2xl border-b border-x bg-zinc-900/40 backdrop-blur-sm ${isToday ? 'border-[#FF5A00]/50' : 'border-zinc-800/60'}`}>
                  
                  {dayTasks.length === 0 ? (
                    <div className="h-full flex items-center justify-center pt-10 pb-4">
                      <p className="text-xs text-zinc-600 font-medium">Sem tarefas</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dayTasks.map((task) => {
                        const isCompleted = String(task.status).toLowerCase().includes('concluida') || String(task.status).toLowerCase().includes('concluída');
                        const isUrgent = String(task.priority).toLowerCase().includes('urgent');
                        const assigneeName = (task as any).assignees?.[0]?.user?.name || (task as any).assignees?.[0]?.name || "N/A";

                        return (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={`group relative p-3 rounded-xl border transition-all cursor-pointer shadow-sm
                              ${isCompleted 
                                ? 'bg-zinc-950/40 border-zinc-800/40 opacity-60 hover:opacity-100' 
                                : 'bg-zinc-900 border-zinc-700 hover:border-[#FF5A00]/50 hover:bg-zinc-800'
                              }
                            `}
                          >
                            {/* Status e Título */}
                            <div className="flex items-start gap-2 mb-3">
                              {isCompleted && (
                                <div className="mt-0.5 shrink-0">
                                  <Check size={14} className="text-[#FF5A00]" />
                                </div>
                              )}
                              <div>
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1
                                  ${isCompleted ? 'bg-zinc-800 text-zinc-500' : 'bg-[#FF5A00] text-white shadow-sm shadow-[#FF5A00]/20'}`}>
                                  {task.status || 'Status'}
                                </span>
                                <h4 className={`text-sm font-medium leading-tight line-clamp-2 ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                  {task.title}
                                  {!isCompleted && isUrgent && <span title="Urgente" className="ml-1 inline-block animate-pulse">🍌</span>}
                                </h4>
                              </div>
                            </div>

                            {/* Rodapé do Card (Responsável e Ícones) */}
                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-800/50">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] text-zinc-400 font-bold">
                                  {assigneeName.charAt(0).toUpperCase()}
                                </div>
                                <span className={`text-xs ${isCompleted ? 'text-zinc-600' : 'text-zinc-400'} truncate max-w-[80px]`}>
                                  {assigneeName.split(' ')[0]}
                                </span>
                              </div>
                              <Edit3 size={12} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAIS */}
      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchTasks}
        users={users}
        clients={clients}
      />

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onUpdated={() => { fetchTasks(); setSelectedTask(null); }}
        users={users}
        clients={clients}
      />
    </div>
  );
}