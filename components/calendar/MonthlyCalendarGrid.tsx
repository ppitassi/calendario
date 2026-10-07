"use client";
/**
 * Calendário Mensal Full-Size (Editor V2).
 *
 * Conforme Seção 4.1 e Seção 11 do Plano Técnico:
 * - Ocupa toda a área útil do workspace.
 * - Sete colunas (Segunda a Domingo).
 * - Sem publicação selecionada, não reserva espaço para editor ou preview.
 * - Modo explícito de seleção de múltiplos dias para criação em lote (Seção 4.2).
 * - Drag-and-drop de publicações entre dias.
 * - Células mostram títulos resumidos, contadores e indicador de extra.
 */

import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  CheckSquare,
  Sparkles,
  Move,
  X,
  Layers,
} from "lucide-react";
import { dateKey, monthLabel, shiftMonth } from "@/lib/date";
import type { ContentItem, ContentType } from "@/lib/types";
import { BatchActionBar } from "./BatchActionBar";
import styles from "../MonthlyCalendarGrid.module.css";

// 7 colunas: Segunda a Domingo (conforme Seção 4.1 do plano técnico)
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface MonthlyCalendarGridProps {
  month: Date;
  items: ContentItem[];
  selectedId: string | null;
  onMonthChange: (date: Date) => void;
  onSelect: (item: ContentItem) => void;
  onCreate: (date: string) => void;
  onCreateFromReference?: (date: string, title: string) => void;
  onCreateBatch?: (dates: string[], type: ContentType) => void;
  onMovePost?: (postId: string, targetDate: string) => void;
  onMoveDayPosts?: (sourceDate: string, targetDate: string) => void;
  onReorderPosts?: (sourcePostId: string, targetPostId: string, position?: "before" | "after") => void;
  availableProfiles?: string[];
}

export function MonthlyCalendarGrid({
  month,
  items,
  selectedId,
  onMonthChange,
  onSelect,
  onCreate,
  onCreateFromReference,
  onCreateBatch,
  onMovePost,
  onMoveDayPosts,
  availableProfiles = [],
}: MonthlyCalendarGridProps) {
  // Modo de seleção múltipla de dias para lote
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Drag and Drop
  const [dragSource, setDragSource] = useState<{
    type: "day" | "post";
    sourceDate: string;
    postId?: string;
  } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Referências editoriais / Feriados (Seção 6 do Plano V2)
  const [referenceEvents, setReferenceEvents] = useState<any[]>([]);

  useEffect(() => {
    async function loadReferences() {
      try {
        const y = month.getFullYear();
        const m = String(month.getMonth() + 1).padStart(2, "0");
        const monthKeyStr = `${y}-${m}`;
        const res = await fetch(`/api/calendar-reference-events?month=${monthKeyStr}`);
        const data = await res.json();
        if (Array.isArray(data.events)) {
          setReferenceEvents(data.events);
        }
      } catch (err) {
        console.error("Falha ao carregar referências do calendário:", err);
      }
    }
    loadReferences();
  }, [month]);

  // Mapeamento de itens por dia civil YYYY-MM-DD
  const postsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of items) {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    }
    for (const [, list] of map.entries()) {
      list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    }
    return map;
  }, [items]);

  // Mapeamento de referências por dia civil YYYY-MM-DD
  const referencesByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const ev of referenceEvents) {
      const list = map.get(ev.startsOn) || [];
      list.push(ev);
      map.set(ev.startsOn, list);
    }
    return map;
  }, [referenceEvents]);

  // Cálculo da grade: segunda a domingo
  // getDay(): 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  // Ajuste para Segunda = 0: (getDay() + 6) % 7
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDayOfWeek = (new Date(year, monthIdx, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  // Dias do mês anterior para preenchimento suave
  const prevMonthDays = new Date(year, monthIdx, 0).getDate();

  const handleToggleDateSelection = (key: string) => {
    if (selectedDates.includes(key)) {
      setSelectedDates(selectedDates.filter((d) => d !== key));
    } else {
      setSelectedDates([...selectedDates, key]);
    }
  };

  const handleDayClick = (key: string, dayPosts: ContentItem[]) => {
    if (isSelectMode) {
      handleToggleDateSelection(key);
      return;
    }
    if (dayPosts.length > 0) {
      onSelect(dayPosts[0]);
    } else {
      onCreate(key);
    }
  };

  const handlePostDragStart = (e: React.DragEvent, post: ContentItem) => {
    e.stopPropagation();
    const payload = {
      type: "post" as const,
      sourceDate: post.date,
      postId: post.id,
    };
    setDragSource(payload);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCellDragOver = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== targetDate) {
      setDragOverDate(targetDate);
    }
  };

  const handleCellDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const source = dragSource;
    setDragSource(null);

    if (source && source.type === "post" && source.postId) {
      if (source.sourceDate !== targetDate) {
        onMovePost?.(source.postId, targetDate);
      }
    }
  };

  return (
    <div className={styles.gridContainer}>
      {/* Barra de Ferramentas Superior do Calendário */}
      <div className={styles.toolbar}>
        <div className={styles.monthControls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <strong className={styles.monthTitle}>{monthLabel(month)}</strong>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={() => onMonthChange(new Date())}
          >
            Hoje
          </button>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.modeBtn} ${isSelectMode ? styles.modeBtnActive : ""}`}
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedDates([]);
            }}
          >
            <CheckSquare size={14} />
            <span>{isSelectMode ? "Concluir seleção" : "Selecionar dias"}</span>
          </button>

          <button
            type="button"
            className={styles.primaryActionBtn}
            onClick={() => onCreate(dateKey(new Date(year, monthIdx, 1)))}
          >
            <Plus size={15} />
            <span>Criar publicação</span>
          </button>
        </div>
      </div>

      {/* Cabeçalho dos Dias da Semana (Segunda a Domingo) */}
      <div className={styles.weekdaysHeader}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} className={styles.weekdayCol}>
            {wd}
          </div>
        ))}
      </div>

      {/* Grade Mensal Full-Size */}
      <div className={styles.daysGrid}>
        {/* Dias do mês anterior */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => {
          const dayNum = prevMonthDays - firstDayOfWeek + i + 1;
          return (
            <div key={`prev-${i}`} className={`${styles.dayCell} ${styles.outsideMonth}`}>
              <span className={styles.dayNum}>{dayNum}</span>
            </div>
          );
        })}

        {/* Dias do mês atual */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const key = dateKey(new Date(year, monthIdx, dayNum));
          const dayPosts = postsByDate.get(key) || [];
          const count = dayPosts.length;
          const isSelected = selectedDates.includes(key);
          const isDropTarget = dragOverDate === key;

          return (
            <div
              key={key}
              className={`
                ${styles.dayCell}
                ${isSelected ? styles.daySelected : ""}
                ${isDropTarget ? styles.dayDropTarget : ""}
                ${count > 0 ? styles.dayWithPosts : ""}
              `.trim()}
              onClick={() => handleDayClick(key, dayPosts)}
              onDragOver={(e) => handleCellDragOver(e, key)}
              onDrop={(e) => handleCellDrop(e, key)}
            >
              <div className={styles.cellHeader}>
                <span className={styles.dayNum}>{dayNum}</span>
                {count > 0 && (
                  <span className={styles.postsBadge}>
                    {count === 1 ? "1 post" : `${count} posts`}
                  </span>
                )}
                {isSelectMode && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className={styles.dayCheckbox}
                    aria-label={`Selecionar dia ${dayNum}`}
                  />
                )}
              </div>

              {/* Lista de publicações e referências no card do dia */}
              <div className={styles.cellPostsList}>
                {/* Referências Editoriais e Feriados Oficiais com ação 'Usar como inspiração' */}
                {(referencesByDate.get(key) || []).map((refEv: any) => (
                  <div
                    key={refEv.externalKey || refEv.title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "4px",
                      background: "rgba(14, 165, 233, 0.1)",
                      border: "1px solid rgba(14, 165, 233, 0.25)",
                      borderRadius: "5px",
                      padding: "2px 5px",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: "#0369a1",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                    title={`Data de Referência: ${refEv.title} • Fonte: ${refEv.sourceLabel || "Oficial"} (Clique no + para usar como inspiração)`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ fontSize: "0.6rem" }}>🗓️</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{refEv.title}</span>
                    </div>

                    {onCreateFromReference && (
                      <button
                        type="button"
                        style={{
                          background: "rgba(14, 165, 233, 0.2)",
                          border: "none",
                          borderRadius: "3px",
                          padding: "1px 4px",
                          fontSize: "0.6rem",
                          fontWeight: 800,
                          color: "#0369a1",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "2px",
                          flexShrink: 0,
                        }}
                        title={`Usar "${refEv.title}" como inspiração para nova publicação`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateFromReference(key, refEv.title);
                        }}
                      >
                        <Sparkles size={9} />
                        <span>Inspirar</span>
                      </button>
                    )}
                  </div>
                ))}

                {dayPosts.slice(0, 3).map((post) => {
                  const isPostActive = post.id === selectedId;
                  return (
                    <div
                      key={post.id}
                      draggable={!isSelectMode}
                      onDragStart={(e) => handlePostDragStart(e, post)}
                      className={`
                        ${styles.postPill}
                        ${isPostActive ? styles.postPillActive : ""}
                        ${post.isExtra ? styles.postPillExtra : ""}
                      `.trim()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelectMode) {
                          handleToggleDateSelection(key);
                        } else {
                          onSelect(post);
                        }
                      }}
                      title={`${post.title || "Publicação"} (${post.type})`}
                    >
                      <span className={styles.postTypeTag}>{post.type}</span>
                      <span className={styles.postTitle}>
                        {post.title || post.profile || "Publicação"}
                      </span>
                    </div>
                  );
                })}

                {count > 3 && (
                  <div className={styles.morePostsLabel}>
                    +{count - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de Criação em Lote Flutuante */}
      {isSelectMode && selectedDates.length > 0 && (
        <BatchActionBar
          selectedDays={selectedDates}
          onClearDays={() => setSelectedDates([])}
          onCreateBatch={(dates, type) => {
            onCreateBatch?.(dates, type);
            setIsSelectMode(false);
          }}
          availableProfiles={availableProfiles}
        />
      )}
    </div>
  );
}
