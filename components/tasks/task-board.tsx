"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, MousePointer2, Plus, Save, Trash2, Type, ZoomIn, ZoomOut } from "lucide-react";

type BoardElement = {
  id: string;
  type: "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  attachmentId?: string;
};

const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 2400;
const PAN_MARGIN = 1200;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TaskBoard({ taskId }: { taskId: string }) {
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    hydrated.current = false;
    setLoading(true);
    fetch(`/api/tasks/${taskId}/board`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setElements(Array.isArray(data.elements) ? data.elements : []);
        hydrated.current = true;
      })
      .catch(() => setSaveState("error"))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [taskId]);

  useEffect(() => {
    if (loading || !scrollRef.current) return;
    const viewport = scrollRef.current;
    requestAnimationFrame(() => {
      viewport.scrollLeft = PAN_MARGIN * zoom;
      viewport.scrollTop = PAN_MARGIN * zoom;
    });
  // Centraliza a origem apenas quando muda de tarefa; o zoom preserva o ponto do cursor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, taskId]);

  useEffect(() => {
    if (!hydrated.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/tasks/${taskId}/board`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements }),
      }).catch(() => null);
      setSaveState(response?.ok ? "saved" : "error");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [elements, taskId]);

  const uploadImages = useCallback(async (files: File[]) => {
    const valid = files.filter((file) => file.type.startsWith("image/") && file.size > 0 && file.size <= 8 * 1024 * 1024);
    if (!valid.length) return;
    setUploading(true);
    try {
      const created: BoardElement[] = [];
      for (const [index, file] of valid.entries()) {
        const body = new FormData();
        body.append("file", file, file.name || `imagem-colada-${Date.now()}.png`);
        const response = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body });
        if (!response.ok) throw new Error();
        const attachment = await response.json();
        created.push({
          id: uid(), type: "image", attachmentId: attachment.id,
          x: 120 + index * 30, y: 120 + index * 30, width: 360, height: 240,
        });
      }
      setElements((current) => [...current, ...created]);
      setSelectedId(created.at(-1)?.id ?? null);
    } finally {
      setUploading(false);
    }
  }, [taskId]);

  function addText() {
    const element: BoardElement = { id: uid(), type: "text", x: 140, y: 140, width: 280, height: 120, text: "Digite seu texto…" };
    setElements((current) => [...current, element]);
    setSelectedId(element.id);
  }

  function startMove(event: React.PointerEvent, element: BoardElement) {
    if ((event.target as HTMLElement).closest("textarea,button,[data-resize]")) return;
    event.preventDefault();
    setSelectedId(element.id);
    const origin = { clientX: event.clientX, clientY: event.clientY, x: element.x, y: element.y };
    const move = (next: PointerEvent) => setElements((current) => current.map((item) => item.id === element.id ? {
      ...item,
      x: Math.max(0, Math.min(CANVAS_WIDTH - item.width, origin.x + (next.clientX - origin.clientX) / zoom)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - item.height, origin.y + (next.clientY - origin.clientY) / zoom)),
    } : item));
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function startResize(event: React.PointerEvent, element: BoardElement) {
    event.preventDefault();
    event.stopPropagation();
    const origin = { clientX: event.clientX, clientY: event.clientY, width: element.width, height: element.height };
    const move = (next: PointerEvent) => setElements((current) => current.map((item) => item.id === element.id ? {
      ...item,
      width: Math.max(120, origin.width + (next.clientX - origin.clientX) / zoom),
      height: Math.max(70, origin.height + (next.clientY - origin.clientY) / zoom),
    } : item));
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function startPan(event: React.PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-board-element]")) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    event.preventDefault();
    event.stopPropagation();
    viewport.setPointerCapture?.(event.pointerId);
    setSelectedId(null);
    setPanning(true);
    const origin = { clientX: event.clientX, clientY: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    const move = (next: PointerEvent) => {
      viewport.scrollLeft = origin.left - (next.clientX - origin.clientX);
      viewport.scrollTop = origin.top - (next.clientY - origin.clientY);
    };
    const stop = () => {
      setPanning(false);
      if (viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      viewport.removeEventListener("pointermove", move);
      viewport.removeEventListener("pointerup", stop);
      viewport.removeEventListener("pointercancel", stop);
    };
    viewport.addEventListener("pointermove", move);
    viewport.addEventListener("pointerup", stop);
    viewport.addEventListener("pointercancel", stop);
  }

  function removeSelected() {
    if (!selectedId) return;
    setElements((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  }

  function changeZoom(nextValue: number, clientX?: number, clientY?: number) {
    const viewport = scrollRef.current;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextValue));
    if (!viewport) { setZoom(next); return; }
    const rect = viewport.getBoundingClientRect();
    const anchorX = clientX === undefined ? rect.width / 2 : clientX - rect.left;
    const anchorY = clientY === undefined ? rect.height / 2 : clientY - rect.top;
    const canvasX = (viewport.scrollLeft + anchorX) / zoom;
    const canvasY = (viewport.scrollTop + anchorY) / zoom;
    setZoom(next);
    requestAnimationFrame(() => {
      viewport.scrollLeft = canvasX * next - anchorX;
      viewport.scrollTop = canvasY * next - anchorY;
    });
  }

  if (loading) return <div className="h-[520px] flex items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-200">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600"><MousePointer2 size={14} /> Quadro livre</span>
        <button onClick={addText} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-gray-200"><Type size={13} /> Texto</button>
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-xs font-semibold text-accent cursor-pointer hover:bg-accent/20">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} Imagem
          <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void uploadImages(files); }} />
        </label>
        <button onClick={removeSelected} disabled={!selectedId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 size={13} /> Excluir</button>
        <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden ml-1">
          <button type="button" onClick={() => changeZoom(zoom / 1.25)} className="p-1.5 text-gray-500 hover:bg-gray-100" title="Diminuir zoom"><ZoomOut size={13} /></button>
          <span className="min-w-14 text-center text-[11px] font-semibold text-gray-500">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(zoom * 1.25)} className="p-1.5 text-gray-500 hover:bg-gray-100" title="Aumentar zoom"><ZoomIn size={13} /></button>
        </div>
        <div className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-gray-400">
          {saveState === "saving" ? <><Loader2 size={12} className="animate-spin" /> Salvando…</> : saveState === "error" ? <span className="text-red-600">Erro ao salvar</span> : <><Save size={12} /> Salvo</>}
        </div>
      </div>
      <div className="px-4 py-2 text-[11px] text-gray-500 bg-amber-50 border-b border-amber-100">
        Cole imagens com <strong>Ctrl+V</strong>. Use o <strong>scroll para zoom</strong>, arraste o fundo com o <strong>botão esquerdo</strong> para navegar e redimensione elementos pelo canto.
      </div>
      <div
        ref={scrollRef}
        onPointerDown={startPan}
        onWheel={(event) => { event.preventDefault(); changeZoom(zoom * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY); }}
        className={`h-[620px] overflow-auto bg-gray-50 overscroll-contain select-none ${panning ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
      >
        <div className="relative" style={{ width: (CANVAS_WIDTH + PAN_MARGIN * 2) * zoom, height: (CANVAS_HEIGHT + PAN_MARGIN * 2) * zoom }}>
          <div
            ref={canvasRef}
            tabIndex={0}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
              if (files.length) { event.preventDefault(); void uploadImages(files); }
            }}
            onDoubleClick={(event) => { if (event.target === event.currentTarget) addText(); }}
            className="absolute outline-none select-none"
            style={{
              left: PAN_MARGIN * zoom, top: PAN_MARGIN * zoom,
              width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})`, transformOrigin: "top left",
              backgroundImage: "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
          {elements.map((element) => (
            <div
              key={element.id}
              data-board-element
              onPointerDown={(event) => startMove(event, element)}
              onClick={() => setSelectedId(element.id)}
              className={`absolute group rounded-lg shadow-sm bg-white ${selectedId === element.id ? "ring-2 ring-accent" : "ring-1 ring-gray-200"}`}
              style={{ left: element.x, top: element.y, width: element.width, height: element.height }}
            >
              {element.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/tasks/${taskId}/attachments/${element.attachmentId}?inline=1`} alt="Imagem do quadro" draggable={false} className="w-full h-full object-contain rounded-lg pointer-events-none" />
              ) : (
                <textarea
                  value={element.text ?? ""}
                  onChange={(event) => setElements((current) => current.map((item) => item.id === element.id ? { ...item, text: event.target.value } : item))}
                  className="w-full h-full resize-none bg-transparent p-3 text-sm text-gray-800 outline-none rounded-lg"
                  aria-label="Texto do quadro"
                />
              )}
              <button data-resize onPointerDown={(event) => startResize(event, element)} className="absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-sm bg-accent cursor-se-resize opacity-0 group-hover:opacity-100" aria-label="Redimensionar" />
            </div>
          ))}
          {elements.length === 0 && <div className="absolute left-24 top-24 border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-400 pointer-events-none"><Plus className="mx-auto mb-2" /><p className="text-sm font-semibold">Cole uma imagem ou adicione um texto</p><p className="text-xs mt-1">Este espaço é livre e fica vinculado à tarefa.</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
