"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, dayKey, states } from "./shared";
import type { AccountReport } from "@/lib/social/reports";
import s from "@/app/(authenticated)/publicacoes/social.module.css";
const number = (n: number | null) =>
  n === null ? "Indisponível" : n.toLocaleString("pt-BR");
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
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
    [end, setEnd] = useState(dayKey(new Date())),
    [data, setData] = useState<{
      reports: AccountReport[];
      editorial: { status: string; _count: { _all: number } }[];
    } | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setData(null);
    setError("");
  }, [clientId]);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(
        await api(
          `/api/social/reports?${new URLSearchParams({ clientId, start, end })}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function download() {
    if (!data) return;
    const rows: unknown[][] = [
      ["Cliente", clientName],
      ["Período", start, end],
      [
        "Perfil",
        "Rede",
        "Seguidores atuais",
        "Alcance no período",
        "Visualizações no período",
        "Interações no período",
        "Atualizado em",
      ],
    ];
    for (const r of data.reports) {
      rows.push(
        [
          r.name,
          r.provider,
          r.followers,
          r.reach,
          r.views,
          r.interactions,
          r.fetchedAt,
        ],
        ["Publicação", "Data", "Tipo", "Curtidas", "Comentários", "Link"],
      );
      for (const m of r.media)
        rows.push([
          m.caption,
          m.timestamp,
          m.type,
          m.likes,
          m.comments,
          m.permalink,
        ]);
    }
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-${start}-${end}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (clientId === "all")
    return (
      <p className={s.empty}>
        Selecione um cliente para consultar os relatórios de suas contas.
      </p>
    );
  return (
    <section className={s.report}>
      <div className={s.sectionHeading}>
        <div>
          <h2>Relatório · {clientName}</h2>
          <p className={s.help}>
            Dados reais da Meta. Seguidores são o total atual; demais métricas
            usam o período escolhido.
          </p>
        </div>
        <button disabled={!data || loading} onClick={download}>
          <Download size={16} /> Exportar CSV
        </button>
      </div>
      <div className={s.toolbar}>
        <label>
          De
          <input
            type="date"
            value={start}
            disabled={loading}
            onInput={(e) => {
              setStart(e.currentTarget.value);
              setData(null);
            }}
            max={end}
            onChange={(e) => {
              setStart(e.target.value);
              setData(null);
            }}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={end}
            disabled={loading}
            onInput={(e) => {
              setEnd(e.currentTarget.value);
              setData(null);
            }}
            min={start}
            max={dayKey(new Date())}
            onChange={(e) => {
              setEnd(e.target.value);
              setData(null);
            }}
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
        Até 30 dias por consulta. Atualizações em intervalos de 30 minutos. O
        histórico disponível depende da conta e das permissões.
      </p>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      {!data && !loading && (
        <p className={s.empty}>
          Escolha o período e gere o relatório deste cliente.
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
              {r.name} · {r.provider === "INSTAGRAM" ? "Instagram" : "Facebook"}
            </h2>
            <span className={s.help}>
              Atualizado em {new Date(r.fetchedAt).toLocaleString("pt-BR")}
            </span>
          </div>
          {r.warning && (
            <p role="status" className={s.error}>
              {r.warning}
            </p>
          )}
          <dl className={s.reportMetrics}>
            {[
              ["Seguidores atuais", r.followers],
              ["Alcance no período", r.reach],
              ["Visualizações", r.views],
              ["Interações", r.interactions],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{number(value as number | null)}</dd>
              </div>
            ))}
          </dl>
          {(r.insightsWarning || (r.warning && r.provider === "INSTAGRAM")) && (
            <div className={s.permissionNote}>
              <p>
                {r.insightsWarning ||
                  "Reconecte o Instagram com a autorização de relatórios para consultar as métricas disponíveis."}
              </p>
              {admin && r.provider === "INSTAGRAM" && (
                <button onClick={onAuthorize}>
                  Autorizar relatórios e comentários
                </button>
              )}
            </div>
          )}
          {r.partial && (
            <p className={s.notice}>
              O perfil tem mais de 500 publicações recentes. A lista abaixo é
              parcial; não representa todo o período.
            </p>
          )}
          <div className={s.tableScroll}>
            <table className={s.reportTable}>
              <thead>
                <tr>
                  <th>Publicação no período</th>
                  <th>Data</th>
                  <th>Formato</th>
                  <th>Curtidas</th>
                  <th>Comentários</th>
                </tr>
              </thead>
              <tbody>
                {r.media.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.permalink ? (
                        <a
                          href={m.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {m.caption.slice(0, 110) || "Ver publicação"}
                        </a>
                      ) : (
                        m.caption.slice(0, 110) || "Sem legenda"
                      )}
                    </td>
                    <td>{new Date(m.timestamp).toLocaleDateString("pt-BR")}</td>
                    <td>{m.type}</td>
                    <td>{number(m.likes)}</td>
                    <td>{number(m.comments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!r.media.length && (
              <p className={s.empty}>
                {r.warning
                  ? "A lista de publicações não pôde ser atualizada."
                  : "Nenhuma publicação de Feed ou Reel retornada neste período. Stories expirados não aparecem nesta lista."}
              </p>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
