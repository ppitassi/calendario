"use client";
/** Calendário mensal que seleciona publicações e configura a cadência semanal. */


import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Users, CalendarDays, Trash2 } from "lucide-react";
import { dateKey, monthLabel, shiftMonth } from "../lib/date";
import type { ContentItem } from "../lib/types";

/** Cabeçalhos na ordem nativa do calendário JavaScript: domingo a sábado. */
const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Ordem operacional dos botões: dias úteis primeiro e domingo por último. */
const WEEKDAY_OPTIONS = [
  { day: 1, label: "SEG", full: "Segunda" },
  { day: 2, label: "TER", full: "Terça" },
  { day: 3, label: "QUA", full: "Quarta" },
  { day: 4, label: "QUI", full: "Quinta" },
  { day: 5, label: "SEX", full: "Sexta" },
  { day: 6, label: "SÁB", full: "Sábado" },
  { day: 0, label: "DOM", full: "Domingo" },
];

/** Expõe seleção de dia/post e devolve ao Studio todas as mudanças de competência ou cadência. */
export function Calendar({
  month,
  items,
  selectedId,
  postingDays = [],
  onMonthChange,
  onSelect,
  onCreate,
  onUpdatePostingDays,
  onClearMonth,
}: {
  month: Date;
  items: ContentItem[];
  selectedId: string | null;
  postingDays?: number[];
  onMonthChange: (date: Date) => void;
  onSelect: (item: ContentItem) => void;
  onCreate: (date: string) => void;
  onUpdatePostingDays?: (days: number[]) => void;
  onClearMonth?: () => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  // A seleção do post determina inicialmente qual dia deve ficar destacado.
  const selectedItem = items.find((i) => i.id === selectedId);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => selectedItem ? selectedItem.date : null);

  // Mantém o dia destacado sincronizado quando o editor seleciona outro post.
  useEffect(() => {
    if (selectedItem && selectedItem.date !== selectedDate) {
      setSelectedDate(selectedItem.date);
    }
  }, [selectedId, selectedItem]);

  // Indexa os posts por data para células, contadores e abas não refiltrarem a lista.
  const postsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of items) {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  // O painel diário consome somente o grupo já indexado da data destacada.
  const selectedDayPosts = useMemo(() => {
    if (!selectedDate) return [];
    return postsByDate.get(selectedDate) || [];
  }, [postsByDate, selectedDate]);

  /** Cada clique alterna a cadência daquele dia entre zero, um, dois e três posts. */
  const handleToggleWeekday = (dayNum: number) => {
    if (!onUpdatePostingDays) return;
    const count = postingDays.filter(d => d === dayNum).length;
    let nextCount = count + 1;
    if (nextCount > 3) nextCount = 0; // Limite operacional: três posts por ocorrência semanal.

    const otherDays = postingDays.filter(d => d !== dayNum);
    const updated = [...otherDays, ...Array(nextCount).fill(dayNum)].sort((a, b) => a - b);
    onUpdatePostingDays(updated);
  };

  /** Formata a data do painel diário sem deslocamento causado por fuso horário. */
  const formatSelectedDateShort = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T12:00:00`);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch {
      return dateStr;
    }
  };

  return (
    <aside className="calendarPane">
      {/* UI: título da coluna esquerda do Studio. */}
      <div className="panelTitle">
        <span>Calendário Editorial</span>
      </div>

      {/* UI: seletor de competência e grade mensal compacta. */}
      <section className="monthSurface">
        {/* UI: setas mudam de mês e limpam o destaque de dia anterior. */}
        <div className="monthHeader">
          <button
            aria-label="Mês anterior"
            onClick={() => {
              setSelectedDate(null);
              onMonthChange(shiftMonth(month, -1));
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <strong>{monthLabel(month)}</strong>
          <button
            aria-label="Próximo mês"
            onClick={() => {
              setSelectedDate(null);
              onMonthChange(shiftMonth(month, 1));
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* UI: cada célula informa quantidade, seleção e presença de arte. */}
        <div className="compactCalendar">
          {weekdays.map((day, index) => (
            <span className="weekday" key={`${day}-${index}`}>
              {day}
            </span>
          ))}

          {Array.from({ length: first }).map((_, index) => (
            <span key={`empty-${index}`} />
          ))}

          {Array.from({ length: days }).map((_, index) => {
            // Deriva todos os sinais visuais da data antes de montar sua célula.
            const key = dateKey(new Date(month.getFullYear(), month.getMonth(), index + 1));
            const dayPosts = postsByDate.get(key) || [];
            const count = dayPosts.length;
            const isDaySelected = selectedDate === key;
            const hasSelectedPost = dayPosts.some((item) => item.id === selectedId);
            const active = hasSelectedPost || (isDaySelected && count > 0);
            const emptySelected = isDaySelected && count === 0;
            const hasImage = dayPosts.some((item) => Boolean(item.imageUrl));

            return (
              <button
                key={key}
                type="button"
                className={`
                  ${count > 0 ? "populated" : ""}
                  ${active ? "selected" : ""}
                  ${emptySelected ? "daySelectedEmpty" : ""}
                  ${hasImage ? "hasImage" : ""}
                `.trim()}
                onClick={() => {
                  setSelectedDate(key);
                  if (count > 0) {
                    if (!dayPosts.some((p) => p.id === selectedId)) {
                      onSelect(dayPosts[0]);
                    }
                  }
                }}
                title={count > 0 ? `${count} publicação(ões) em ${key}` : `Dia ${index + 1}`}
              >
                <span>{index + 1}</span>
                {count === 1 && <i className={hasImage ? "imgIndicator" : ""} />}
                {count > 1 && (
                  <span className="calMultiCount" title={`${count} publicações neste dia`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* UI: dia selecionado, suas publicações e atalho para criar outra na mesma data. */}
      {selectedDate && (
        <section className="selectedDayBox">
          {/* UI: resume a data e quantos posts competem por esse dia. */}
          <div className="selectedDayHeader">
            <div className="selectedDayTitle">
              <CalendarDays size={13} style={{ color: "var(--accent)" }} />
              <strong>Dia {formatSelectedDateShort(selectedDate)}</strong>
            </div>
            <span className="selectedDayBadge">
              {selectedDayPosts.length === 1 ? "1 post" : `${selectedDayPosts.length} posts`}
            </span>
          </div>

          {selectedDayPosts.length > 0 ? (
            <div className="dayPostsTabs">
              {selectedDayPosts.map((post, idx) => (
                <button
                  key={post.id}
                  type="button"
                  className={`dayPostTab ${post.id === selectedId ? "active" : ""}`}
                  onClick={() => onSelect(post)}
                >
                  <span style={{ fontWeight: 800 }}>#{idx + 1}</span>
                  <strong>{post.title || post.type}</strong>
                  {post.isCollab && (
                    <span title="Collab" style={{ display: "inline-flex", alignItems: "center", color: "var(--accent)" }}>
                      <Users size={10} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "10px", color: "var(--muted)", padding: "2px 0" }}>
              Nenhuma publicação neste dia.
            </div>
          )}

          <button
            type="button"
            className="dayActionBtn"
            onClick={() => onCreate(selectedDate)}
          >
            <Plus size={11} /> {selectedDayPosts.length > 0 ? "Outro post neste dia" : "Criar post neste dia"}
          </button>
        </section>
      )}

      {/* UI: dias repetidos no array representam mais de um post por ocorrência semanal. */}
      <section className="cadenceSection">
        {/* UI: total do mês contextualiza o efeito da cadência configurada abaixo. */}
        <div className="cadenceHeader">
          <span>Dias de Postagem</span>
          <b>{items.length} no mês</b>
        </div>

        {/* UI: sete botões; o sufixo `xN` mostra quantos posts cabem naquele dia. */}
        <div className="weekdayToggles">
          {WEEKDAY_OPTIONS.map((w) => {
            // Repetições do número do dia codificam sua quantidade semanal.
            const count = postingDays.filter((d) => d === w.day).length;
            const isSelected = count > 0;
            return (
              <button
                key={w.day}
                type="button"
                className={`weekdayToggleBtn ${isSelected ? "active" : ""}`}
                onClick={() => handleToggleWeekday(w.day)}
                title={`${w.full}: ${count} post(s) por dia (clique para alterar)`}
              >
                {w.label} {count > 1 ? `x${count}` : ""}
              </button>
            );
          })}
        </div>

        <div className="cadenceSummary">
          <span>
            {postingDays.length > 0
              ? `${postingDays.length} publicação(ões) por semana`
              : "Nenhum dia fixo"}
          </span>
          <strong>{items.filter((i) => Boolean(i.imageUrl)).length} com arte</strong>
        </div>
      </section>

      {/* UI: cria na data destacada; sem destaque, usa o primeiro dia da competência. */}
      <button
        type="button"
        className="primaryButton full"
        onClick={() => onCreate(selectedDate || dateKey(month))}
      >
        <Plus size={16} /> Nova Publicação
        {selectedDate && (
          <span style={{ opacity: 0.85, fontSize: "9px", marginLeft: "4px" }}>
            ({formatSelectedDateShort(selectedDate)})
          </span>
        )}
      </button>

      {/* UI: ação de limpar mês para excluir todas as postagens do mês atual de uma só vez */}
      {onClearMonth && items.length > 0 && (
        <button
          type="button"
          className="clearMonthActionBtn"
          onClick={() => {
            if (
              window.confirm(
                `Deseja realmente apagar todas as ${items.length} postagens deste mês? Essa ação não pode ser desfeita.`
              )
            ) {
              onClearMonth();
            }
          }}
          title="Excluir todas as postagens deste mês"
        >
          <Trash2 size={13} /> Limpar mês ({items.length})
        </button>
      )}
    </aside>
  );
}
