"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  TASK_TEMPLATES,
  TASK_TYPES,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  generateChecklist,
  type TaskType,
  type ChecklistItem,
} from "@/lib/task-templates";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface User { id: string; name: string; }
interface Client { id: string; name: string; }

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  users: User[];
  clients: Client[];
}

export function CreateTaskModal({ open, onClose, onCreated, users, clients }: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [taskType, setTaskType] = useState<string>("");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [estimatedTime, setEstimatedTime] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [extraFields, setExtraFields] = useState<Record<string, string | string[]>>({});
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setTaskType(""); setTitle(""); setClientId(""); setAssigneeIds([]);
      setStatus("PENDING"); setPriority("MEDIUM"); setStartDate(""); setDueDate("");
      setDescription(""); setTags([]); setEstimatedTime(""); setChecklist([]);
      setExtraFields({}); setNewChecklistItem("");
    }
  }, [open]);

  // Load template when type changes
  useEffect(() => {
    if (!taskType) return;
    const template = TASK_TEMPLATES[taskType as TaskType];
    if (template) {
      setTitle(template.defaultTitle);
      setChecklist(generateChecklist(template.checklist));
      setExtraFields({});
    }
  }, [taskType]);

  function addChecklistItem() {
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, { id: `custom-${Date.now()}`, text: newChecklistItem.trim(), checked: false }]);
    setNewChecklistItem("");
  }

  function removeChecklistItem(id: string) {
    setChecklist(checklist.filter((c) => c.id !== id));
  }

  function updateSlideIdea(index: number, value: string) {
    const current = (extraFields.slide_ideas as string[]) || [];
    const updated = [...current];
    updated[index] = value;
    setExtraFields({ ...extraFields, slide_ideas: updated });
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, type: taskType || null, description, status, priority,
          startDate: startDate || null, dueDate: dueDate || null,
          estimatedTime: estimatedTime || null,
          checklist, extraFields: Object.keys(extraFields).length > 0 ? extraFields : null,
          tags, clientId: clientId || null, assigneeIds,
        }),
      });

      if (res.ok) {
        onCreated();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  const currentTemplate = taskType ? TASK_TEMPLATES[taskType as TaskType] : null;
  const slideCount = parseInt((extraFields.qtd_slides as string) || "0") || 0;

  return (
    <Modal open={open} onClose={onClose} title="Criar Tarefa" size="xl">
      <div className="space-y-6">
        {/* Task Type */}
        <SelectField
          label="Tipo de Tarefa"
          value={taskType}
          onChange={setTaskType}
          placeholder="Selecione o tipo..."
          options={TASK_TYPES.map((t) => ({ value: t, label: TASK_TEMPLATES[t].label }))}
        />

        {/* Universal Fields - 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da tarefa" />
          <SelectField
            label="Cliente"
            value={clientId}
            onChange={setClientId}
            placeholder="Selecione..."
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>

        <MultiSelect
          label="Responsável(is)"
          options={users.map((u) => ({ value: u.id, label: u.name }))}
          value={assigneeIds}
          onChange={setAssigneeIds}
          placeholder="Selecione responsáveis..."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
          <SelectField label="Prioridade" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))} />
          <Input label="Data Início" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Data Entrega" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes da tarefa..." />
          <div className="space-y-4">
            <Input label="Tempo Estimado (horas)" type="number" step="0.5" value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="Ex: 2.5" />
            <MultiSelect label="Tags" options={[]} value={tags} onChange={setTags} placeholder="Adicione tags..." allowCustom />
          </div>
        </div>

        {/* Extra Fields for specific types */}
        {currentTemplate?.extraFields && (
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">
              Campos Extras — {currentTemplate.label}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {currentTemplate.extraFields
                .filter((f) => f.type === "number")
                .map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    type="number"
                    min="0"
                    value={(extraFields[field.key] as string) || ""}
                    onChange={(e) => setExtraFields({ ...extraFields, [field.key]: e.target.value })}
                  />
                ))}
            </div>
            {/* Slide ideas for carrossel */}
            {currentTemplate.extraFields.some((f) => f.type === "slides") && slideCount > 0 && (
              <div className="mt-4 space-y-2">
                <label className="block text-xs text-white/40 uppercase tracking-wider font-medium">
                  Ideia por Slide
                </label>
                {Array.from({ length: slideCount }).map((_, i) => (
                  <Input
                    key={i}
                    placeholder={`Slide ${i + 1}`}
                    value={((extraFields.slide_ideas as string[]) || [])[i] || ""}
                    onChange={(e) => updateSlideIdea(i, e.target.value)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Checklist */}
        {(checklist.length > 0 || taskType === "tarefa_generica") && (
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">Checklist</h3>
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group py-1">
                  <GripVertical size={14} className="text-white/10 shrink-0" />
                  <span className="text-sm text-white/70 flex-1">{item.text}</span>
                  <button
                    onClick={() => removeChecklistItem(item.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                placeholder="Adicionar item..."
                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50"
              />
              <button
                onClick={addChecklistItem}
                className="px-3 py-1.5 bg-amber-600/20 text-amber-400 rounded-lg text-sm hover:bg-amber-600/30 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/50 hover:text-white/70 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="px-6 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Criando..." : "Criar Tarefa"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
