"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { dayKey } from "./shared";
import s from "@/app/(authenticated)/publicacoes/social.module.css";
export type DateChoice = { day: string; time: string };
export type RepeatChoice = {
  weekdays: number[];
  time: string;
  startDate: string;
  endDate: string | null;
};
export const weekNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function DateGrid({
  month,
  onMonth,
  selected,
  onSelect,
}: {
  month: string;
  onMonth: (m: string) => void;
  selected: string[];
  onSelect: (d: string) => void;
}) {
  const current = new Date(`${month}-01T12:00:00Z`),
    offset = (current.getUTCDay() + 6) % 7,
    count = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
    ).getUTCDate();
  function move(n: number) {
    const d = new Date(`${month}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    onMonth(d.toISOString().slice(0, 7));
  }
  return (
    <div>
      <div className={s.sectionHeading}>
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={16} />
        </button>
        <strong>
          {current.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </strong>
        <button type="button" aria-label="Próximo mês" onClick={() => move(1)}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className={s.weekdays}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <span key={d}>{weekNames[d]}</span>
        ))}
      </div>
      <div className={s.miniDays}>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const key = month + "-" + String(i + 1).padStart(2, "0");
          return (
            <button
              type="button"
              key={key}
              aria-label={key.split("-").reverse().join("/")}
              aria-pressed={selected.includes(key)}
              className={selected.includes(key) ? s.selected : ""}
              disabled={key < dayKey(new Date())}
              onClick={() => onSelect(key)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default function Dates({
  dates,
  onDates,
  mode,
  onMode,
  repeat,
  onRepeat,
  single = false,
}: {
  dates: DateChoice[];
  onDates: (d: DateChoice[]) => void;
  mode: "manual" | "weekly";
  onMode: (v: "manual" | "weekly") => void;
  repeat: RepeatChoice;
  onRepeat: (r: RepeatChoice) => void;
  single?: boolean;
}) {
  const [month, setMonth] = useState(
      (dates[0]?.day || dayKey(new Date())).slice(0, 7),
    ),
    [time, setTime] = useState(dates[0]?.time || "09:00");
  return (
    <fieldset className={s.datePanel}>
      <legend>Datas e horários · Brasília</legend>
      {!single && (
        <div className={s.actions}>
          <button
            type="button"
            aria-pressed={mode === "manual"}
            className={mode === "manual" ? s.selected : ""}
            onClick={() => onMode("manual")}
          >
            Escolher vários dias
          </button>
          <button
            type="button"
            aria-pressed={mode === "weekly"}
            className={mode === "weekly" ? s.selected : ""}
            onClick={() => onMode("weekly")}
          >
            Repetir toda semana
          </button>
        </div>
      )}
      {mode === "manual" ? (
        <>
          <div className={s.toolbar}>
            <label>
              Horário padrão
              <input
                type="time"
                value={time}
                onInput={(e) => setTime(e.currentTarget.value)}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={!dates.length || !time}
              onClick={() => onDates(dates.map((d) => ({ ...d, time })))}
            >
              Aplicar a todas as datas
            </button>
          </div>
          <p className={s.help}>
            {single
              ? "Esta edição altera somente esta ocorrência."
              : "Clique nos dias desejados. Novos dias usam o horário padrão; os horários já ajustados são preservados."}
          </p>
          <DateGrid
            month={month}
            onMonth={setMonth}
            selected={dates.map((d) => d.day)}
            onSelect={(day) => {
              if (dates.some((d) => d.day === day))
                onDates(dates.filter((d) => d.day !== day));
              else if (single) onDates([{ day, time }]);
              else if (dates.length < 60)
                onDates(
                  [...dates, { day, time }].sort((a, b) =>
                    a.day.localeCompare(b.day),
                  ),
                );
            }}
          />
          <p className={s.help}>
            {dates.length}{" "}
            {dates.length === 1 ? "data selecionada" : "datas selecionadas"} ·
            máximo {single ? 1 : 60}
          </p>
          <div className={s.dateList}>
            {dates.map((d) => (
              <div className={s.dateRow} key={d.day}>
                <span>
                  {new Date(d.day + "T12:00Z").toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <input
                  aria-label={`Horário de ${d.day}`}
                  type="time"
                  value={d.time}
                  onInput={(e) => {
                    const value = e.currentTarget.value;
                    onDates(
                      dates.map((item) =>
                        item.day === d.day ? { ...item, time: value } : item,
                      ),
                    );
                  }}
                  onChange={(e) =>
                    onDates(
                      dates.map((item) =>
                        item.day === d.day
                          ? { ...item, time: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={`Remover ${d.day}`}
                  onClick={() =>
                    onDates(dates.filter((item) => item.day !== d.day))
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className={s.help}>
            O sistema mantém os próximos 60 dias no calendário e continua
            criando as próximas ocorrências. Você pode pausar a repetição.
          </p>
          <div className={s.actions}>
            {weekNames.map((name, d) => (
              <button
                type="button"
                key={d}
                aria-pressed={repeat.weekdays.includes(d)}
                className={repeat.weekdays.includes(d) ? s.selected : ""}
                onClick={() =>
                  onRepeat({
                    ...repeat,
                    weekdays: repeat.weekdays.includes(d)
                      ? repeat.weekdays.filter((x) => x !== d)
                      : [...repeat.weekdays, d],
                  })
                }
              >
                {name}
              </button>
            ))}
          </div>
          <div className={s.formColumns}>
            <label>
              Horário
              <input
                type="time"
                value={repeat.time}
                onInput={(e) =>
                  onRepeat({ ...repeat, time: e.currentTarget.value })
                }
                onChange={(e) => onRepeat({ ...repeat, time: e.target.value })}
              />
            </label>
            <label>
              Começar em
              <input
                type="date"
                min={dayKey(new Date())}
                value={repeat.startDate}
                onInput={(e) =>
                  onRepeat({ ...repeat, startDate: e.currentTarget.value })
                }
                onChange={(e) =>
                  onRepeat({ ...repeat, startDate: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            Terminar
            <select
              value={repeat.endDate === null ? "never" : "date"}
              onChange={(e) =>
                onRepeat({
                  ...repeat,
                  endDate: e.target.value === "never" ? null : repeat.startDate,
                })
              }
            >
              <option value="never">Sem data final, até eu pausar</option>
              <option value="date">Em uma data escolhida</option>
            </select>
          </label>
          {repeat.endDate !== null && (
            <label>
              Último dia
              <input
                type="date"
                min={repeat.startDate}
                value={repeat.endDate}
                onInput={(e) =>
                  onRepeat({ ...repeat, endDate: e.currentTarget.value })
                }
                onChange={(e) =>
                  onRepeat({ ...repeat, endDate: e.target.value })
                }
              />
            </label>
          )}
        </>
      )}
    </fieldset>
  );
}
