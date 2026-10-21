"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { api, dayKey, states } from "./shared";
import {
  ratio,
  csvCell,
  type AccountReport,
  type MediaReport,
} from "@/lib/social/analytics-data";
import {
  Metrics,
  Followers,
  Demographics,
  MediaDetails,
  TimeTable,
} from "./ReportDetails";
import s from "@/app/(authenticated)/publicacoes/social.module.css";
type Tab =
  | "summary"
  | "followers"
  | "demographics"
  | "STORY"
  | "REEL"
  | "POST"
  | "times"
  | "competitors";
const tabs: [Tab, string][] = [
  ["summary", "Resumo geral"],
  ["followers", "Seguidores"],
  ["demographics", "Demográfico"],
  ["STORY", "Stories"],
  ["REEL", "Reels"],
  ["POST", "Posts"],
  ["times", "Melhores horários"],
  ["competitors", "Concorrentes"],
];
type Data = {
  reports: AccountReport[];
  editorial: { status: string; _count: { _all: number } }[];
  start: string;
  end: string;
};
const mediaFields: (keyof MediaReport)[] = [
  "caption",
  "timestamp",
  "channel",
  "likes",
  "comments",
  "saved",
  "shares",
  "reach",
  "views",
  "interactions",
  "follows",
  "profileVisits",
  "profileActivity",
  "replies",
  "exits",
  "back",
  "forward",
  "next",
  "navigation",
  "fetchedAt",
  "permalink",
];
export default function Reports({
  clientId,
  clientName,
  onAuthorize,
  admin,
}: {
  clientId: string;
  clientName: string;
  onAuthorize: () => void;
  admin: boolean;
}) {
  const [start, setStart] = useState(
      dayKey(new Date(Date.now() - 27 * 86400000)),
    ),
    [end, setEnd] = useState(dayKey(new Date()));
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState<Tab>("summary");
  const [printAll, setPrintAll] = useState(false),
    requestId = useRef(0);
  useEffect(() => {
    requestId.current++;
    setData(null);
    setLoading(false);
    setError("");
  }, [clientId]);
  useEffect(() => {
    const done = () => setPrintAll(false);
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);
  async function load() {
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const next = await api(
        `/api/social/reports?${new URLSearchParams({ clientId, start, end })}`,
      );
      if (request === requestId.current) setData(next);
    } catch (e) {
      if (request === requestId.current) setError((e as Error).message);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }
  function change(which: "start" | "end", value: string) {
    requestId.current++;
    setData(null);
    setLoading(false);
    which === "start" ? setStart(value) : setEnd(value);
  }
  function download() {
    if (!data) return;
    const rows: unknown[][] = [
      ["Cliente", clientName],
      ["Período", start, end],
      [
        "Métricas de conta: totais do período. Métricas de mídias: acumuladas até a última coleta. Dados ausentes ficam vazios.",
      ],
    ];
    for (const r of data.reports) {
      rows.push(
        ["Perfil", r.name, r.provider],
        ["Atualizado em", r.fetchedAt],
        [
          "Seguidores atuais",
          "Alcance",
          "Contas engajadas",
          "Taxa de engajamento (%)",
          "Visualizações",
          "Frequência (views/alcance)",
          "Interações",
          "Curtidas",
          "Comentários",
          "Compartilhamentos",
          "Salvos",
          "Cliques/toques no perfil",
          "Novos seguidores",
          "Deixaram de seguir",
        ],
      );
      rows.push([
        r.followers,
        r.reach,
        r.engaged,
        ratio(r.engaged, r.reach, 100),
        r.views,
        ratio(r.views, r.reach),
        r.interactions,
        r.likes,
        r.comments,
        r.shares,
        r.saves,
        r.linkTaps,
        r.follows,
        r.unfollows,
      ]);
      rows.push([
        "Data",
        "Seguidores coletados",
        "Novos seguidores",
        "Deixaram de seguir",
      ]);
      for (const d of r.daily)
        rows.push([d.day, d.followers, d.follows, d.unfollows]);
      rows.push(
        [
          "Demografia: últimos 30 dias na data da consulta, independentemente das datas do relatório",
        ],
        ["Dimensão", "Faixa/local", "Gênero", "Contagem"],
      );
      for (const [dimension, values] of Object.entries(r.demographics))
        for (const b of values)
          rows.push([dimension, b.label, b.gender, b.value]);
      rows.push([
        "Publicação",
        "Data",
        "Canal",
        "Curtidas",
        "Comentários",
        "Salvos",
        "Compartilhamentos",
        "Alcance",
        "Visualizações",
        "Interações",
        "Novos seguidores",
        "Visitas no perfil",
        "Ações no perfil",
        "Respostas",
        "Saídas",
        "Voltar",
        "Avançar",
        "Próximo Story",
        "Navegação",
        "Coletado em",
        "Link",
      ]);
      for (const m of r.media) rows.push(mediaFields.map((k) => m[k]));
      rows.push(
        ["Início da coleta", r.collection.startedAt],
        ["Última coleta", r.collection.lastCollectedAt],
        ["Avisos", r.warning, r.insightsWarning, r.collection.warning],
      );
    }
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${start}-${end}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function print() {
    setPrintAll(true);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }
  if (clientId === "all")
    return (
      <p className={s.empty}>
        Selecione um cliente para consultar o relatório de suas contas.
      </p>
    );
  return (
    <section className={s.report} data-social-report>
      <div className={s.sectionHeading}>
        <div>
          <h2>Relatório · {clientName}</h2>
          <p className={s.help}>
            Desempenho do perfil, público e conteúdo, com dados fornecidos pela
            Meta.
          </p>
        </div>
        <div className={s.actions}>
          <button disabled={!data || loading} onClick={download}>
            <Download size={16} /> Exportar CSV
          </button>
          <button disabled={!data || loading} onClick={print}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>
      <div className={s.toolbar}>
        <label>
          De
          <input
            type="date"
            value={start}
            disabled={loading}
            max={end}
            onInput={(e) => change("start", e.currentTarget.value)}
            onChange={(e) => change("start", e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={end}
            disabled={loading}
            min={start}
            max={dayKey(new Date())}
            onInput={(e) => change("end", e.currentTarget.value)}
            onChange={(e) => change("end", e.target.value)}
          />
        </label>
        <button
          className={s.primary}
          disabled={loading || !start || !end}
          onClick={() => void load()}
        >
          {loading ? "Consultando a Meta…" : "Gerar relatório"}
        </button>
      </div>
      <p className={s.help}>
        Até 30 dias por consulta; cache de 30 minutos. Dados da Meta podem
        atrasar até 48 horas. Seguidores atuais e demografia usam as janelas
        indicadas nas respectivas seções.
      </p>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      <div className={s.reportTabs} aria-label="Seções do relatório">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {!data && !loading && (
        <p className={s.empty}>
          Escolha as datas e gere o relatório. As seções serão preenchidas com
          os dados disponíveis da conta conectada.
        </p>
      )}
      {loading && (
        <p role="status" className={s.empty}>
          Consultando métricas, público e histórico coletado…
        </p>
      )}
      {data?.editorial.length ? (
        <div
          className={s.editorialStats}
          aria-label="Publicações do Gestão no período"
        >
          {data.editorial.map((item) => (
            <span key={item.status}>
              <strong>{item._count._all}</strong>{" "}
              {states[item.status] || item.status}
            </span>
          ))}
        </div>
      ) : null}
      {data?.reports.length === 0 && (
        <p className={s.empty}>Nenhuma conta conectada para este cliente.</p>
      )}
      {data?.reports.map((r) => (
        <article className={s.reportAccount} key={r.id}>
          <div className={s.sectionHeading}>
            <h2>
              @{r.name} ·{" "}
              {r.provider === "INSTAGRAM" ? "Instagram" : "Facebook"}
            </h2>
            <span className={s.help}>
              Atualizado em{" "}
              {new Date(r.fetchedAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </span>
          </div>
          {r.warning && (
            <p role="status" className={s.error}>
              {r.warning}
            </p>
          )}
          {r.insightsWarning && (
            <div className={s.permissionNote}>
              <p>{r.insightsWarning}</p>
              {admin && r.provider === "INSTAGRAM" && (
                <button onClick={onAuthorize}>
                  Autorizar relatórios e comentários
                </button>
              )}
            </div>
          )}
          {r.partial && (
            <p className={s.notice}>
              Mais de 1.000 mídias neste período. O relatório de conteúdo é
              parcial; reduza o intervalo.
            </p>
          )}
          {(tab === "summary" || printAll) && (
            <section>
              <h3>Resumo geral do perfil</h3>
              <Metrics
                items={[
                  ["Alcance no período", r.reach],
                  ["Contas engajadas", r.engaged],
                  ["Taxa de engajamento", ratio(r.engaged, r.reach, 100), "%"],
                  [
                    "Frequência de visualização",
                    ratio(r.views, r.reach),
                    "por conta",
                  ],
                  ["Visualizações", r.views],
                  ["Interações", r.interactions],
                  ["Curtidas", r.likes],
                  ["Comentários", r.comments],
                  ["Compartilhamentos", r.shares],
                  ["Salvos", r.saves],
                  ["Toques em links e botões do perfil", r.linkTaps],
                  ["Seguidores atuais", r.followers],
                ]}
              />
              <p className={s.help}>
                Taxa de engajamento = contas engajadas ÷ alcance × 100.
                Frequência = visualizações ÷ alcance. Os totais de conta podem
                incluir anúncios e conteúdo fora do período de publicação; não
                equivalem à soma dos rankings de mídias.
              </p>
              <div className={s.reportCoverage}>
                <h4>Histórico e cobertura da coleta</h4>
                <p>
                  Início:{" "}
                  {r.collection.startedAt
                    ? new Date(r.collection.startedAt).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })
                    : "Aguardando primeiro ciclo"}
                  . Último ciclo:{" "}
                  {r.collection.lastCollectedAt
                    ? new Date(r.collection.lastCollectedAt).toLocaleString(
                        "pt-BR",
                        { timeZone: "America/Sao_Paulo" },
                      )
                    : "Ainda não concluído"}
                  .
                </p>
                <p>
                  Coleta automática a cada 15 minutos por conta, em lotes.
                  Stories anteriores à coleta não são reconstruídos. Miniaturas
                  podem expirar na Meta; as métricas já coletadas permanecem no
                  histórico.
                </p>
                {r.collection.warning && (
                  <p role="status">{r.collection.warning}</p>
                )}
              </div>
            </section>
          )}
          {(tab === "followers" || printAll) && <Followers report={r} />}
          {(tab === "demographics" || printAll) && <Demographics report={r} />}
          {(["STORY", "REEL", "POST"] as const)
            .filter((c) => tab === c || printAll)
            .map((c) => (
              <MediaDetails key={c} report={r} channel={c} />
            ))}
          {(tab === "times" || printAll) && (
            <TimeTable rows={r.media.filter((m) => m.channel !== "STORY")} />
          )}
          {(tab === "competitors" || printAll) && (
            <section>
              <h3>Análise de concorrentes</h3>
              <p className={s.empty}>
                A conexão atual autoriza somente o perfil conectado. Não
                disponibiliza alcance, público ou métricas privadas de
                concorrentes.
              </p>
              <p className={s.help}>
                Comparações públicas de outros perfis profissionais exigem uma
                integração adicional elegível da Meta. Esta versão não coleta
                dados de terceiros sem autorização nem apresenta estimativas
                como métricas reais.
              </p>
            </section>
          )}
        </article>
      ))}
    </section>
  );
}
