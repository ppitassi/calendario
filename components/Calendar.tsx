"use client";
/** Calendário mensal que seleciona publicações e configura a cadência semanal. */


import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Users, CalendarDays, Trash2, Sliders, GripVertical, Move } from "lucide-react";
import { dateKey, monthLabel, shiftMonth } from "../lib/date";
import type { ContentItem, ContentType } from "../lib/types";

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

const AVAILABLE_FORMATS: ContentType[] = ["Feed e Story", "Feed", "Story", "Carrossel", "Reels"];

/** Expõe seleção de dia/post e devolve ao Studio todas as mudanças de competência ou cadência. */
export function Calendar({
  month,
  items,
  selectedId,
  postingDays = [],
  weekdayFormats = {},
  onMonthChange,
  onSelect,
  onCreate,
  onMovePost,
  onMoveDayPosts,
  onUpdatePostingDays,
  onUpdateWeekdayFormat,
  onClearMonth,
}: {
  month: Date;
  items: ContentItem[];
  selectedId: string | null;
  postingDays?: number[];
  weekdayFormats?: Record<number, ContentType>;
  onMonthChange: (date: Date) => void;
  onSelect: (item: ContentItem) => void;
  onCreate: (date: string) => void;
  onMovePost?: (postId: string, targetDate: string) => void;
  onMoveDayPosts?: (sourceDate: string, targetDate: string) => void;
  onUpdatePostingDays?: (days: number[]) => void;
  onUpdateWeekdayFormat?: (day: number, format: ContentType) => void;
  onClearMonth?: () => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  // A seleção do post determina inicialmente qual dia deve ficar destacado.
  const selectedItem = items.find((i) => i.id === selectedId);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => selectedItem ? selectedItem.date : null);

  // Estados para Drag and Drop de publicações entre dias do calendário
  const [dragSource, setDragSource] = useState<{
    type: "day" | "post";
    sourceDate: string;
    postId?: string;
    postIds?: string[];
    label?: string;
  } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const handleDayDragStart = (e: React.DragEvent, key: string, dayPosts: ContentItem[]) => {
    if (dayPosts.length === 0) return;
    const postIds = dayPosts.map((p) => p.id);
    const payload = {
      type: "day" as const,
      sourceDate: key,
      postIds,
      label: dayPosts.length === 1 ? (dayPosts[0].title || "Publicação") : `${dayPosts.length} publicações`,
    };
    setDragSource(payload);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePostTabDragStart = (e: React.DragEvent, post: ContentItem, label: string) => {
    e.stopPropagation();
    const payload = {
      type: "post" as const,
      sourceDate: post.date,
      postId: post.id,
      label,
    };
    setDragSource(payload);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCellDragOver = (e: React.DragEvent, targetKey: string) => {
    if (!dragSource || dragSource.sourceDate === targetKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== targetKey) {
      setDragOverDate(targetKey);
    }
  };

  const handleCellDragLeave = (e: React.DragEvent, targetKey: string) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverDate === targetKey) {
        setDragOverDate(null);
      }
    }
  };

  const handleCellDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const currentDrag = dragSource;
    setDragSource(null);

    let data = currentDrag;
    if (!data) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) data = JSON.parse(raw);
      } catch {}
    }

    if (!data || data.sourceDate === targetKey) return;

    if (data.type === "post" && data.postId) {
      onMovePost?.(data.postId, targetKey);
      setSelectedDate(targetKey);
    } else if (data.type === "day") {
      onMoveDayPosts?.(data.sourceDate, targetKey);
      setSelectedDate(targetKey);
    }
  };

  const handleDragEnd = () => {
    setDragOverDate(null);
    setDragSource(null);
  };

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

            const isDragSource = dragSource?.sourceDate === key;
            const isDropTarget = dragOverDate === key;

            return (
              <button
                key={key}
                type="button"
                draggable={count > 0}
                onDragStart={(e) => handleDayDragStart(e, key, dayPosts)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleCellDragOver(e, key)}
                onDragLeave={(e) => handleCellDragLeave(e, key)}
                onDrop={(e) => handleCellDrop(e, key)}
                className={`
                  ${count > 0 ? "populated draggableDay" : ""}
                  ${active ? "selected" : ""}
                  ${emptySelected ? "daySelectedEmpty" : ""}
                  ${hasImage ? "hasImage" : ""}
                  ${isDragSource ? "isDragSource" : ""}
                  ${isDropTarget ? "dropTargetHover" : ""}
                `.trim()}
                onClick={() => {
                  setSelectedDate(key);
                  if (count > 0) {
                    if (!dayPosts.some((p) => p.id === selectedId)) {
                      onSelect(dayPosts[0]);
                    }
                  }
                }}
                title={
                  count > 0
                    ? `${count} publicação(ões) em ${key} • Arraste para mover para outro dia`
                    : dragSource
                    ? `Soltar publicação aqui no dia ${index + 1}`
                    : `Dia ${index + 1}`
                }
              >
                <span>{index + 1}</span>
                {count === 1 && <i className={hasImage ? "imgIndicator" : ""} />}
                {count > 1 && (
                  <span className="calMultiCount" title={`${count} publicações neste dia`}>
                    {count}
                  </span>
                )}
                {isDropTarget && (
                  <span className="dropTargetIndicator" title="Soltar nesta data">
                    +
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {dragSource && (
          <div className="calendarDragNotice">
            <Move size={11} />
            <span>Solte em outro dia para reagendar</span>
          </div>
        )}
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
              {selectedDayPosts.map((post, idx) => {
                const getLabel = () => {
                  if (post.profile) {
                    if (post.isCollab) {
                      return post.collabProfile 
                        ? `${post.profile} + ${post.collabProfile}` 
                        : `${post.profile} (Collab)`;
                    }
                    if (post.title && post.title !== "Nova publicação" && post.title !== "Publicação" && post.title !== post.profile) {
                      return `${post.profile} • ${post.title}`;
                    }
                    return post.profile;
                  }
                  if (post.isCollab) {
                    const base = post.title && post.title !== "Nova publicação" ? post.title : "Publicação";
                    return `${base} (Collab)`;
                  }
                  return post.title || `Publicação #${idx + 1}`;
                };

                const label = getLabel();

                return (
                  <button
                    key={post.id}
                    type="button"
                    draggable={true}
                    onDragStart={(e) => handlePostTabDragStart(e, post, label)}
                    onDragEnd={handleDragEnd}
                    className={`dayPostTab ${post.id === selectedId ? "active" : ""} ${dragSource?.postId === post.id ? "isDragSource" : ""}`}
                    onClick={() => onSelect(post)}
                    title={`Post #${idx + 1}: ${label} • Arraste para qualquer dia do calendário`}
                  >
                    <div className="dayPostTabMain">
                      <GripVertical size={11} className="dayPostDragHandle" />
                      <span className="dayPostNum">#{idx + 1}</span>
                      <strong className="dayPostTitleText">{label}</strong>
                    </div>
                    {post.isCollab && (
                      <span className="dayPostCollabBadge" title="Publicação em Collab">
                        <Users size={10} />
                        <span>Collab</span>
                      </span>
                    )}
                  </button>
                );
              })}
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

        {/* UI: Seletor do formato padrão para cada dia ativo */}
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
                      onChange={(e) => onUpdateWeekdayFormat(w.day, e.target.value as ContentType)}
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
