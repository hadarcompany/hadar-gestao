"use client";
import { useEffect, useRef, useState } from "react";
import {
  X,
  ImagePlus,
  ArrowLeft,
  ArrowRight,
  Instagram,
  Facebook,
  Repeat2,
} from "lucide-react";
import {
  api,
  mutation,
  uploadAsset,
  dayKey,
  clock,
  formats,
  type Account,
  type Asset,
  type Target,
  type Detail,
} from "./shared";
import type { SocialOptions } from "@/lib/social/options";
import Dates, { type DateChoice, type RepeatChoice } from "./Dates";
import Preview from "./Preview";
import ImageEditor from "./ImageEditor";
import s from "@/app/(authenticated)/publicacoes/social.module.css";
type Props = {
  clientId: string;
  clientName: string;
  accounts: Account[];
  videoLimit: number;
  enabled: boolean;
  admin: boolean;
  detail?: Detail;
  copy?: boolean;
  viewOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
};
function Usernames({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(value?.join(", ") || "");
  return (
    <label>
      {label}
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          );
        }}
      />
    </label>
  );
}
export default function Composer(p: Props) {
  const editing = !!p.detail && !p.copy;
  const [caption, setCaption] = useState(p.detail?.caption || ""),
    [assets, setAssets] = useState<Asset[]>(p.detail?.media || []),
    [targets, setTargets] = useState<Target[]>(
      p.detail
        ? [
            {
              accountId: p.detail.accountId,
              format: p.detail.format === "CAROUSEL" ? "POST" : p.detail.format,
              options: p.detail.options || {},
            },
          ]
        : [],
    );
  const [covers, setCovers] = useState<Record<string, Asset>>(
      p.detail?.cover ? { [p.detail.accountId]: p.detail.cover } : {},
    ),
    [dates, setDates] = useState<DateChoice[]>(
      p.detail?.scheduledAt && !p.copy
        ? [
            {
              day: dayKey(p.detail.scheduledAt),
              time: clock(p.detail.scheduledAt),
            },
          ]
        : [],
    );
  const [mode, setMode] = useState<"manual" | "weekly">("manual"),
    [repeat, setRepeat] = useState<RepeatChoice>({
      weekdays: [],
      time: "09:00",
      startDate: dayKey(new Date()),
      endDate: null,
    });
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [editImage, setEditImage] = useState<Asset | null>(null),
    [advanced, setAdvanced] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    coverDialog = useRef<HTMLDialogElement>(null),
    video = useRef<HTMLVideoElement>(null),
    [coverTarget, setCoverTarget] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (coverTarget) coverDialog.current?.showModal();
    else coverDialog.current?.close();
  }, [coverTarget]);
  useEffect(() => {
    if (!dirty || p.viewOnly) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, p.viewOnly]);
  function close() {
    if (busy) return;
    if (
      p.viewOnly ||
      !dirty ||
      window.confirm("Fechar sem salvar as alterações desta publicação?")
    )
      p.onClose();
  }
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  function change() {
    setDirty(true);
    setError("");
  }
  function toggle(a: Account, format: string) {
    const existing = targets.some(
      (t) => t.accountId === a.id && t.format === format,
    );
    if (
      !existing &&
      format === "REEL" &&
      assets.some((m) => m.mime !== "video/mp4")
    ) {
      setError(
        "Reels aceita somente um vídeo. Remova as imagens do conteúdo antes de selecionar Reels. A capa é enviada separadamente.",
      );
      return;
    }
    if (!existing && format !== "POST" && assets.length > 1) {
      setError(
        `${formats[format]} aceita um arquivo por publicação. Para repetir um Story, selecione vários dias na programação.`,
      );
      return;
    }
    if (
      !existing &&
      format === "POST" &&
      assets.some((m) => m.mime === "video/mp4")
    ) {
      setError("Para este vídeo, selecione Reels ou Stories.");
      return;
    }
    setTargets((old) =>
      editing
        ? [{ accountId: a.id, format, options: existing ? old[0].options : {} }]
        : existing
          ? old.filter((t) => !(t.accountId === a.id && t.format === format))
          : [...old, { accountId: a.id, format, options: {} }],
    );
    change();
  }
  function option(key: string, value: unknown) {
    setTargets((old) =>
      old.map((t) =>
        t.accountId + ":" + t.format === advanced
          ? { ...t, options: { ...t.options, [key]: value } }
          : t,
      ),
    );
    change();
  }
  async function upload(files: FileList | null, coverFor?: string) {
    if (!files?.length) return;
    const list = Array.from(files);
    await work(async () => {
      if (!coverFor) {
        if (assets.length + list.length > 10)
          throw Error("Use até 10 imagens no carrossel.");
        const all = [...assets, ...list];
        if (
          targets.some((t) => t.format === "REEL") &&
          all.some((m) => ("mime" in m ? m.mime : m.type) !== "video/mp4")
        )
          throw Error(
            "Reels aceita somente vídeo. Envie a imagem no campo de capa.",
          );
        if (targets.some((t) => t.format !== "POST") && all.length > 1)
          throw Error("Reels e Stories aceitam um arquivo por publicação.");
        if (
          all.some((m) => ("mime" in m ? m.mime : m.type) === "video/mp4") &&
          (all.length > 1 || targets.some((t) => t.format === "POST"))
        )
          throw Error(
            "Use um vídeo em Reels ou Stories; carrossel aceita imagens JPEG.",
          );
      } else if (list.length !== 1 || list[0].type !== "image/jpeg")
        throw Error("A capa deve ser uma imagem JPEG.");
      for (const file of list) {
        const asset = await uploadAsset(
          file,
          p.clientId,
          p.videoLimit,
          setProgress,
        );
        if (coverFor) {
          setCovers((c) => ({ ...c, [coverFor]: asset }));
          setTargets((ts) =>
            ts.map((t) =>
              t.accountId === coverFor && t.format === "REEL"
                ? { ...t, options: { ...t.options, coverAssetId: asset.id } }
                : t,
            ),
          );
        } else setAssets((a) => [...a, asset]);
        setDirty(true);
      }
    });
  }
  async function captureFrame() {
    await work(async () => {
      const v = video.current;
      if (!v || v.readyState < 2)
        throw Error("Aguarde o vídeo carregar e escolha um quadro.");
      const c = document.createElement("canvas"),
        scale = Math.min(1, 1080 / v.videoWidth, 1920 / v.videoHeight);
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) =>
            b ? resolve(b) : reject(Error("Não foi possível capturar a capa.")),
          "image/jpeg",
          0.92,
        ),
      );
      const asset = await uploadAsset(
        new File([blob], "capa-reel.jpg", { type: "image/jpeg" }),
        p.clientId,
        p.videoLimit,
        setProgress,
      );
      setCovers((c) => ({ ...c, [coverTarget]: asset }));
      setTargets((ts) =>
        ts.map((t) =>
          t.accountId === coverTarget && t.format === "REEL"
            ? { ...t, options: { ...t.options, coverAssetId: asset.id } }
            : t,
        ),
      );
      setDirty(true);
      setCoverTarget("");
    });
  }
  async function save(status: string, publishNow = false) {
    await work(async () => {
      if (!targets.length) throw Error("Selecione pelo menos um canal.");
      if (
        !publishNow &&
        status !== "DRAFT" &&
        mode === "manual" &&
        !dates.length
      )
        throw Error("Selecione os dias e horários da publicação.");
      if (!publishNow && mode === "weekly" && !repeat.weekdays.length)
        throw Error("Selecione os dias da semana.");
      if (!publishNow && mode === "manual" && dates.some((d) => !d.time))
        throw Error("Preencha o horário de todas as datas.");
      if (
        status === "SCHEDULED" &&
        !window.confirm(
          `${publishNow ? "Publicar agora" : "Agendar diretamente"} em ${targets.map((t) => `${p.accounts.find((a) => a.id === t.accountId)?.name} (${formats[t.format]})`).join(", ")}${publishNow ? "" : mode === "weekly" ? " com repetição semanal" : ` em ${dates.length} data(s)`}? Não será enviada uma solicitação de aprovação ao cliente. Confira a prévia e os perfis antes de confirmar.`,
        )
      )
        return;
      const payload = {
        clientId: p.clientId,
        targets,
        assetIds: assets.map((a) => a.id),
        caption,
        status,
        publishNow,
        ...(publishNow
          ? {}
          : mode === "weekly"
            ? { recurrence: repeat }
            : dates.length
              ? {
                  scheduleDates: dates.map((d) =>
                    new Date(`${d.day}T${d.time}:00-03:00`).toISOString(),
                  ),
                }
              : {}),
      };
      if (p.detail && editing) {
        const target = targets[0];
        await api(
          `/api/social/posts/${p.detail.id}`,
          mutation(
            {
              clientId: p.clientId,
              action: "edit",
              caption,
              format: target.format,
              options: target.options,
              assetIds: assets.map((a) => a.id),
              status,
              publishNow,
              scheduledAt: dates[0]
                ? new Date(
                    `${dates[0].day}T${dates[0].time}:00-03:00`,
                  ).toISOString()
                : null,
            },
            "PATCH",
          ),
        );
      } else await api("/api/social/posts", mutation(payload));
      setDirty(false);
      p.onSaved();
    });
  }
  const adv = targets.find((t) => t.accountId + ":" + t.format === advanced),
    reels = targets.filter(
      (t) =>
        t.format === "REEL" &&
        p.accounts.find((a) => a.id === t.accountId)?.provider === "INSTAGRAM",
    );
  return (
    <dialog
      ref={dialog}
      className={`${s.dialog} ${s.composer}`}
      aria-labelledby="composer-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className={s.composerHeader}>
        <div>
          <span className={s.clientContext}>{p.clientName}</span>
          <h2 id="composer-title">
            {p.viewOnly
              ? "Conteúdo da publicação"
              : editing
                ? "Editar publicação"
                : p.copy
                  ? "Nova programação deste conteúdo"
                  : "Nova publicação"}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Fechar publicação"
          onClick={close}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </header>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      {editing && p.detail?.seriesId && (
        <p className={s.notice}>
          Esta edição vale somente para esta ocorrência. A repetição continua
          com o conteúdo original.
        </p>
      )}
      {p.copy && (
        <p className={s.notice}>
          O conteúdo original será preservado. Escolha novas datas ou uma
          repetição semanal.
        </p>
      )}
      <div className={s.composerGrid}>
        <div className={s.formStack}>
          <fieldset disabled={busy || p.viewOnly}>
            <legend>1. Canais</legend>
            <p className={s.help}>
              Selecione os formatos para cada perfil conectado.
            </p>
            {p.accounts
              .filter((a) =>
                editing && p.detail
                  ? a.id === p.detail.accountId
                  : a.status === "CONNECTED" &&
                    (!a.tokenExpiresAt ||
                      new Date(a.tokenExpiresAt) > new Date()),
              )
              .map((a) => (
                <div key={a.id} className={s.channelRow}>
                  <div>
                    {a.provider === "INSTAGRAM" ? (
                      <Instagram size={17} />
                    ) : (
                      <Facebook size={17} />
                    )}
                    <strong>{a.name}</strong>
                  </div>
                  <div className={s.actions}>
                    {["POST", "REEL", "STORY"].map((format) => (
                      <button
                        type="button"
                        key={format}
                        aria-pressed={targets.some(
                          (t) => t.accountId === a.id && t.format === format,
                        )}
                        className={
                          targets.some(
                            (t) => t.accountId === a.id && t.format === format,
                          )
                            ? s.selected
                            : ""
                        }
                        onClick={() => toggle(a, format)}
                      >
                        {formats[format]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            {!p.accounts.some((a) => a.status === "CONNECTED") && (
              <p className={s.empty}>
                Conecte uma conta deste cliente para preparar publicações.
              </p>
            )}
          </fieldset>
          <fieldset disabled={busy || p.viewOnly}>
            <legend>2. Texto da publicação</legend>
            <label>
              Legenda
              <textarea
                maxLength={2200}
                rows={5}
                value={caption}
                placeholder="Escreva a legenda…"
                onChange={(e) => {
                  setCaption(e.target.value);
                  change();
                }}
              />
            </label>
            <p className={s.help}>
              {caption.length}/2200 · Stories não recebem legenda sobre a mídia.
              Use o editor de imagem para escrever sobre a foto.
            </p>
          </fieldset>
          <fieldset disabled={busy || p.viewOnly}>
            <legend>3. Mídias</legend>
            <div className={s.sectionHeading}>
              <p className={s.help}>
                {assets.length > 1
                  ? `${assets.length} imagens · carrossel automático no Post`
                  : `${assets.length} arquivo(s)`}
              </p>
              <label className={s.uploadButton}>
                <ImagePlus size={16} /> Adicionar mídias
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,video/mp4"
                  className={s.hiddenInput}
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className={s.mediaGrid}>
              {assets.map((a, i) => (
                <div className={s.mediaTile} key={a.id}>
                  {a.previewUrl ? (
                    a.mime === "video/mp4" ? (
                      <video src={a.previewUrl} controls preload="metadata" />
                    ) : (
                      <img
                        src={a.previewUrl}
                        alt={`Mídia ${i + 1}: ${a.name}`}
                      />
                    )
                  ) : (
                    <p>Mídia indisponível</p>
                  )}
                  <span>
                    {i + 1}. {a.name}
                  </span>
                  <div className={s.actions}>
                    <button
                      type="button"
                      aria-label={`Mover mídia ${i + 1} para a esquerda`}
                      disabled={i === 0}
                      onClick={() => {
                        setAssets((items) => {
                          const next = [...items];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        });
                        change();
                      }}
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Mover mídia ${i + 1} para a direita`}
                      disabled={i === assets.length - 1}
                      onClick={() => {
                        setAssets((items) => {
                          const next = [...items];
                          [next[i + 1], next[i]] = [next[i], next[i + 1]];
                          return next;
                        });
                        change();
                      }}
                    >
                      <ArrowRight size={14} />
                    </button>
                    {a.mime === "image/jpeg" && (
                      <button type="button" onClick={() => setEditImage(a)}>
                        Editar texto
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Remover ${a.name}`}
                      onClick={() => {
                        setAssets((items) =>
                          items.filter((x) => x.id !== a.id),
                        );
                        change();
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className={s.help}>
              JPEG até 8 MB · MP4 até {p.videoLimit} MB. Um vídeo por Reel ou
              Story. Até 10 imagens por carrossel.
            </p>
            {reels.map((t) => (
              <div className={s.coverRow} key={t.accountId}>
                <strong>
                  Capa do Reel ·{" "}
                  {p.accounts.find((a) => a.id === t.accountId)?.name}
                </strong>
                {covers[t.accountId]?.previewUrl && (
                  <img
                    src={covers[t.accountId].previewUrl!}
                    alt="Capa selecionada"
                  />
                )}
                <div className={s.actions}>
                  <label className={s.uploadButton}>
                    Enviar capa JPEG
                    <input
                      type="file"
                      accept="image/jpeg"
                      className={s.hiddenInput}
                      onChange={(e) => {
                        void upload(e.target.files, t.accountId);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!assets[0] || assets[0].mime !== "video/mp4"}
                    onClick={() => setCoverTarget(t.accountId)}
                  >
                    Escolher quadro do vídeo
                  </button>
                  {covers[t.accountId] && (
                    <button
                      type="button"
                      onClick={() => {
                        setCovers((c) => {
                          const next = { ...c };
                          delete next[t.accountId];
                          return next;
                        });
                        setTargets((ts) =>
                          ts.map((item) => {
                            if (
                              item.accountId !== t.accountId ||
                              item.format !== "REEL"
                            )
                              return item;
                            const { coverAssetId, ...options } = item.options;
                            return { ...item, options };
                          }),
                        );
                        change();
                      }}
                    >
                      Remover capa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </fieldset>
          <fieldset disabled={busy || p.viewOnly} className={s.nestedFieldset}>
            <Dates
              dates={dates}
              onDates={(d) => {
                setDates(d);
                change();
              }}
              mode={mode}
              onMode={(m) => {
                setMode(m);
                change();
              }}
              repeat={repeat}
              onRepeat={(r) => {
                setRepeat(r);
                change();
              }}
              single={editing}
            />
          </fieldset>
          {targets.some(
            (t) =>
              p.accounts.find((a) => a.id === t.accountId)?.provider ===
                "INSTAGRAM" && t.format !== "STORY",
          ) && (
            <details className={s.advanced}>
              <summary>Configurações avançadas do Instagram</summary>
              <fieldset disabled={busy || p.viewOnly}>
                <label>
                  Canal para configurar
                  <select
                    value={advanced}
                    onChange={(e) => setAdvanced(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {targets
                      .filter(
                        (t) =>
                          p.accounts.find((a) => a.id === t.accountId)
                            ?.provider === "INSTAGRAM" && t.format !== "STORY",
                      )
                      .map((t) => (
                        <option
                          key={t.accountId + t.format}
                          value={t.accountId + ":" + t.format}
                        >
                          {p.accounts.find((a) => a.id === t.accountId)?.name} ·{" "}
                          {formats[t.format]}
                        </option>
                      ))}
                  </select>
                </label>
                {adv && (
                  <div className={s.formStack}>
                    <Usernames
                      key={advanced + "collab"}
                      label="Colaboradores · até 3"
                      value={adv.options.collaborators}
                      placeholder="@perfil1, @perfil2"
                      onChange={(v) => option("collaborators", v)}
                    />
                    <p className={s.help}>
                      O Instagram envia o convite. Cada colaborador precisa
                      aceitar no próprio aplicativo. A disponibilidade depende
                      da conta e da Meta.
                    </p>
                    <Usernames
                      key={advanced + "tags"}
                      label="Marcar pessoas · até 20"
                      value={adv.options.userTags}
                      placeholder="@perfil1, @perfil2"
                      onChange={(v) => option("userTags", v)}
                    />
                    <p className={s.help}>
                      Em posts e carrosséis, as marcações ficam no centro da
                      primeira imagem.
                    </p>
                    {adv.format === "POST" && (
                      <label>
                        Texto alternativo da primeira imagem
                        <input
                          maxLength={1000}
                          value={adv.options.altText || ""}
                          onChange={(e) => option("altText", e.target.value)}
                        />
                      </label>
                    )}
                    {adv.format === "REEL" && (
                      <>
                        <label className={s.check}>
                          <input
                            type="checkbox"
                            checked={adv.options.shareToFeed !== false}
                            onChange={(e) =>
                              option("shareToFeed", e.target.checked)
                            }
                          />
                          Compartilhar também no Feed
                        </label>
                        <label>
                          Nome do áudio original
                          <input
                            maxLength={80}
                            value={adv.options.audioName || ""}
                            onChange={(e) =>
                              option("audioName", e.target.value)
                            }
                          />
                        </label>
                        <p className={s.help}>
                          Mantém o áudio do arquivo enviado. A biblioteca de
                          músicas do Instagram não está disponível neste editor.
                        </p>
                      </>
                    )}
                    <label>
                      ID da localização na Meta
                      <input
                        inputMode="numeric"
                        value={adv.options.locationId || ""}
                        placeholder="ID numérico do local"
                        onChange={(e) => option("locationId", e.target.value)}
                      />
                    </label>
                    <label>
                      Primeiro comentário
                      <textarea
                        rows={3}
                        maxLength={2200}
                        value={adv.options.firstComment || ""}
                        onChange={(e) => option("firstComment", e.target.value)}
                      />
                    </label>
                    <label className={s.check}>
                      <input
                        type="checkbox"
                        checked={adv.options.disableComments || false}
                        onChange={(e) =>
                          option("disableComments", e.target.checked)
                        }
                      />
                      Desativar comentários após publicar
                    </label>
                    <p className={s.help}>
                      Primeiro comentário e controle de comentários exigem
                      autorização adicional. Se falharem, a publicação permanece
                      publicada com um aviso para conferência.
                    </p>
                    <label className={s.check}>
                      <input
                        type="checkbox"
                        checked={adv.options.isAiGenerated || false}
                        onChange={(e) =>
                          option("isAiGenerated", e.target.checked)
                        }
                      />
                      Identificar conteúdo gerado por IA
                    </label>
                  </div>
                )}
                <p className={s.help}>
                  Parceria paga, Instagram Shop e Reels de teste dependem de
                  elegibilidade e configuração específicas na Meta e ainda não
                  estão disponíveis neste módulo.
                </p>
              </fieldset>
            </details>
          )}
        </div>
        <Preview
          accounts={p.accounts}
          targets={targets}
          assets={assets}
          caption={caption}
          covers={covers}
        />
      </div>
      <footer className={s.composerFooter}>
        <div aria-live="polite">
          {progress ||
            `${targets.length} canal(is) · ${mode === "weekly" ? "repetição semanal" : `${dates.length} data(s)`}`}
          {mode === "weekly" && <Repeat2 size={15} />}
        </div>
        <div className={s.actions}>
          <button type="button" disabled={busy} onClick={close}>
            Fechar
          </button>
          {!p.viewOnly && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save("DRAFT")}
              >
                Salvar rascunho
              </button>
              <button
                type="button"
                className={!p.admin || !p.enabled ? s.primary : undefined}
                disabled={busy}
                onClick={() => void save("PENDING_APPROVAL")}
              >
                {busy ? "Salvando…" : "Enviar para aprovação"}
              </button>
              {p.admin && (
                <>
                  <button
                    type="button"
                    disabled={busy || !p.enabled}
                    title={
                      p.enabled
                        ? "Envia para publicação no próximo ciclo do agendador, sem aprovação do cliente"
                        : "O publicador automático ainda está desativado"
                    }
                    onClick={() => void save("SCHEDULED", true)}
                  >
                    Publicar agora
                  </button>
                  <button
                    type="button"
                    className={s.primary}
                    title={
                      p.enabled
                        ? "Agenda diretamente, sem solicitar aprovação ao cliente"
                        : "O agendador precisa ser ativado após o teste de publicação"
                    }
                    disabled={busy || !p.enabled}
                    onClick={() => void save("SCHEDULED")}
                  >
                    Agendar diretamente
                  </button>
                </>
              )}
            </>
          )}
        </div>
        {!p.viewOnly && (
          <p className={s.help}>
            A aprovação do cliente é opcional. “Enviar para aprovação” mantém o
            conteúdo pendente no Gestão.
          </p>
        )}
        {!p.enabled && !p.viewOnly && (
          <p className={s.help}>
            Publicação automática ainda desativada. Rascunhos e aprovação estão
            disponíveis.
          </p>
        )}
      </footer>
      {editImage && (
        <ImageEditor
          asset={editImage}
          onClose={() => setEditImage(null)}
          onSave={async (file) => {
            try {
              const edited = await uploadAsset(
                file,
                p.clientId,
                p.videoLimit,
                setProgress,
              );
              setAssets((items) =>
                items.map((a) => (a.id === editImage.id ? edited : a)),
              );
              change();
            } finally {
              setProgress("");
            }
          }}
        />
      )}
      <dialog
        ref={coverDialog}
        className={`${s.dialog} ${s.coverPicker}`}
        aria-label="Escolher quadro da capa"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setCoverTarget("");
        }}
      >
        <h2>Escolha um quadro para a capa</h2>
        {error && (
          <div role="alert" className={s.error}>
            {error}
          </div>
        )}
        <video
          ref={video}
          src={coverTarget ? assets[0]?.previewUrl || undefined : undefined}
          crossOrigin="anonymous"
          controls
          preload="metadata"
        />
        <p>Pause no quadro desejado e confirme.</p>
        <div className={s.actions}>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCoverTarget("")}
          >
            Voltar
          </button>
          <button
            type="button"
            className={s.primary}
            disabled={busy}
            onClick={() => void captureFrame()}
          >
            Usar este quadro
          </button>
        </div>
      </dialog>
    </dialog>
  );
}
