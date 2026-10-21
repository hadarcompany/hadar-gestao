"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Plus,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { canEdit, canView } from "@/lib/permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./social.module.css";

type Account = {
  id: string;
  provider: "INSTAGRAM" | "FACEBOOK";
  name: string;
  status: string;
  tokenExpiresAt: string | null;
};
type Post = {
  id: string;
  caption: string;
  format: string;
  status: string;
  scheduledAt: string | null;
  lastError: string | null;
  publishStartedAt: string | null;
  account: Pick<Account, "id" | "provider" | "name">;
};
type Asset = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  previewUrl?: string | null;
};
const states: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_APPROVAL: "Aguardando aprovação",
  SCHEDULED: "Agendado",
  PROCESSING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  UNCERTAIN: "Conferir na rede social",
};
const formats: Record<string, string> = {
  POST: "Post",
  CAROUSEL: "Carrossel",
  REEL: "Reel",
  STORY: "Story",
};
const dayKey = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const monthNow = () => dayKey(new Date().toISOString()).slice(0, 7);
const clock = (value: string) =>
  new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Não foi possível concluir.");
  return data;
}
const mutation = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export default function PublicationsPage() {
  const { user } = useAuth(),
    admin = user?.role === "ADMIN",
    editable = !!user && canEdit(user, "publicacoes");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]),
    [clientId, setClientId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]),
    [posts, setPosts] = useState<Post[]>([]),
    [total, setTotal] = useState(0);
  const [setup, setSetup] = useState({
    instagram: false,
    facebook: false,
    publishingEnabled: false,
    videoLimitMB: 50,
    mediaRetentionHours: null as number | null,
  });
  const [uploadProgress, setUploadProgress] = useState("");
  const [month, setMonth] = useState(monthNow),
    [status, setStatus] = useState("ALL"),
    [day, setDay] = useState("");
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [composer, setComposer] = useState(false),
    [caption, setCaption] = useState(""),
    [format, setFormat] = useState("POST"),
    [targets, setTargets] = useState<string[]>([]),
    [assets, setAssets] = useState<Asset[]>([]),
    [when, setWhen] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [selection, setSelection] = useState<{
      session: string;
      pages: { id: string; name: string }[];
    } | null>(null),
    [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Post | null>(null),
    [scheduleTime, setScheduleTime] = useState("");
  const generation = useRef(0),
    dialog = useRef<HTMLDialogElement>(null),
    scheduleDialog = useRef<HTMLDialogElement>(null);
  const permitted = !!user && canView(user, "publicacoes");

  const load = useCallback(
    async (append = false) => {
      if (!clientId || !permitted) return;
      const version = ++generation.current;
      setLoading(true);
      setError("");
      try {
        const page = append ? Math.floor(posts.length / 50) : 0;
        const [list, connected, config] = await Promise.all([
          api(
            `/api/social/posts?clientId=${encodeURIComponent(clientId)}&month=${month}&page=${page}`,
          ),
          api(`/api/social/accounts?clientId=${encodeURIComponent(clientId)}`),
          api("/api/social/setup"),
        ]);
        if (version !== generation.current) return;
        setPosts((previous) =>
          append ? [...previous, ...list.posts] : list.posts,
        );
        setTotal(list.total);
        setAccounts(connected);
        setSetup(config);
      } catch (e) {
        if (version === generation.current) setError((e as Error).message);
      } finally {
        if (version === generation.current) setLoading(false);
      }
    },
    [clientId, month, permitted, posts.length],
  );
  // Scope changes reset the list; refresh/load-more explicitly uses the current page.
  useEffect(() => {
    setPosts([]);
    setDay("");
    void load();
    return () => {
      generation.current++;
    };
  }, [clientId, month, permitted]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!permitted) return;
    api("/api/clients")
      .then((rows) => {
        setClients(
          rows.map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          })),
        );
        const query = new URLSearchParams(window.location.search),
          chosen = query.get("clientId");
        if (chosen && rows.some((c: { id: string }) => c.id === chosen))
          setClientId(chosen);
        else if (rows.length) setClientId(rows[0].id);
        const result = query.get("social");
        if (result === "connected")
          setNotice("Conta conectada. Você já pode preparar uma publicação.");
        else if (result === "select_pages" && query.get("session")) {
          api(
            `/api/social/selection?session=${encodeURIComponent(query.get("session")!)}`,
          )
            .then((data) =>
              setSelection({
                session: query.get("session")!,
                pages: data.pages,
              }),
            )
            .catch((e) => setError(e.message));
        } else if (result)
          setError(
            (
              {
                cancelled:
                  "Autorização cancelada. Nenhuma conta foi conectada.",
                no_pages:
                  "Nenhuma página com permissão para publicar foi autorizada.",
                invalid_state:
                  "A conexão venceu. Clique em conectar novamente.",
                account_in_use: "Esta conta já está vinculada a outro cliente.",
              } as Record<string, string>
            )[result] ||
              "A conexão não foi concluída. Confira a configuração da Meta e tente novamente.",
          );
        if (result)
          window.history.replaceState(
            null,
            "",
            `/publicacoes${chosen ? `?clientId=${encodeURIComponent(chosen)}` : ""}`,
          );
      })
      .catch((e) => setError(e.message));
  }, [permitted]);
  useEffect(() => {
    if (composer) dialog.current?.showModal();
    else dialog.current?.close();
  }, [composer]);
  useEffect(() => {
    if (schedule) scheduleDialog.current?.showModal();
    else scheduleDialog.current?.close();
  }, [schedule]);

  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect(provider: Account["provider"]) {
    // Open synchronously so browsers don't block the official OAuth tab.
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setError("Permita abrir uma nova aba para conectar a conta.");
      return;
    }
    tab.opener = null;
    await act(async () => {
      try {
        const result = await api(
          "/api/social/connect",
          mutation({ clientId, provider }),
        );
        tab.location.href = result.url;
      } catch (e) {
        tab.close();
        throw e;
      }
    });
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    const uploadClient = clientId;
    await act(async () => {
      if (assets.length + files.length > 10)
        throw Error("Use até 10 arquivos.");
      for (const file of Array.from(files)) {
        if (
          !["image/jpeg", "video/mp4"].includes(file.type) ||
          file.size < 1 ||
          file.size >
            (file.type === "image/jpeg" ? 8 : setup.videoLimitMB) * 1024 * 1024
        )
          throw Error(
            `Use JPEG de até 8 MB ou MP4 de até ${setup.videoLimitMB} MB.`,
          );
        const prepared = await api(
          "/api/social/media",
          mutation({
            clientId: uploadClient,
            name: file.name,
            mime: file.type,
            bytes: file.size,
          }),
        );
        if (prepared.provider === "VPS") {
          for (
            let offset = 0;
            offset < file.size;
            offset += prepared.upload.chunkBytes
          ) {
            const chunk = file.slice(
              offset,
              offset + prepared.upload.chunkBytes,
            );
            let sent = false;
            for (let attempt = 0; attempt < 3 && !sent; attempt++) {
              try {
                const response = await fetch(
                  `${prepared.upload.url}?index=${offset / prepared.upload.chunkBytes}`,
                  {
                    method: "PUT",
                    body: chunk,
                    credentials: "omit",
                    redirect: "error",
                    headers: {
                      Authorization: `Bearer ${prepared.upload.token}`,
                      "Content-Type": "application/octet-stream",
                    },
                    signal: AbortSignal.timeout(60000),
                  },
                );
                sent = response.ok;
                if (!response.ok && response.status < 500) break;
              } catch {
                /* Retry the same immutable part after a lost response. */
              }
            }
            if (!sent)
              throw Error(
                `O envio de ${file.name} foi interrompido. Tente novamente.`,
              );
            setUploadProgress(
              `${file.name}: ${Math.round((Math.min(offset + chunk.size, file.size) / file.size) * 100)}%`,
            );
          }
        } else {
          const { error: uploadError } = await createSupabaseBrowserClient()
            .storage.from("social-media")
            .uploadToSignedUrl(prepared.path, prepared.token, file, {
              contentType: file.type,
            });
          if (uploadError)
            throw Error(`Falha no envio de ${file.name}. Tente novamente.`);
        }
        setUploadProgress(`Conferindo ${file.name}…`);
        const verified = await api(
          "/api/social/media",
          mutation({ id: prepared.asset.id, clientId: uploadClient }, "PATCH"),
        );
        setAssets((previous) => [
          ...previous,
          { ...prepared.asset, previewUrl: verified.previewUrl },
        ]);
      }
    }).finally(() => setUploadProgress(""));
  }
  async function save(nextStatus: string) {
    await act(async () => {
      const payload = {
        clientId,
        accountIds: targets,
        assetIds: assets.map((a) => a.id),
        caption,
        format,
        status: nextStatus,
        scheduledAt: when ? new Date(`${when}:00-03:00`).toISOString() : null,
      };
      await api(
        editingId ? `/api/social/posts/${editingId}` : "/api/social/posts",
        mutation(
          editingId ? { ...payload, action: "edit" } : payload,
          editingId ? "PATCH" : "POST",
        ),
      );
      setComposer(false);
      setAssets([]);
      setCaption("");
      setTargets([]);
      setWhen("");
      setNotice(
        nextStatus === "DRAFT"
          ? "Rascunho salvo."
          : "Conteúdo enviado para aprovação.",
      );
      await load();
    });
  }
  const current = new Date(`${month}-01T12:00:00Z`),
    count = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
    ).getUTCDate();
  const offset = (current.getUTCDay() + 6) % 7;
  const visible = posts.filter(
    (p) =>
      (status === "ALL" || p.status === status) &&
      (!day || (p.scheduledAt && dayKey(p.scheduledAt) === day)),
  );
  const connected = accounts.filter(
    (a) =>
      a.status === "CONNECTED" &&
      (!a.tokenExpiresAt || new Date(a.tokenExpiresAt) > new Date()),
  );
  const editorAccounts = editingId
    ? accounts.filter((a) => targets.includes(a.id))
    : connected;
  const moveMonth = (n: number) => {
    const date = new Date(`${month}-15T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + n);
    setMonth(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  };
  if (!permitted)
    return (
      <section className={styles.scope}>
        <h1>Publicações</h1>
        <p>
          Seu usuário não tem acesso a este módulo. Peça a liberação ao
          administrador.
        </p>
      </section>
    );
  return (
    <section className={styles.scope} data-ui>
      <div className={styles.heading}>
        <div>
          <h1>Publicações</h1>
          <p>Da aprovação ao horário de publicar, por cliente.</p>
        </div>
        <button
          className={styles.primary}
          disabled={!clientId || !editable || busy}
          onClick={() => {
            setViewOnly(false);
            setEditingId(null);
            setCaption("");
            setFormat("POST");
            setAssets([]);
            setTargets([]);
            setWhen("");
            setComposer(true);
          }}
        >
          <Plus size={16} /> Nova publicação
        </button>
      </div>
      <div className={styles.toolbar}>
        <label>
          Cliente
          <select
            value={clientId}
            disabled={busy}
            onChange={(e) => {
              setClientId(e.target.value);
              setAssets([]);
              setTargets([]);
            }}
          >
            <option value="">Selecione um cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={loading || !clientId} onClick={() => void load()}>
          Atualizar
        </button>
      </div>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className={styles.notice}>
          {notice}
        </div>
      )}
      {!clients.length && !loading && (
        <p className={styles.empty}>
          Cadastre um cliente para conectar suas redes sociais.
        </p>
      )}
      {clientId && (
        <>
          <section className={styles.accounts}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Contas deste cliente</h2>
                <p>
                  A autorização acontece diretamente no Instagram ou Facebook.
                </p>
              </div>
              {admin && (
                <div className={styles.actions}>
                  <button
                    disabled={busy}
                    onClick={() => void connect("INSTAGRAM")}
                  >
                    <Instagram size={16} /> Conectar Instagram
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void connect("FACEBOOK")}
                  >
                    <Facebook size={16} /> Conectar Facebook
                  </button>
                </div>
              )}
            </div>
            {!accounts.length ? (
              <p className={styles.empty}>Nenhuma conta conectada.</p>
            ) : (
              accounts.map((a) => (
                <div className={styles.account} key={a.id}>
                  <span>
                    {a.provider === "INSTAGRAM" ? (
                      <Instagram size={16} />
                    ) : (
                      <Facebook size={16} />
                    )}{" "}
                    {a.name}
                  </span>
                  <span>
                    {connected.some((c) => c.id === a.id)
                      ? "Conectada"
                      : "Reconectar"}
                  </span>
                  {admin && a.status !== "DISCONNECTED" && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Desconectar ${a.name}? Os agendamentos pendentes serão cancelados; o histórico será mantido.`,
                          )
                        )
                          void act(async () => {
                            await api(
                              "/api/social/accounts",
                              mutation({ id: a.id, clientId }, "DELETE"),
                            );
                            await load();
                          });
                      }}
                    >
                      Desconectar
                    </button>
                  )}
                </div>
              ))
            )}
            {admin && (!setup.instagram || !setup.facebook) && (
              <p className={styles.help}>
                A Hadar ainda precisa concluir a configuração da Meta para
                habilitar{" "}
                {!setup.instagram && !setup.facebook
                  ? "as duas conexões"
                  : !setup.instagram
                    ? "o Instagram"
                    : "o Facebook"}
                .
              </p>
            )}
          </section>
          {selection && (
            <section className={styles.accounts}>
              <h2>Quais páginas pertencem a este cliente?</h2>
              <p>Selecione somente as páginas que deseja conectar.</p>
              {selection.pages.map((p) => (
                <label className={styles.check} key={p.id}>
                  <input
                    type="checkbox"
                    checked={selectedPages.includes(p.id)}
                    onChange={(e) =>
                      setSelectedPages((old) =>
                        e.target.checked
                          ? [...old, p.id]
                          : old.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.name}
                </label>
              ))}
              <button
                disabled={busy || !selectedPages.length}
                onClick={() =>
                  void act(async () => {
                    await api(
                      "/api/social/selection",
                      mutation({
                        session: selection.session,
                        pageIds: selectedPages,
                      }),
                    );
                    setSelection(null);
                    setSelectedPages([]);
                    setNotice("Páginas conectadas.");
                    await load();
                  })
                }
              >
                Conectar páginas selecionadas
              </button>
            </section>
          )}
          <div className={styles.workspace}>
            {/* Fluid calendar + 360px editorial queue; on narrow screens the queue stacks. */}
            <section className={styles.calendar}>
              <div className={styles.sectionHeading}>
                <h2>
                  {current.toLocaleDateString("pt-BR", {
                    timeZone: "UTC",
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <div className={styles.actions}>
                  <button
                    aria-label="Mês anterior"
                    onClick={() => moveMonth(-1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setMonth(monthNow());
                      setDay("");
                    }}
                  >
                    Hoje
                  </button>
                  <button aria-label="Próximo mês" onClick={() => moveMonth(1)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.weekdays}>
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className={styles.days}>
                {Array.from({ length: offset }, (_, i) => (
                  <div className={styles.outside} key={`off-${i}`} />
                ))}
                {Array.from({ length: count }, (_, i) => {
                  const key = `${month}-${String(i + 1).padStart(2, "0")}`,
                    daily = posts.filter(
                      (p) =>
                        p.scheduledAt &&
                        dayKey(p.scheduledAt) === key &&
                        p.status !== "CANCELLED",
                    );
                  return (
                    <button
                      key={key}
                      className={`${styles.day} ${key === day ? styles.selected : ""}`}
                      aria-label={`${i + 1}, ${daily.length} publicações carregadas`}
                      onClick={() => setDay((old) => (old === key ? "" : key))}
                    >
                      <span
                        className={
                          key === dayKey(new Date().toISOString())
                            ? styles.today
                            : ""
                        }
                      >
                        {i + 1}
                      </span>
                      {daily.slice(0, 2).map((p) => (
                        <span
                          key={p.id}
                          title={`${p.account.name} · ${states[p.status]}`}
                          className={`${styles.calendarPost} ${["DRAFT", "PENDING_APPROVAL"].includes(p.status) ? styles.calendarDraft : ""}`}
                        >
                          {clock(p.scheduledAt!)} · {formats[p.format]}
                        </span>
                      ))}
                      {daily.length > 2 && <span>+{daily.length - 2}</span>}
                    </button>
                  );
                })}
              </div>
              <p className={styles.help}>
                Horário de Brasília.{" "}
                {posts.length < total
                  ? `Calendário parcial: ${posts.length} de ${total} publicações carregadas. Carregue as próximas abaixo.`
                  : "Rascunhos com horário sugerido ainda precisam de aprovação. Selecione um dia para conferir."}
              </p>
            </section>
            <section className={styles.queue}>
              <div className={styles.sectionHeading}>
                <h2>{day ? `Dia ${day.slice(8)}` : "Fila editorial"}</h2>
                {day && (
                  <button onClick={() => setDay("")}>Todos os dias</button>
                )}
              </div>
              <label className={styles.filter}>
                Situação
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ALL">Todas</option>
                  {Object.entries(states).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {loading && !posts.length ? (
                <p role="status" className={styles.empty}>
                  Carregando publicações…
                </p>
              ) : !visible.length ? (
                <div className={styles.empty}>
                  <Calendar size={20} />
                  <p>Nenhuma publicação neste período.</p>
                  <p>Prepare um rascunho ou ajuste os filtros.</p>
                </div>
              ) : (
                visible.map((p) => (
                  <article key={p.id} className={styles.post}>
                    <div className={styles.postHeading}>
                      <strong>{p.account.name}</strong>
                      <span
                        className={`${styles.badge} ${["FAILED", "UNCERTAIN"].includes(p.status) ? styles.bad : ""}`}
                      >
                        {p.publishStartedAt && p.status === "SCHEDULED"
                          ? "Processando na Meta"
                          : states[p.status]}
                      </span>
                    </div>
                    <p>{p.caption || `${formats[p.format]} sem legenda`}</p>
                    <div className={styles.meta}>
                      {p.account.provider === "INSTAGRAM"
                        ? "Instagram"
                        : "Facebook"}{" "}
                      · {formats[p.format]}
                      {p.scheduledAt &&
                        ` · ${dayKey(p.scheduledAt).slice(8)}/${dayKey(p.scheduledAt).slice(5, 7)} às ${clock(p.scheduledAt)}`}
                    </div>
                    {p.lastError && (
                      <p className={styles.errorText}>{p.lastError}</p>
                    )}
                    <div className={styles.actions}>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            const detail = await api(
                              `/api/social/posts/${p.id}?clientId=${encodeURIComponent(clientId)}`,
                            );
                            setViewOnly(true);
                            setEditingId(p.id);
                            setCaption(detail.caption);
                            setFormat(detail.format);
                            setTargets([detail.accountId]);
                            setAssets(detail.media);
                            setWhen(
                              detail.scheduledAt
                                ? `${dayKey(detail.scheduledAt)}T${clock(detail.scheduledAt)}`
                                : "",
                            );
                            setComposer(true);
                          })
                        }
                      >
                        Ver conteúdo
                      </button>
                      {editable &&
                        !p.publishStartedAt &&
                        [
                          "DRAFT",
                          "PENDING_APPROVAL",
                          "FAILED",
                          "SCHEDULED",
                        ].includes(p.status) && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act(async () => {
                                const detail = await api(
                                  `/api/social/posts/${p.id}?clientId=${encodeURIComponent(clientId)}`,
                                );
                                setViewOnly(false);
                                setEditingId(p.id);
                                setCaption(detail.caption);
                                setFormat(detail.format);
                                setTargets([detail.accountId]);
                                setAssets(detail.media);
                                setWhen(
                                  detail.scheduledAt
                                    ? `${dayKey(detail.scheduledAt)}T${clock(detail.scheduledAt)}`
                                    : "",
                                );
                                setComposer(true);
                              })
                            }
                          >
                            Editar
                          </button>
                        )}
                      {admin &&
                        !p.publishStartedAt &&
                        [
                          "DRAFT",
                          "PENDING_APPROVAL",
                          "FAILED",
                          "SCHEDULED",
                        ].includes(p.status) && (
                          <button
                            disabled={busy || !setup.publishingEnabled}
                            title={
                              !setup.publishingEnabled
                                ? "O agendador ainda não foi ativado"
                                : "Aprovar e definir horário"
                            }
                            onClick={() => {
                              setSchedule(p);
                              setScheduleTime(
                                p.scheduledAt
                                  ? `${dayKey(p.scheduledAt)}T${clock(p.scheduledAt)}`
                                  : "",
                              );
                            }}
                          >
                            Aprovar e agendar
                          </button>
                        )}
                      {editable &&
                        !p.publishStartedAt &&
                        [
                          "DRAFT",
                          "PENDING_APPROVAL",
                          "FAILED",
                          "SCHEDULED",
                        ].includes(p.status) && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm("Cancelar esta publicação?"))
                                void act(async () => {
                                  await api(
                                    `/api/social/posts/${p.id}`,
                                    mutation(
                                      { clientId, action: "cancel" },
                                      "PATCH",
                                    ),
                                  );
                                  await load();
                                });
                            }}
                          >
                            Cancelar
                          </button>
                        )}
                    </div>
                  </article>
                ))
              )}
              {posts.length < total && (
                <button disabled={loading} onClick={() => void load(true)}>
                  Carregar próximas ({posts.length} de {total})
                </button>
              )}
              {!setup.publishingEnabled && (
                <p className={styles.help}>
                  O envio automático aguarda a configuração da Meta e a ativação
                  do agendador. Você pode preparar rascunhos.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        className={styles.dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setComposer(false);
        }}
      >
        <div className={styles.sectionHeading}>
          <h2>
            {viewOnly
              ? "Conteúdo da publicação"
              : editingId
                ? "Editar publicação"
                : "Nova publicação"}
          </h2>
          <button
            aria-label="Fechar editor"
            disabled={busy}
            onClick={() => setComposer(false)}
          >
            <X size={18} />
          </button>
        </div>
        <p>
          {clients.find((c) => c.id === clientId)?.name} · prepare e envie para
          aprovação.
        </p>
        <fieldset disabled={busy || viewOnly}>
          <legend>Publicar nas contas</legend>
          {editorAccounts.length ? (
            editorAccounts.map((a) => (
              <label className={styles.check} key={a.id}>
                <input
                  type="checkbox"
                  disabled={!!editingId}
                  checked={targets.includes(a.id)}
                  onChange={(e) =>
                    setTargets((old) =>
                      e.target.checked
                        ? [...old, a.id]
                        : old.filter((id) => id !== a.id),
                    )
                  }
                />
                {a.provider === "INSTAGRAM" ? "Instagram" : "Facebook"} ·{" "}
                {a.name}
              </label>
            ))
          ) : (
            <p>Conecte uma conta deste cliente primeiro.</p>
          )}
        </fieldset>
        <label>
          Formato
          <select
            value={format}
            disabled={busy || viewOnly}
            onChange={(e) => setFormat(e.target.value)}
          >
            {Object.entries(formats).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Legenda
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={
              targets.some(
                (id) =>
                  accounts.find((a) => a.id === id)?.provider === "INSTAGRAM",
              )
                ? 2200
                : 5000
            }
            rows={5}
            disabled={busy || viewOnly}
          />
        </label>
        <label>
          Imagens ou vídeo
          <input
            type="file"
            accept="image/jpeg,video/mp4"
            multiple={format === "CAROUSEL"}
            disabled={busy || viewOnly}
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className={styles.help}>
          JPEG até 8 MB. MP4 até {setup.videoLimitMB} MB; para Reels e Stories,
          prefira vídeo vertical 9:16. Carrosséis: 2 a 10 imagens. Em Stories,
          textos e trilha sonora precisam estar no próprio arquivo; a legenda
          não é adicionada ao Story.
        </p>
        {setup.mediaRetentionHours && (
          <p className={styles.help}>
            Os arquivos são removidos {setup.mediaRetentionHours} horas após a
            confirmação de todas as publicações que os utilizam. Rascunhos e
            envios com falha são preservados.
          </p>
        )}
        {uploadProgress && (
          <p role="status" className={styles.help}>
            {uploadProgress}
          </p>
        )}
        <div className={styles.previews}>
          {assets
            .filter((a) => a.previewUrl)
            .map((a) => (
              <figure key={a.id}>
                {a.mime === "image/jpeg" ? (
                  <img src={a.previewUrl!} alt={a.name} />
                ) : (
                  <video
                    src={a.previewUrl!}
                    controls
                    preload="metadata"
                    aria-label={a.name}
                  />
                )}
                <figcaption>{a.name}</figcaption>
              </figure>
            ))}
        </div>
        {assets.map((a, i) => (
          <div key={a.id} className={styles.asset}>
            <span>
              {i + 1}. {a.name} · {(a.bytes / 1024 / 1024).toFixed(1)} MB
              {viewOnly &&
                !a.previewUrl &&
                " · Arquivo removido; histórico preservado"}
            </span>
            {!viewOnly && (
              <button
                disabled={busy}
                onClick={() =>
                  setAssets((old) => old.filter((x) => x.id !== a.id))
                }
                aria-label={`Remover ${a.name} da publicação`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <label>
          Horário sugerido (Brasília)
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            disabled={busy || viewOnly}
          />
        </label>
        {error && (
          <p role="alert" className={styles.errorText}>
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          {viewOnly ? (
            <button onClick={() => setComposer(false)}>Fechar</button>
          ) : (
            <>
              <button
                disabled={busy || !targets.length || viewOnly}
                onClick={() => void save("DRAFT")}
              >
                Salvar rascunho
              </button>
              <button
                className={styles.primary}
                disabled={busy || !targets.length || viewOnly}
                onClick={() => void save("PENDING_APPROVAL")}
              >
                {busy ? "Aguarde…" : "Enviar para aprovação"}
              </button>
            </>
          )}
        </div>
      </dialog>
      <dialog
        ref={scheduleDialog}
        className={styles.dialog}
        onCancel={() => setSchedule(null)}
      >
        <h2>Aprovar e agendar</h2>
        <p>
          {schedule?.account.name} · {schedule && formats[schedule.format]}
        </p>
        <label>
          Publicar em (horário de Brasília)
          <input
            type="datetime-local"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
          />
        </label>
        <p className={styles.help}>
          Ao confirmar, você autoriza a publicação automática deste conteúdo na
          conta indicada.
        </p>
        {error && <p className={styles.errorText}>{error}</p>}
        <div className={styles.dialogActions}>
          <button disabled={busy} onClick={() => setSchedule(null)}>
            Voltar
          </button>
          <button
            className={styles.primary}
            disabled={busy || !scheduleTime}
            onClick={() =>
              void act(async () => {
                await api(
                  `/api/social/posts/${schedule!.id}`,
                  mutation(
                    {
                      clientId,
                      action: "schedule",
                      scheduledAt: new Date(
                        `${scheduleTime}:00-03:00`,
                      ).toISOString(),
                    },
                    "PATCH",
                  ),
                );
                setSchedule(null);
                setNotice("Publicação aprovada e agendada.");
                await load();
              })
            }
          >
            Confirmar agendamento
          </button>
        </div>
      </dialog>
    </section>
  );
}
