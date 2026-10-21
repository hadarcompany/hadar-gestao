"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Plus,
  Repeat2,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { canEdit, canView } from "@/lib/permissions";
import Composer from "@/components/social/Composer";
import Reports from "@/components/social/Reports";
import {
  api,
  mutation,
  dayKey,
  clock,
  localStamp,
  formats,
  states,
  type Account,
  type Post,
  type Detail,
} from "@/components/social/shared";
import { weekNames } from "@/components/social/Dates";
import s from "./social.module.css";
type Series = {
  id: string;
  caption: string;
  format: string;
  weekdays: number[];
  time: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
  approvedAt: string | null;
  account: { name: string; provider: string };
};
export default function PublicationsPage() {
  const { user } = useAuth(),
    admin = user?.role === "ADMIN",
    editable = !!user && canEdit(user, "publicacoes"),
    permitted = !!user && canView(user, "publicacoes");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]),
    [clientId, setClientId] = useState(""),
    [accounts, setAccounts] = useState<Account[]>([]),
    [posts, setPosts] = useState<Post[]>([]),
    [events, setEvents] = useState<Post[]>([]),
    [total, setTotal] = useState(0),
    [calendarTotal, setCalendarTotal] = useState(0),
    [truncated, setTruncated] = useState(false);
  const [month, setMonth] = useState(() => dayKey(new Date()).slice(0, 7)),
    [day, setDay] = useState(""),
    [status, setStatus] = useState("ALL"),
    [provider, setProvider] = useState("ALL"),
    [format, setFormat] = useState("ALL"),
    [tab, setTab] = useState("calendar"),
    [series, setSeries] = useState<Series[]>([]);
  const [setup, setSetup] = useState({
      instagram: false,
      facebook: false,
      publishingEnabled: false,
      videoLimitMB: 200,
      mediaRetentionHours: 48,
    }),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{
      clientId: string;
      accounts: Account[];
      detail?: Detail;
      viewOnly?: boolean;
      copy?: boolean;
    } | null>(null),
    [schedule, setSchedule] = useState<Post | null>(null),
    [scheduleTime, setScheduleTime] = useState("");
  const [selection, setSelection] = useState<{
      session: string;
      pages: { id: string; name: string }[];
    } | null>(null),
    [selectedPages, setSelectedPages] = useState<string[]>([]);
  const gen = useRef(0),
    scheduleDialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(
    async (append = false) => {
      if (!clientId || !permitted) return;
      const version = ++gen.current;
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams({
            clientId,
            month,
            status,
            provider,
            format,
          }),
          page = append ? Math.floor(posts.length / 50) : 0;
        const [list, calendar, connected, config, repeats] = await Promise.all([
          api(`/api/social/posts?${q}&page=${page}${day ? `&day=${day}` : ""}`),
          api(`/api/social/calendar?${q}`),
          clientId === "all"
            ? Promise.resolve([])
            : api(`/api/social/accounts?clientId=${clientId}`),
          api("/api/social/setup"),
          clientId === "all"
            ? Promise.resolve([])
            : api(`/api/social/series?clientId=${clientId}`),
        ]);
        if (version !== gen.current) return;
        setPosts((old) => (append ? [...old, ...list.posts] : list.posts));
        setTotal(list.total);
        setEvents(calendar.posts);
        setCalendarTotal(calendar.total);
        setTruncated(calendar.truncated);
        setAccounts(connected);
        setSetup(config);
        setSeries(repeats);
      } catch (e) {
        if (version === gen.current) setError((e as Error).message);
      } finally {
        if (version === gen.current) setLoading(false);
      }
    },
    [clientId, month, status, provider, format, day, permitted, posts.length],
  );
  useEffect(() => {
    setPosts([]);
    void load();
    return () => {
      gen.current++;
    };
  }, [clientId, month, status, provider, format, day, permitted]); // eslint-disable-line react-hooks/exhaustive-deps
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
        const q = new URLSearchParams(window.location.search),
          chosen = q.get("clientId");
        setClientId(
          chosen && rows.some((c: { id: string }) => c.id === chosen)
            ? chosen
            : "all",
        );
        const result = q.get("social");
        if (result === "connected")
          setNotice("Conta conectada. Você pode preparar uma publicação.");
        else if (result === "select_pages" && q.get("session")) {
          const session = q.get("session")!;
          void api(
            `/api/social/selection?session=${encodeURIComponent(session)}`,
          )
            .then((data) => setSelection({ session, pages: data.pages }))
            .catch((e) => setError(e.message));
        } else if (result)
          setError(
            (
              {
                cancelled:
                  "Autorização cancelada. A conexão anterior foi preservada.",
                no_pages:
                  "Nenhuma página com permissão de publicação foi autorizada.",
                invalid_state:
                  "A conexão venceu. Clique em conectar novamente.",
                account_in_use: "Esta conta já está vinculada a outro cliente.",
              } as Record<string, string>
            )[result] ||
              "A conexão não foi concluída. Confira a configuração e as permissões na Meta.",
          );
        if (result)
          window.history.replaceState(
            null,
            "",
            `/publicacoes${chosen ? `?clientId=${chosen}` : ""}`,
          );
      })
      .catch((e) => setError(e.message));
  }, [permitted]);
  useEffect(() => {
    if (schedule) scheduleDialog.current?.showModal();
    else scheduleDialog.current?.close();
  }, [schedule]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect(p: Account["provider"], extended = false) {
    const target = window.open("about:blank", "_blank");
    if (!target) {
      setError("Permita abrir a aba de autorização da rede social.");
      return;
    }
    target.opener = null;
    await act(async () => {
      try {
        const result = await api(
          "/api/social/connect",
          mutation({ clientId, provider: p, extended }),
        );
        target.location.href = result.url;
      } catch (e) {
        target.close();
        throw e;
      }
    });
  }
  async function open(post: Post, viewOnly: boolean, copy = false) {
    await act(async () => {
      const [detail, connected] = await Promise.all([
        api(`/api/social/posts/${post.id}?clientId=${post.clientId}`),
        api(`/api/social/accounts?clientId=${post.clientId}`),
      ]);
      setEditor({
        clientId: post.clientId,
        accounts: connected,
        detail,
        viewOnly,
        copy,
      });
    });
  }
  function moveMonth(n: number) {
    const d = new Date(`${month}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
    setDay("");
  }
  const current = new Date(`${month}-01T12:00:00Z`),
    count = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
    ).getUTCDate(),
    offset = (current.getUTCDay() + 6) % 7,
    clientName =
      clients.find((c) => c.id === clientId)?.name || "Todos os clientes";
  const connected = accounts.filter(
    (a) =>
      a.status === "CONNECTED" &&
      (!a.tokenExpiresAt || new Date(a.tokenExpiresAt) > new Date()),
  );
  if (!permitted)
    return (
      <section className={s.scope}>
        <h1>Publicações</h1>
        <p>
          Seu usuário não tem acesso a este módulo. Peça a liberação ao
          administrador.
        </p>
      </section>
    );
  return (
    <section className={s.scope} data-ui>
      <div className={s.heading}>
        <div>
          <h1>Publicações</h1>
          <p>Conteúdo, perfis e programação dos seus clientes.</p>
        </div>
        <button
          className={s.primary}
          disabled={
            !clientId || clientId === "all" || !editable || busy || loading
          }
          title={
            clientId === "all"
              ? "Selecione um cliente para criar uma publicação"
              : undefined
          }
          onClick={() => setEditor({ clientId, accounts })}
        >
          <Plus size={16} /> Nova publicação
        </button>
      </div>
      <div className={s.toolbar}>
        <label>
          Cliente
          <select
            value={clientId}
            disabled={busy}
            onChange={(e) => {
              setClientId(e.target.value);
              setDay("");
              window.history.replaceState(
                null,
                "",
                `/publicacoes?clientId=${e.target.value}`,
              );
            }}
          >
            <option value="">Carregando clientes…</option>
            <option value="all">Todos os clientes</option>
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
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className={s.notice}>
          {notice}
        </div>
      )}
      {clientId === "all" && (
        <p className={s.help}>
          Selecione um cliente para criar conteúdo ou conectar suas redes. O
          calendário reúne os clientes da sua agência.
        </p>
      )}
      {clientId && clientId !== "all" && (
        <details className={s.accounts} open={!connected.length}>
          <summary>Contas e conexões · {connected.length} conectada(s)</summary>
          <div className={s.sectionHeading}>
            <p className={s.help}>
              A autorização acontece diretamente no Instagram ou Facebook.
            </p>
            {admin && (
              <div className={s.actions}>
                <button
                  disabled={busy || !setup.instagram}
                  onClick={() => void connect("INSTAGRAM")}
                >
                  <Instagram size={16} />
                  Conectar Instagram
                </button>
                <button
                  disabled={busy || !setup.facebook}
                  onClick={() => void connect("FACEBOOK")}
                >
                  <Facebook size={16} />
                  Conectar Facebook
                </button>
              </div>
            )}
          </div>
          {accounts.map((a) => (
            <div className={s.account} key={a.id}>
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
                        `Desconectar ${a.name}? As repetições serão pausadas e os agendamentos pendentes serão cancelados.`,
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
          ))}
          {!accounts.length && (
            <p className={s.empty}>Nenhuma conta conectada.</p>
          )}
        </details>
      )}
      {selection && (
        <section className={s.accounts}>
          <h2>Selecione as páginas deste cliente</h2>
          {selection.pages.map((page) => (
            <label key={page.id} className={s.check}>
              <input
                type="checkbox"
                checked={selectedPages.includes(page.id)}
                onChange={(e) =>
                  setSelectedPages((old) =>
                    e.target.checked
                      ? [...old, page.id]
                      : old.filter((id) => id !== page.id),
                  )
                }
              />
              {page.name}
            </label>
          ))}
          <button
            className={s.primary}
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
                await load();
              })
            }
          >
            Conectar páginas selecionadas
          </button>
        </section>
      )}
      <nav className={s.tabs} aria-label="Visualização de publicações">
        {[
          ["calendar", "Calendário"],
          ["series", "Repetições"],
          ["reports", "Relatórios"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? s.activeTab : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "calendar" && (
        <>
          <div className={`${s.toolbar} ${s.filters}`}>
            <label>
              Situação
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ALL">Todas</option>
                {Object.entries(states).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rede
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="ALL">Todas</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="FACEBOOK">Facebook</option>
              </select>
            </label>
            <label>
              Canal
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="POST">Post e carrossel</option>
                <option value="REEL">Reels</option>
                <option value="STORY">Stories</option>
              </select>
            </label>
          </div>
          <section className={s.calendar} aria-busy={loading}>
            <div className={s.sectionHeading}>
              <div>
                <h2>
                  {current.toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </h2>
                <p>
                  {calendarTotal} publicações no mês · {clientName}
                </p>
              </div>
              <div className={s.actions}>
                <button aria-label="Mês anterior" onClick={() => moveMonth(-1)}>
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => {
                    setMonth(dayKey(new Date()).slice(0, 7));
                    setDay(dayKey(new Date()));
                  }}
                >
                  Hoje
                </button>
                <button aria-label="Próximo mês" onClick={() => moveMonth(1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            {truncated && (
              <p role="status" className={s.notice}>
                O mês tem mais de 2.000 publicações. Refine os filtros para
                visualizar todos os eventos.
              </p>
            )}
            {loading && (
              <p role="status" className={s.help}>
                Atualizando calendário…
              </p>
            )}
            <div className={s.calendarScroll}>
              <div className={s.fullCalendar}>
                <div className={s.weekdays}>
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(
                    (name) => (
                      <span key={name}>{name}</span>
                    ),
                  )}
                </div>
                <div className={s.days}>
                  {Array.from({ length: offset }, (_, i) => (
                    <div key={`blank${i}`} className={s.outside} />
                  ))}
                  {Array.from({ length: count }, (_, i) => {
                    const key = month + "-" + String(i + 1).padStart(2, "0"),
                      items = events.filter(
                        (p) => dayKey(p.scheduledAt || p.createdAt) === key,
                      );
                    return (
                      <div
                        key={key}
                        className={`${s.calendarCell} ${day === key ? s.selected : ""}`}
                      >
                        <button
                          className={s.dayNumber}
                          aria-label={`Ver publicações de ${key.split("-").reverse().join("/")}`}
                          aria-pressed={day === key}
                          onClick={() => setDay(day === key ? "" : key)}
                        >
                          <span
                            className={
                              key === dayKey(new Date()) ? s.today : ""
                            }
                          >
                            {i + 1}
                          </span>
                          <small>{items.length || ""}</small>
                        </button>
                        {items.slice(0, 5).map((post) => (
                          <button
                            key={post.id}
                            className={`${s.event} ${["FAILED", "UNCERTAIN"].includes(post.status) ? s.eventBad : post.status === "PUBLISHED" ? s.eventPublished : s.eventPending}`}
                            title={`${post.client.name} · ${formats[post.format]} · ${states[post.status]} · ${post.caption || "Sem legenda"}`}
                            onClick={() => void open(post, true)}
                            disabled={busy}
                          >
                            {post.account.provider === "INSTAGRAM" ? (
                              <Instagram size={12} />
                            ) : (
                              <Facebook size={12} />
                            )}
                            <span>
                              {clientId === "all"
                                ? post.client.name
                                : post.account.name}
                            </span>
                            <b>
                              {post.scheduledAt
                                ? clock(post.scheduledAt)
                                : "Rasc."}
                            </b>
                            <small>
                              {post.format === "STORY"
                                ? "S"
                                : post.format === "REEL"
                                  ? "R"
                                  : "P"}
                            </small>
                          </button>
                        ))}
                        {items.length > 5 && (
                          <button
                            className={s.moreEvents}
                            onClick={() => setDay(key)}
                          >
                            +{items.length - 5} publicações
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className={s.help}>
              P · Post/carrossel &nbsp; R · Reels &nbsp; S · Stories. Selecione
              um dia para ver a lista completa abaixo.
            </p>
          </section>
          <section className={s.queue} aria-busy={loading}>
            <div className={s.sectionHeading}>
              <h2>
                {day
                  ? `Publicações de ${day.split("-").reverse().join("/")}`
                  : "Publicações do mês"}{" "}
                <span className={s.help}>({total})</span>
              </h2>
              {day && <button onClick={() => setDay("")}>Todos os dias</button>}
            </div>
            {!posts.length && !loading && (
              <div className={s.empty}>
                <Calendar size={24} />
                <p>Nenhuma publicação com estes filtros.</p>
                <p>Selecione um cliente e prepare seu primeiro conteúdo.</p>
              </div>
            )}
            {posts.map((post) => (
              <article className={s.post} key={post.id}>
                <div className={s.postHeading}>
                  <strong>
                    {clientId === "all" ? post.client.name + " · " : ""}
                    {post.account.name}
                  </strong>
                  <span
                    className={`${s.badge} ${["FAILED", "UNCERTAIN"].includes(post.status) ? s.bad : ""}`}
                  >
                    {states[post.status]}
                  </span>
                </div>
                <p>{post.caption || `${formats[post.format]} sem legenda`}</p>
                <div className={s.meta}>
                  {post.account.provider === "INSTAGRAM"
                    ? "Instagram"
                    : "Facebook"}{" "}
                  · {formats[post.format]} ·{" "}
                  {post.scheduledAt
                    ? new Date(post.scheduledAt).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "Sem data"}{" "}
                  {post.seriesId && <span>· Repetição semanal</span>}
                </div>
                {post.lastError && (
                  <p className={s.errorText}>{post.lastError}</p>
                )}
                {post.afterPublishError && (
                  <p className={s.errorText}>{post.afterPublishError}</p>
                )}
                <div className={s.actions}>
                  <button disabled={busy} onClick={() => void open(post, true)}>
                    Ver conteúdo
                  </button>
                  {editable && (
                    <button
                      disabled={busy}
                      onClick={() => void open(post, false, true)}
                    >
                      Usar como nova
                    </button>
                  )}
                  {editable &&
                    ![
                      "PROCESSING",
                      "PUBLISHED",
                      "UNCERTAIN",
                      "CANCELLED",
                    ].includes(post.status) &&
                    !post.publishStartedAt && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => void open(post, false)}
                        >
                          Editar
                        </button>
                        {admin && (
                          <button
                            disabled={busy || !setup.publishingEnabled}
                            title={
                              !setup.publishingEnabled
                                ? "O agendador ainda não foi ativado"
                                : undefined
                            }
                            onClick={() => {
                              setSchedule(post);
                              setScheduleTime(
                                post.scheduledAt
                                  ? localStamp(post.scheduledAt)
                                  : "",
                              );
                            }}
                          >
                            Aprovar e agendar
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Cancelar somente esta publicação? O histórico será preservado. Uma repetição semanal continua ativa até ser pausada.",
                              )
                            )
                              void act(async () => {
                                await api(
                                  `/api/social/posts/${post.id}`,
                                  mutation(
                                    {
                                      clientId: post.clientId,
                                      action: "cancel",
                                    },
                                    "PATCH",
                                  ),
                                );
                                await load();
                              });
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                </div>
              </article>
            ))}
            {posts.length < total && (
              <button disabled={loading} onClick={() => void load(true)}>
                Carregar mais publicações
              </button>
            )}
            {!setup.publishingEnabled && (
              <p className={s.help}>
                O agendador automático ainda está desativado. Você pode preparar
                rascunhos e enviar conteúdo para aprovação.
              </p>
            )}
          </section>
        </>
      )}
      {tab === "series" && (
        <section className={s.queue}>
          <div className={s.sectionHeading}>
            <h2>Repetições semanais</h2>
            <Repeat2 size={20} />
          </div>
          <p className={s.help}>
            Cada ocorrência pode ser editada separadamente. Pausar cancela as
            ocorrências pendentes; publicações já em processamento precisam de
            conferência.
          </p>
          {clientId === "all" ? (
            <p className={s.empty}>
              Selecione um cliente para gerenciar suas repetições.
            </p>
          ) : !series.length ? (
            <p className={s.empty}>
              Nenhuma repetição. Em Nova publicação, escolha “Repetir toda
              semana”.
            </p>
          ) : (
            series.map((item) => (
              <article className={s.post} key={item.id}>
                <div className={s.postHeading}>
                  <strong>
                    {item.account.name} · {formats[item.format]}
                  </strong>
                  <span className={s.badge}>
                    {!item.active
                      ? item.endDate && item.endDate < dayKey(new Date())
                        ? "Encerrada"
                        : "Pausada"
                      : item.approvedAt
                        ? "Aprovada"
                        : "Aguardando aprovação"}
                  </span>
                </div>
                <p>{item.caption || `${formats[item.format]} sem legenda`}</p>
                <p className={s.meta}>
                  {[...item.weekdays]
                    .sort()
                    .map((d) => weekNames[d])
                    .join(", ")}{" "}
                  às {item.time} · desde{" "}
                  {item.startDate.split("-").reverse().join("/")} ·{" "}
                  {item.endDate
                    ? `até ${item.endDate.split("-").reverse().join("/")}`
                    : "sem data final"}
                </p>
                {admin && item.active && (
                  <div className={s.actions}>
                    {!item.approvedAt && (
                      <button
                        disabled={busy || !setup.publishingEnabled}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Aprovar esta repetição e suas próximas ocorrências? As publicações continuarão até a data final ou até você pausar.",
                            )
                          )
                            void act(async () => {
                              await api(
                                "/api/social/series",
                                mutation(
                                  { clientId, id: item.id, action: "approve" },
                                  "PATCH",
                                ),
                              );
                              await load();
                            });
                        }}
                      >
                        Aprovar repetição
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Pausar esta repetição e cancelar suas ocorrências pendentes? Para reiniciar, crie uma nova repetição para revisão.",
                          )
                        )
                          void act(async () => {
                            await api(
                              "/api/social/series",
                              mutation(
                                { clientId, id: item.id, action: "pause" },
                                "PATCH",
                              ),
                            );
                            await load();
                          });
                      }}
                    >
                      Pausar repetição
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      )}
      {tab === "reports" && clientId && (
        <Reports
          key={clientId}
          clientId={clientId}
          clientName={clientName}
          admin={admin}
          onAuthorize={() => void connect("INSTAGRAM", true)}
        />
      )}
      {editor && (
        <Composer
          key={
            (editor.copy ? "copy:" : "") +
            (editor.detail?.id || editor.clientId)
          }
          clientId={editor.clientId}
          clientName={
            clients.find((c) => c.id === editor.clientId)?.name || "Cliente"
          }
          accounts={editor.accounts}
          detail={editor.detail}
          copy={editor.copy}
          viewOnly={editor.viewOnly}
          videoLimit={setup.videoLimitMB}
          enabled={setup.publishingEnabled}
          admin={admin}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setNotice(
              "Conteúdo salvo. Confira os canais, as datas e a situação no calendário.",
            );
            void load();
          }}
        />
      )}
      <dialog
        ref={scheduleDialog}
        className={s.dialog}
        aria-labelledby="schedule-title"
        onCancel={() => setSchedule(null)}
      >
        <div className={s.sectionHeading}>
          <h2 id="schedule-title">Aprovar publicação</h2>
          <button
            aria-label="Fechar aprovação"
            disabled={busy}
            onClick={() => setSchedule(null)}
          >
            <X size={18} />
          </button>
        </div>
        <p>
          {schedule?.account.name} · {schedule ? formats[schedule.format] : ""}
        </p>
        <p>{schedule?.caption || "Sem legenda"}</p>
        {error && (
          <div role="alert" className={s.error}>
            {error}
          </div>
        )}
        <label>
          Data e horário · Brasília
          <input
            type="datetime-local"
            value={scheduleTime}
            onInput={(e) => setScheduleTime(e.currentTarget.value)}
            onChange={(e) => setScheduleTime(e.target.value)}
          />
        </label>
        <div className={s.dialogActions}>
          <button disabled={busy} onClick={() => setSchedule(null)}>
            Voltar
          </button>
          <button
            className={s.primary}
            disabled={busy || !scheduleTime}
            onClick={() =>
              void act(async () => {
                await api(
                  `/api/social/posts/${schedule!.id}`,
                  mutation(
                    {
                      clientId: schedule!.clientId,
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
            Aprovar e agendar
          </button>
        </div>
      </dialog>
    </section>
  );
}
