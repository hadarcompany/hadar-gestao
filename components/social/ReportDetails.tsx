"use client";
import { useState } from "react";
import {
  ratio,
  mediaSummary,
  timePerformance,
  sumKnown,
  type AccountReport,
  type MediaReport,
  type Bucket,
} from "@/lib/social/analytics-data";
import s from "@/app/(authenticated)/publicacoes/social.module.css";
export const num = (n: number | null | undefined, digits = 0) =>
  n == null
    ? "Indisponível"
    : n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const pct = (n: number | null) =>
  n === null ? "Indisponível" : num(n, 2) + "%";
const date = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
const days = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
export function Metrics({
  items,
}: {
  items: [string, number | null, string?][];
}) {
  return (
    <dl className={s.reportMetrics}>
      {items.map(([label, value, unit]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {unit === "%" ? pct(value) : num(value, unit ? 2 : 0)}
            {value !== null && unit && unit !== "%" ? " " + unit : ""}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function Distribution({
  rows,
  title,
}: {
  rows: Bucket[];
  title: string;
}) {
  const merged = new Map<string, number>();
  for (const b of rows)
    merged.set(b.label, (merged.get(b.label) || 0) + b.value);
  const sorted = [...merged].sort((a, b) => b[1] - a[1]),
    total = sorted.reduce((a, b) => a + b[1], 0);
  return (
    <section className={s.distribution}>
      <h4>{title}</h4>
      {!sorted.length ? (
        <p className={s.empty}>A Meta não retornou este detalhamento.</p>
      ) : (
        <ul>
          {sorted.map(([label, value]) => (
            <li key={label}>
              <div>
                <span>{label}</span>
                <span>
                  {num(value)} · {pct(ratio(value, total, 100))}
                </span>
              </div>
              <div className={s.barTrack} aria-hidden="true">
                <span style={{ width: `${ratio(value, total, 100) || 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function Followers({ report: r }: { report: AccountReport }) {
  const samples = r.daily.filter((d) => d.followers !== null),
    first = samples[0],
    last = samples[samples.length - 1];
  const growth =
    samples.length > 1
      ? ratio(last.followers! - first.followers!, first.followers, 100)
      : null;
  const max = Math.max(1, ...samples.map((x) => x.followers!));
  return (
    <section>
      <h3>Seguidores e crescimento</h3>
      <Metrics
        items={[
          ["Seguidores atuais", r.followers],
          ["Novos seguidores no período", r.follows],
          ["Deixaram de seguir", r.unfollows],
          [
            "Saldo no período",
            r.follows !== null && r.unfollows !== null
              ? r.follows - r.unfollows
              : null,
          ],
          ["Crescimento observado", growth, "%"],
        ]}
      />
      <p className={s.help}>
        O crescimento observado compara as contagens coletadas
        {samples.length > 1
          ? ` em ${first.day.split("-").reverse().join("/")} e ${last.day.split("-").reverse().join("/")}`
          : ""}
        . Não reconstrói contagens anteriores ao início da coleta. Entradas e
        saídas vêm da Meta e podem atrasar até 48 horas.
      </p>
      <h4>Contagem diária de seguidores</h4>
      {!samples.length ? (
        <p className={s.empty}>
          O histórico diário começa quando a coleta deste perfil é ativada.
          Nenhum valor passado foi estimado.
        </p>
      ) : (
        <div
          className={s.dailyBars}
          role="img"
          aria-label="Contagens de seguidores por data; valores exatos disponíveis na tabela abaixo."
        >
          {samples.map((d) => (
            <div key={d.day}>
              <span>{num(d.followers)}</span>
              <div
                style={{
                  height: `${Math.max(1, ((d.followers || 0) / max) * 130)}px`,
                }}
              />
              <small>
                {d.day.slice(8)}/{d.day.slice(5, 7)}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className={s.tableScroll}>
        <table className={s.reportTable}>
          <caption>Histórico diário coletado</caption>
          <thead>
            <tr>
              <th>Data</th>
              <th>Seguidores</th>
              <th>Novos seguidores</th>
              <th>Deixaram de seguir</th>
            </tr>
          </thead>
          <tbody>
            {r.daily.map((d) => (
              <tr key={d.day}>
                <td>{d.day.split("-").reverse().join("/")}</td>
                <td>{num(d.followers)}</td>
                <td>{num(d.follows)}</td>
                <td>{num(d.unfollows)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function Demographics({ report: r }: { report: AccountReport }) {
  const [gender, setGender] = useState("all");
  const genders: Record<string, string> = {
    M: "Homem",
    F: "Mulher",
    U: "Não informado",
  };
  const names = (rows: Bucket[]) =>
    rows.map((b) => ({ ...b, label: genders[b.label] || b.label }));
  const countries = r.demographics.country.map((b) => ({
    ...b,
    label: /^[A-Z]{2}$/.test(b.label)
      ? new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(b.label) ||
        b.label
      : b.label,
  }));
  return (
    <section>
      <h3>Demográfico dos seguidores</h3>
      <p className={s.help}>
        Janela própria da Meta: últimos 30 dias, na data da consulta. Não
        acompanha o filtro de datas do relatório. Apenas pessoas com dados
        disponíveis entram na amostra; a soma pode ser menor que o total de
        seguidores. A Meta limita os resultados e pode ocultar amostras
        pequenas.
      </p>
      <div className={s.demographicGrid}>
        <Distribution title="Por gênero" rows={names(r.demographics.gender)} />
        <section>
          <label className={s.inlineFilter}>
            Faixa etária · gênero
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="all">Todos</option>
              <option value="M">Homem</option>
              <option value="F">Mulher</option>
              <option value="U">Não informado</option>
            </select>
          </label>
          <Distribution
            title="Faixa etária"
            rows={r.demographics.age.filter(
              (b) => gender === "all" || b.gender === gender,
            )}
          />
        </section>
        <Distribution title="Por país" rows={countries} />
        <Distribution title="Por cidade" rows={r.demographics.city} />
      </div>
    </section>
  );
}
const metricLabels: Partial<Record<keyof MediaReport, string>> = {
  views: "Visualizações",
  reach: "Alcance",
  interactions: "Interações",
  likes: "Curtidas",
  comments: "Comentários",
  saved: "Salvos",
  shares: "Compartilhamentos",
  follows: "Novos seguidores",
  profileVisits: "Visitas no perfil",
  profileActivity: "Ações no perfil",
  replies: "Respostas",
  navigation: "Navegação",
  exits: "Saídas",
  back: "Voltar",
  forward: "Avançar",
  next: "Próximo Story",
};
function Thumbnail({ media: m }: { media: MediaReport }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={s.mediaThumbnail}>
      {m.thumbnail && !broken ? (
        <img
          src={m.thumbnail}
          alt="Miniatura da publicação"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span>
          {m.channel === "STORY"
            ? "Story"
            : m.channel === "REEL"
              ? "Reel"
              : "Post"}
        </span>
      )}
    </div>
  );
}
export function MediaDetails({
  report: r,
  channel,
}: {
  report: AccountReport;
  channel: MediaReport["channel"];
}) {
  const [sort, setSort] = useState<keyof MediaReport>(
    channel === "POST" ? "interactions" : "views",
  );
  const list = r.media.filter((m) => m.channel === channel),
    summary = mediaSummary(list);
  const sorted = [...list].sort(
    (a, b) =>
      ((typeof b[sort] === "number" ? b[sort] : -1) as number) -
      ((typeof a[sort] === "number" ? a[sort] : -1) as number),
  );
  const best = sorted.find((m) => typeof m[sort] === "number");
  const title =
    channel === "STORY" ? "Stories" : channel === "REEL" ? "Reels" : "Posts";
  const columns: (keyof MediaReport)[] =
    channel === "STORY"
      ? [
          "exits",
          "back",
          "forward",
          "next",
          "navigation",
          "views",
          "reach",
          "follows",
          "profileVisits",
          "profileActivity",
          "replies",
          "shares",
          "interactions",
        ]
      : channel === "REEL"
        ? [
            "likes",
            "comments",
            "saved",
            "shares",
            "interactions",
            "reach",
            "views",
          ]
        : [
            "likes",
            "comments",
            "saved",
            "shares",
            "follows",
            "profileVisits",
            "profileActivity",
            "interactions",
            "reach",
            "views",
          ];
  const types = [...new Set(list.map((m) => m.type))];
  const typeMeans = types
    .map((type) => ({
      type,
      ...mediaSummary(list.filter((m) => m.type === type)),
    }))
    .filter((x) => x.averageInteractions !== null)
    .sort((a, b) => b.averageInteractions! - a.averageInteractions!);
  return (
    <section>
      <div className={s.sectionHeading}>
        <h3>Top 20 {title}</h3>
        <label className={s.inlineFilter}>
          Ordenar por
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as keyof MediaReport)}
          >
            <option value="views">Visualizações</option>
            <option value="interactions">Interações</option>
            <option value="reach">Alcance</option>
          </select>
        </label>
      </div>
      <p className={s.help}>
        Publicações feitas nas datas selecionadas; métricas acumuladas até a
        última coleta de cada mídia. Os totais abaixo usam todas as{" "}
        {list.length} mídias coletadas do formato, não apenas o Top 20. Valores
        ausentes não entram nas médias.
      </p>
      {channel === "STORY" && (
        <p className={s.notice}>
          Stories expirados só aparecem se foram coletados enquanto estavam
          disponíveis. O arquivo guarda métricas e referências, sem armazenar
          vídeos. Reshares não têm cobertura garantida nesta conexão.
        </p>
      )}
      <Metrics
        items={[
          [`${title} coletados`, list.length],
          ["Visualizações coletadas", summary.views.value],
          ["Média de visualizações", summary.averageViews, "por mídia"],
          ["Interações coletadas", summary.interactions.value],
          ["Média de interações", summary.averageInteractions, "por mídia"],
          ["Média de engajamento", summary.averageEngagement, "%"],
        ]}
      />
      {(summary.views.known < list.length ||
        summary.interactions.known < list.length) && (
        <p className={s.notice}>
          Cobertura: visualizações em {summary.views.known}/{list.length}{" "}
          mídias; interações em {summary.interactions.known}/{list.length}.
          Totais parciais.
        </p>
      )}
      {best && (
        <div className={s.bestMedia}>
          <Thumbnail media={best} />
          <div>
            <h4>
              Melhor{" "}
              {channel === "STORY"
                ? "Story"
                : channel === "REEL"
                  ? "Reel"
                  : "post"}{" "}
              por {metricLabels[sort]?.toLowerCase()}
            </h4>
            <strong>
              {num(best[sort] as number)} {metricLabels[sort]?.toLowerCase()}
            </strong>
            {sort === "views" && (
              <p>
                {pct(ratio(best.views, summary.views.value, 100))} das
                visualizações coletadas deste formato.
              </p>
            )}
            <p>{best.caption || "Sem legenda"}</p>
            <small>
              Publicado em {date(best.timestamp)}
              {best.fetchedAt ? ` · Coletado em ${date(best.fetchedAt)}` : ""}
            </small>
            {best.permalink && (
              <a
                href={best.permalink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver na rede social
              </a>
            )}
          </div>
        </div>
      )}
      {!list.length ? (
        <p className={s.empty}>
          Nenhum {title.toLowerCase()} coletado para este período. Confira o
          início da coleta e as datas escolhidas.
        </p>
      ) : (
        <div
          className={s.tableScroll}
          tabIndex={0}
          aria-label={`Tabela rolável de ${title}`}
        >
          <table className={`${s.reportTable} ${s.mediaMetricsTable}`}>
            <caption>
              Top 20 {title} por {metricLabels[sort]?.toLowerCase()}
            </caption>
            <thead>
              <tr>
                <th>Publicação</th>
                <th>Data</th>
                {columns.map((k) => (
                  <th key={k}>{metricLabels[k]}</th>
                ))}
                <th>Engajamento</th>
                <th>Última coleta</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 20).map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className={s.mediaCell}>
                      <Thumbnail media={m} />
                      <span>
                        {m.permalink ? (
                          <a
                            href={m.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {m.caption.slice(0, 100) || m.id}
                          </a>
                        ) : (
                          m.caption.slice(0, 100) || m.id
                        )}
                        <small>
                          {m.type === "IMAGE"
                            ? "Foto"
                            : m.type === "CAROUSEL_ALBUM"
                              ? "Carrossel"
                              : "Vídeo"}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>{date(m.timestamp)}</td>
                  {columns.map((k) => (
                    <td key={k}>{num(m[k] as number | null)}</td>
                  ))}
                  <td>{pct(ratio(m.interactions, m.reach, 100))}</td>
                  <td>
                    {m.fetchedAt ? date(m.fetchedAt) : "Sem métricas coletadas"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={s.help}>
        Engajamento por mídia = interações ÷ alcance × 100. Alcance não é somado
        entre mídias porque as mesmas pessoas podem aparecer em várias
        publicações.
      </p>
      <div className={s.demographicGrid}>
        <section>
          <h4>{title} por tipo</h4>
          {typeMeans.length > 1 && (
            <p className={s.help}>
              Na amostra coletada,{" "}
              {typeMeans[0].type === "IMAGE"
                ? "foto"
                : typeMeans[0].type === "CAROUSEL_ALBUM"
                  ? "carrossel"
                  : "vídeo"}{" "}
              teve a maior média de interações:{" "}
              {num(typeMeans[0].averageInteractions, 1)} em {typeMeans[0].count}{" "}
              mídias. Essa comparação não garante o desempenho de novas
              publicações.
            </p>
          )}
          <div className={s.tableScroll}>
            <table className={s.reportTable}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Média de alcance</th>
                  <th>Média de interações</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => {
                  const rows = list.filter((m) => m.type === type),
                    reach = sumKnown(rows, "reach"),
                    interactions = sumKnown(rows, "interactions");
                  return (
                    <tr key={type}>
                      <td>
                        {type === "IMAGE"
                          ? "Foto"
                          : type === "CAROUSEL_ALBUM"
                            ? "Carrossel"
                            : "Vídeo"}
                      </td>
                      <td>{rows.length}</td>
                      <td>{num(ratio(reach.value, reach.known), 1)}</td>
                      <td>
                        {num(ratio(interactions.value, interactions.known), 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <TimeTable rows={list} title={`${title} por dia e hora`} />
      </div>
    </section>
  );
}
export function TimeTable({
  rows,
  title = "Melhores horários",
}: {
  rows: MediaReport[];
  title?: string;
}) {
  const bins = timePerformance(rows);
  return (
    <section>
      <h4>{title}</h4>
      <p className={s.help}>
        America/Sao_Paulo. Média de interações acumuladas das mídias publicadas
        em cada horário; é uma associação observada, não uma previsão.
      </p>
      {!bins.length ? (
        <p className={s.empty}>
          Ainda não há mídias com interações coletadas para comparar horários.
        </p>
      ) : (
        <div className={s.tableScroll}>
          <table className={s.reportTable}>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Horários com maior média</th>
                <th>Menor média observada</th>
                <th>Amostra</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                const observed = bins.filter((b) => b.day === day),
                  eligible = observed
                    .filter((b) => b.count >= 3)
                    .sort((a, b) => b.average - a.average);
                return (
                  <tr key={day}>
                    <td>{days[day]}</td>
                    <td>
                      {eligible.length
                        ? eligible
                            .slice(0, 2)
                            .map(
                              (b) =>
                                `${String(b.hour).padStart(2, "0")}:00 (${num(b.average, 1)})`,
                            )
                            .join(" · ")
                        : "Sem amostra suficiente"}
                    </td>
                    <td>
                      {eligible.length >= 2
                        ? `${String(eligible[eligible.length - 1].hour).padStart(2, "0")}:00`
                        : "Indisponível"}
                    </td>
                    <td>{observed.reduce((a, b) => a + b.count, 0)} mídias</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={s.help}>
        São necessárias pelo menos 3 mídias no mesmo dia da semana e hora para
        destacar um horário. Não há horários recomendados por categoria nem
        dados de mercado nesta análise.
      </p>
      {bins.length > 0 && (
        <details>
          <summary>Ver todos os horários observados</summary>
          <div className={s.tableScroll}>
            <table className={s.reportTable}>
              <thead>
                <tr>
                  <th>Dia e hora</th>
                  <th>Mídias</th>
                  <th>Média de interações</th>
                </tr>
              </thead>
              <tbody>
                {[...bins]
                  .sort((a, b) => a.day - b.day || a.hour - b.hour)
                  .map((b) => (
                    <tr key={`${b.day}-${b.hour}`}>
                      <td>
                        {days[b.day]} · {String(b.hour).padStart(2, "0")}:00
                      </td>
                      <td>{b.count}</td>
                      <td>{num(b.average, 1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
