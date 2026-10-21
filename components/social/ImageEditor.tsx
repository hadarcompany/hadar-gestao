"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Asset } from "./shared";
import s from "@/app/(authenticated)/publicacoes/social.module.css";
type Layer = {
  id: number;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  align: CanvasTextAlign;
};
export default function ImageEditor({
  asset,
  onClose,
  onSave,
}: {
  asset: Asset;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    image = useRef<HTMLImageElement | null>(null);
  const [layers, setLayers] = useState<Layer[]>([
      {
        id: 1,
        text: "",
        x: 50,
        y: 75,
        size: 5,
        color: "#ffffff",
        align: "center",
      },
    ]),
    [active, setActive] = useState(1),
    [ratio, setRatio] = useState("original"),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const layer = layers.find((l) => l.id === active)!;
  useEffect(() => {
    dialog.current?.showModal();
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      image.current = img;
      setLoaded(true);
    };
    img.onerror = () =>
      setError(
        "Não foi possível abrir essa imagem. Reabra o editor para renovar o acesso.",
      );
    img.src = asset.previewUrl || "";
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [asset.id, asset.previewUrl]);
  useEffect(() => {
    if (!loaded || !canvas.current || !image.current) return;
    const img = image.current,
      c = canvas.current,
      ctx = c.getContext("2d")!;
    const ar =
      ratio === "story"
        ? 9 / 16
        : ratio === "square"
          ? 1
          : img.width / img.height;
    c.width = Math.min(1080, img.width);
    c.height = Math.round(c.width / ar);
    if (c.height > 1920) {
      c.height = 1920;
      c.width = Math.round(c.height * ar);
    }
    const scale = Math.max(c.width / img.width, c.height / img.height);
    ctx.drawImage(
      img,
      (c.width - img.width * scale) / 2,
      (c.height - img.height * scale) / 2,
      img.width * scale,
      img.height * scale,
    );
    for (const l of layers) {
      const font = (c.width * l.size) / 100;
      ctx.font = `600 ${font}px Arial`;
      ctx.fillStyle = l.color;
      ctx.textAlign = l.align;
      ctx.textBaseline = "top";
      ctx.shadowColor = "#000000aa";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      const words = l.text.split("\n").flatMap((line) => {
        const result: string[] = [];
        let row = "";
        for (const word of line.split(" ")) {
          if (ctx.measureText(row + " " + word).width > c.width * 0.88 && row) {
            result.push(row);
            row = word;
          } else row += (row ? " " : "") + word;
        }
        return [...result, row];
      });
      words.forEach((line, i) =>
        ctx.fillText(
          line,
          (c.width * l.x) / 100,
          (c.height * l.y) / 100 + i * font * 1.25,
          c.width * 0.9,
        ),
      );
    }
  }, [layers, ratio, loaded]);
  function update(p: Partial<Layer>) {
    setLayers((ls) => ls.map((l) => (l.id === active ? { ...l, ...p } : l)));
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.current!.toBlob(
          (b) => (b ? resolve(b) : reject(Error("Falha ao gerar a imagem."))),
          "image/jpeg",
          0.92,
        ),
      );
      await onSave(
        new File([blob], asset.name.replace(/\.[^.]+$/, "") + "-editado.jpg", {
          type: "image/jpeg",
        }),
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`${s.dialog} ${s.imageDialog}`}
      aria-labelledby="image-editor-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className={s.sectionHeading}>
        <h2 id="image-editor-title">Texto sobre a imagem</h2>
        <button
          type="button"
          aria-label="Fechar editor de imagem"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p className={s.help}>
        Salva uma nova imagem. O arquivo original é preservado. O corte é
        centralizado.
      </p>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      <div className={s.imageWorkspace}>
        <div className={s.editorCanvas}>
          <canvas ref={canvas} aria-label="Prévia da imagem com textos" />
        </div>
        <fieldset
          disabled={busy}
          className={`${s.formStack} ${s.nestedFieldset}`}
        >
          <label>
            Formato
            <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
              <option value="original">Original</option>
              <option value="story">Stories · 9:16</option>
              <option value="square">Quadrado · 1:1</option>
            </select>
          </label>
          <div className={s.actions}>
            {layers.map((l, i) => (
              <button
                type="button"
                key={l.id}
                aria-pressed={active === l.id}
                onClick={() => setActive(l.id)}
              >
                Texto {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={layers.length >= 5}
              onClick={() => {
                const id = Date.now();
                setLayers((ls) => [...ls, { ...layer, id, text: "", y: 50 }]);
                setActive(id);
              }}
            >
              Adicionar texto
            </button>
          </div>
          <label>
            Texto
            <textarea
              rows={4}
              maxLength={500}
              value={layer.text}
              onChange={(e) => update({ text: e.target.value })}
            />
          </label>
          <label>
            Cor
            <input
              type="color"
              value={layer.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </label>
          <label>
            Tamanho · {layer.size}%
            <input
              type="range"
              min={2}
              max={12}
              step={0.5}
              value={layer.size}
              onChange={(e) => update({ size: Number(e.target.value) })}
            />
          </label>
          <label>
            Posição horizontal
            <input
              type="range"
              min={5}
              max={95}
              value={layer.x}
              onChange={(e) => update({ x: Number(e.target.value) })}
            />
          </label>
          <label>
            Posição vertical
            <input
              type="range"
              min={0}
              max={95}
              value={layer.y}
              onChange={(e) => update({ y: Number(e.target.value) })}
            />
          </label>
          <label>
            Alinhamento
            <select
              value={layer.align}
              onChange={(e) =>
                update({ align: e.target.value as CanvasTextAlign })
              }
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </label>
          <button
            type="button"
            disabled={layers.length === 1}
            onClick={() => {
              setLayers((ls) => ls.filter((l) => l.id !== active));
              setActive(layers.find((l) => l.id !== active)!.id);
            }}
          >
            Remover texto selecionado
          </button>
        </fieldset>
      </div>
      <div className={s.dialogActions}>
        <button type="button" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={s.primary}
          disabled={busy || !loaded}
          onClick={() => void save()}
        >
          {busy ? "Salvando…" : "Usar imagem editada"}
        </button>
      </div>
    </dialog>
  );
}
