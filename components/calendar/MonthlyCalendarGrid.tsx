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
import { DayActionMenu } from "./DayActionMenu";
import { PostingCadence } from "./PostingCadence";
import { Sliders } from "lucide-react";
import { useHotkeys } from "@/lib/hotkeys";
import styles from "../MonthlyCalendarGrid.module.css";

// 7 colunas: Segunda a Domingo (conforme Seção 4.1 do plano técnico)
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface MonthlyCalendarGridProps {
  month: Date;
  items: ContentItem[];
  selectedId: string | null;
  postingDays?: number[];
  weekdayFormats?: Record<number, ContentType>;
  onMonthChange: (date: Date) => void;
  onSelect: (item: ContentItem) => void;
  onCreate: (date: string, type?: ContentType, profile?: string) => void;
  onCreateFromReference?: (date: string, title: string) => void;
  onCreateBatch?: (dates: string[], type: ContentType) => void;
  onMovePost?: (postId: string, targetDate: string) => void;
  onMoveDayPosts?: (sourceDate: string, targetDate: string) => void;
  onReorderPosts?: (sourcePostId: string, targetPostId: string, position?: "before" | "after") => void;
  onUpdatePostingDays?: (days: number[]) => void;
  onUpdateWeekdayFormat?: (day: number, format: ContentType) => void;
  availableProfiles?: string[];
}

export function MonthlyCalendarGrid({
  month,
  items,
  selectedId,
  postingDays = [],
  weekdayFormats = {},
  onMonthChange,
  onSelect,
  onCreate,
  onCreateFromReference,
  onCreateBatch,
  onMovePost,
  onMoveDayPosts,
  onUpdatePostingDays,
  onUpdateWeekdayFormat,
  availableProfiles = [],
}: MonthlyCalendarGridProps) {
  // Modo de seleção múltipla de dias para lote (desktop e touch)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [activeMenuDate, setActiveMenuDate] = useState<string | null>(null);
  const [showCadenceDrawer, setShowCadenceDrawer] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [lastClickedDate, setLastClickedDate] = useState<string | null>(null);

  // Drag and Drop
  const [dragSource, setDragSource] = useState<{
    type: "day" | "post";
    sourceDate: string;
    postId?: string;
  } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Referências editoriais / Feriados
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
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDayOfWeek = (new Date(year, monthIdx, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIdx, 0).getDate();

  // Configuração dinâmica de teclas de atalho (Settings)
  const { matchesModifier, hotkeys } = useHotkeys();

  // Todos os dias do mês atual como array ordenado
  const allCurrentMonthDates = useMemo(() => {
    const list: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(dateKey(new Date(year, monthIdx, d)));
    }
    return list;
  }, [year, monthIdx, daysInMonth]);

  const togglePostingDayForDate = (key: string) => {
    if (!onUpdatePostingDays) return;
    const [y, m, d] = key.split("-").map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const count = postingDays.filter((wd) => wd === dayOfWeek).length;
    let nextDays: number[];
    if (count === 0) {
      nextDays = [...postingDays, dayOfWeek].sort((a, b) => a - b);
    } else {
      nextDays = postingDays.filter((wd) => wd !== dayOfWeek);
    }
    onUpdatePostingDays(nextDays);
  };

  const handleToggleDateSelection = (key: string) => {
    if (selectedDates.includes(key)) {
      setSelectedDates(selectedDates.filter((d) => d !== key));
    } else {
      setSelectedDates([...selectedDates, key]);
    }
  };

  // Clique em dia seguindo a especificação: SELECIONAR -> CONTEXTUALIZAR -> AGIR
  // Respeita a tecla configurada em Settings (Ctrl por padrão, ou Alt/Shift/Cmd conforme hotkey)
  const handleDayClick = (e: React.MouseEvent, key: string) => {
    const isMultiSelectModifier =
      matchesModifier(e, "multi_select_click") || e.ctrlKey || e.metaKey;
    const isRangeSelectModifier =
      matchesModifier(e, "range_select_click") || e.shiftKey;

    // Multi-seleção de intervalo contínuo
    if (isRangeSelectModifier && lastClickedDate) {
      const idxA = allCurrentMonthDates.indexOf(lastClickedDate);
      const idxB = allCurrentMonthDates.indexOf(key);
      if (idxA !== -1 && idxB !== -1) {
        const start = Math.min(idxA, idxB);
        const end = Math.max(idxA, idxB);
        const range = allCurrentMonthDates.slice(start, end + 1);
        const merged = Array.from(new Set([...selectedDates, ...range]));
        setSelectedDates(merged);
        setLastClickedDate(key);
        return;
      }
    }

    // Multi-seleção individual com Ctrl / Cmd ou tecla configurada
    if (isMultiSelectModifier || isSelectMode) {
      handleToggleDateSelection(key);
      setLastClickedDate(key);
      return;
    }

    // Clique simples: apenas seleciona o dia e abre o menu de contexto Apple-like
    setSelectedDates([key]);
    setLastClickedDate(key);
    setActiveMenuDate(key);
  };

  // Escuta atalhos de teclado do calendário
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campos de formulário
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      // Atalho para nova publicação rápida (Ctrl + N)
      if (matchesModifier(e, "new_post_shortcut") && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const defaultDay = selectedDates[0] || dateKey(new Date(year, monthIdx, 1));
        setActiveMenuDate(defaultDay);
      }

      // Atalho para alternar modo seleção (Ctrl + S)
      if (matchesModifier(e, "toggle_select_mode") && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsSelectMode((prev) => !prev);
      }

      // Atalho para rotina semanal (Ctrl + R)
      if (matchesModifier(e, "toggle_routine") && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setShowCadenceDrawer((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [matchesModifier, selectedDates, year, monthIdx]);


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
      {/* Toolbar nativa Apple-like: ‹ Mês Ano ›  Hoje  |  Rotina  Selecionar  + */}
      <div className={styles.toolbar}>
        <div className={styles.monthControls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            title="Mês anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <strong className={styles.monthTitle}>{monthLabel(month)}</strong>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            title="Próximo mês"
          >
            <ChevronRight size={15} />
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
          {onUpdatePostingDays && (
            <button
              type="button"
              className={`${styles.modeBtn} ${showCadenceDrawer ? styles.modeBtnActive : ""}`}
              onClick={() => setShowCadenceDrawer(!showCadenceDrawer)}
              title="Configurar rotina semanal de postagem e formatos padrão"
            >
              <Sliders size={13} />
              <span>Rotina</span>
            </button>
          )}

          <button
            type="button"
            className={`${styles.modeBtn} ${isSelectMode ? styles.modeBtnActive : ""}`}
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedDates([]);
            }}
          >
            <CheckSquare size={13} />
            <span>{isSelectMode ? "Concluir" : "Selecionar"}</span>
          </button>

          <button
            type="button"
            className={styles.actionPlusBtn}
            onClick={() => {
              const defaultDay = selectedDates[0] || dateKey(new Date(year, monthIdx, 1));
              setActiveMenuDate(defaultDay);
            }}
            title="Nova publicação"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Gaveta de Rotina de Postagem */}
      {showCadenceDrawer && onUpdatePostingDays && (
        <div style={{ marginBottom: "10px", animation: "dayMenuFadeIn 0.15s ease" }}>
          <PostingCadence
            postingDays={postingDays}
            weekdayFormats={weekdayFormats}
            totalItemsCount={items.length}
            itemsWithArtCount={items.filter((i) => Boolean(i.imageUrl)).length}
            onToggleWeekday={(day) => {
              const count = postingDays.filter((d) => d === day).length;
              let nextDays: number[];
              if (count === 0) {
                nextDays = [...postingDays, day].sort((a, b) => a - b);
              } else {
                nextDays = postingDays.filter((d) => d !== day);
              }
              onUpdatePostingDays(nextDays);
            }}
            onUpdateWeekdayFormat={onUpdateWeekdayFormat}
          />
        </div>
      )}

      {/* Cabeçalho dos Dias da Semana (28px de altura) */}
      <div className={styles.weekdaysHeader}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} className={styles.weekdayCol}>
            {wd}
          </div>
        ))}
      </div>

      {/* Grade Mensal Compacta */}
      <div className={styles.daysGrid}>
        {/* Dias do mês anterior: células normais porém com opacidade discreta */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => {
          const dayNum = prevMonthDays - firstDayOfWeek + i + 1;
          return (
            <div key={`prev-${i}`} className={`${styles.dayCell} ${styles.outsideMonth}`}>
              <div className={styles.cellHeader}>
                <span className={styles.dayNum}>{dayNum}</span>
              </div>
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
          const dayOfWeek = (firstDayOfWeek + i) % 7;
          // domingo = 0, segunda = 1 ... sábado = 6
          const actualDayOfWeek = new Date(year, monthIdx, dayNum).getDay();
          const isCadenceDay = postingDays.includes(actualDayOfWeek);

          const holidays = referencesByDate.get(key) || [];

          return (
            <div
              key={key}
              className={`
                ${styles.dayCell}
                ${isSelected ? styles.daySelected : ""}
                ${isDropTarget ? styles.dayDropTarget : ""}
              `.trim()}
              onClick={(e) => handleDayClick(e, key)}
              onDragOver={(e) => handleCellDragOver(e, key)}
              onDrop={(e) => handleCellDrop(e, key)}
            >
              <div className={styles.cellHeader}>
                <div className={styles.dayNumContainer}>
                  <span className={styles.dayNum}>{dayNum}</span>
                  {/* Indicador extremamente discreto de dia de postagem padrão (ex: 17 •) */}
                  {isCadenceDay && (
                    <span
                      className={styles.cadenceDot}
                      title="Dia padrão de postagem da rotina"
                    />
                  )}
                </div>

                {count > 0 && (
                  <span className={styles.postsBadge}>
                    {count} {count === 1 ? "post" : "posts"}
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

              {/* Lista de publicações e feriados discretos */}
              <div className={styles.cellPostsList}>
                {/* Feriados: metadados limpos e discretos (sem botões de IA gritando) */}
                {holidays.map((refEv: any) => (
                  <div
                    key={refEv.externalKey || refEv.title}
                    className={styles.holidayItem}
                    title={`${refEv.title} (Clique para opções)`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Abre o menu para contextualizar o feriado, sem criar nada automaticamente
                      setSelectedDates([key]);
                      setActiveMenuDate(key);
                    }}
                  >
                    <span className={styles.holidayDot} />
                    <span className={styles.holidayTitle}>{refEv.title}</span>
                  </div>
                ))}

                {/* Linhas compactas de publicação (24-28px) */}
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

      {/* Barra de Seleção Múltipla Flutuante estilo Apple */}
      {selectedDates.length > 1 && (
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

      {/* Menu Contextual ao clicar em qualquer dia */}
      {activeMenuDate && (
        <DayActionMenu
          date={activeMenuDate}
          dayPosts={postsByDate.get(activeMenuDate) || []}
          referenceEvents={referencesByDate.get(activeMenuDate) || []}
          availableProfiles={availableProfiles}
          isPostingDay={postingDays.includes(
            new Date(
              parseInt(activeMenuDate.split("-")[0], 10),
              parseInt(activeMenuDate.split("-")[1], 10) - 1,
              parseInt(activeMenuDate.split("-")[2], 10)
            ).getDay()
          )}
          onTogglePostingDay={() => togglePostingDayForDate(activeMenuDate)}
          onClose={() => setActiveMenuDate(null)}
          onCreatePost={(type, profile) => {
            onCreate(activeMenuDate, type, profile);
            setActiveMenuDate(null);
          }}
          onCreateFromReference={
            onCreateFromReference
              ? (title) => {
                  onCreateFromReference(activeMenuDate, title);
                  setActiveMenuDate(null);
                }
              : undefined
          }
          onSelectPost={(post) => {
            onSelect(post);
            setActiveMenuDate(null);
          }}
        />
      )}
    </div>
  );
}
