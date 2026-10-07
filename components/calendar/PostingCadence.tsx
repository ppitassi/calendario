"use client";

import { Sliders } from "lucide-react";
import type { ContentType } from "../../lib/types";

export const WEEKDAY_OPTIONS = [
  { day: 1, label: "SEG", full: "Segunda" },
  { day: 2, label: "TER", full: "Terça" },
  { day: 3, label: "QUA", full: "Quarta" },
  { day: 4, label: "QUI", full: "Quinta" },
  { day: 5, label: "SEX", full: "Sexta" },
  { day: 6, label: "SÁB", full: "Sábado" },
  { day: 0, label: "DOM", full: "Domingo" },
];

export const AVAILABLE_FORMATS: ContentType[] = [
  "Feed e Story",
  "Feed",
  "Story",
  "Carrossel",
  "Reels",
];

export interface PostingCadenceProps {
  postingDays: number[];
  weekdayFormats: Record<number, ContentType>;
  totalItemsCount: number;
  itemsWithArtCount: number;
  onToggleWeekday: (day: number) => void;
  onUpdateWeekdayFormat?: (day: number, format: ContentType) => void;
}

export function PostingCadence({
  postingDays,
  weekdayFormats,
  totalItemsCount,
  itemsWithArtCount,
  onToggleWeekday,
  onUpdateWeekdayFormat,
}: PostingCadenceProps) {
  return (
    <section className="cadenceSection">
      <div className="cadenceHeader">
        <span>Dias de Postagem</span>
        <b>{totalItemsCount} no mês</b>
      </div>

      <div className="weekdayToggles">
        {WEEKDAY_OPTIONS.map((w) => {
          const count = postingDays.filter((d) => d === w.day).length;
          const isSelected = count > 0;
          return (
            <button
              key={w.day}
              type="button"
              className={`weekdayToggleBtn ${isSelected ? "active" : ""}`}
              onClick={() => onToggleWeekday(w.day)}
              title={`${w.full}: ${count} post(s) por dia (clique para alterar)`}
            >
              {w.label} {count > 1 ? `x${count}` : ""}
            </button>
          );
        })}
      </div>

      {postingDays.length > 0 && onUpdateWeekdayFormat && (
        <div className="weekdayFormatsList">
          <div className="weekdayFormatsHeader">
            <Sliders size={11} />
            <span>Formato padrão por dia:</span>
          </div>
          <div className="weekdayFormatsItems">
            {WEEKDAY_OPTIONS.filter((w) => postingDays.includes(w.day)).map((w) => {
              const currentFormat = weekdayFormats[w.day] || "Feed e Story";
              return (
                <div key={w.day} className="weekdayFormatRow">
                  <span className="weekdayFormatDayLabel">{w.label}</span>
                  <select
                    className="weekdayFormatSelect"
                    value={currentFormat}
                    onChange={(e) =>
                      onUpdateWeekdayFormat(w.day, e.target.value as ContentType)
                    }
                    title={`Formato padrão das postagens de ${w.full}`}
                  >
                    {AVAILABLE_FORMATS.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {fmt}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="cadenceSummary">
        <span>
          {postingDays.length > 0
            ? `${postingDays.length} publicação(ões) por semana`
            : "Nenhum dia fixo"}
        </span>
        <strong>{itemsWithArtCount} com arte</strong>
      </div>
    </section>
  );
}
