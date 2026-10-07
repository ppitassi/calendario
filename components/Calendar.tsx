"use client";
/** Calendário mensal que seleciona publicações e configura a cadência semanal. */

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Move,
  Sparkles,
  Kanban,
  List,
} from "lucide-react";
import { dateKey, monthLabel, shiftMonth } from "../lib/date";
import { buildItemsTaskMetaMap } from "../lib/utils";
import type { ContentItem, ContentType } from "../lib/types";
import { CalendarDayPanel } from "./calendar/CalendarDayPanel";
import { PostingCadence } from "./calendar/PostingCadence";

const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];

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
  onReorderPosts,
  onUpdatePostingDays,
  onUpdateWeekdayFormat,
  onClearMonth,
  onViewExtras,
  onViewModeChange,
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
  onReorderPosts?: (sourcePostId: string, targetPostId: string, position?: "before" | "after") => void;
  onUpdatePostingDays?: (days: number[]) => void;
  onUpdateWeekdayFormat?: (day: number, format: ContentType) => void;
  onClearMonth?: () => void;
  onViewExtras?: () => void;
  onViewModeChange?: (mode: "calendar" | "extras" | "kanban" | "list") => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const taskMetaMap = useMemo(() => buildItemsTaskMetaMap(items), [items]);

  const selectedItem = items.find((i) => i.id === selectedId);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => selectedItem ? selectedItem.date : null);

  const [dragSource, setDragSource] = useState<{
    type: "day" | "post";
    sourceDate: string;
    postId?: string;
    postIds?: string[];
    label?: string;
  } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverPostId, setDragOverPostId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);

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

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOverDate(null);
    setDragOverPostId(null);
    setDragOverPosition(null);
  };

  const handleCellDragOver = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== targetDate) {
      setDragOverDate(targetDate);
    }
  };

  const handleCellDragLeave = (e: React.DragEvent, targetDate: string) => {
    const related = e.relatedTarget as HTMLElement;
    if (!related || !e.currentTarget.contains(related)) {
      if (dragOverDate === targetDate) {
        setDragOverDate(null);
      }
    }
  };

  const handleCellDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    setDragSource(null);

    let data: any = dragSource;
    if (!data) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) data = JSON.parse(raw);
      } catch {}
    }

    if (!data) return;

    if (data.type === "post" && data.postId) {
      if (data.sourceDate !== targetDate) {
        onMovePost?.(data.postId, targetDate);
      }
    } else if (data.type === "day" && data.sourceDate) {
      if (data.sourceDate !== targetDate) {
        onMoveDayPosts?.(data.sourceDate, targetDate);
      }
    }
  };

  const handlePostTabDragOver = (e: React.DragEvent, targetPostId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";

    if (dragOverPostId !== targetPostId || dragOverPosition !== position) {
      setDragOverPostId(targetPostId);
      setDragOverPosition(position);
    }
  };

  const handlePostTabDragLeave = (e: React.DragEvent, targetPostId: string) => {
    e.stopPropagation();
    const related = e.relatedTarget as HTMLElement;
    if (!related || !e.currentTarget.contains(related)) {
      if (dragOverPostId === targetPostId) {
        setDragOverPostId(null);
        setDragOverPosition(null);
      }
    }
  };

  const handlePostTabDrop = (e: React.DragEvent, targetPost: ContentItem) => {
    e.preventDefault();
    e.stopPropagation();

    const currentPos = dragOverPosition;
    setDragOverPostId(null);
    setDragOverPosition(null);
    setDragSource(null);

    let data: any = dragSource;
    if (!data) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) data = JSON.parse(raw);
      } catch {}
    }

    if (!data || data.type !== "post" || !data.postId || data.postId === targetPost.id) return;

    onReorderPosts?.(data.postId, targetPost.id, currentPos || "before");
  };

  useEffect(() => {
    if (selectedItem && selectedItem.date !== selectedDate) {
      setSelectedDate(selectedItem.date);
    }
  }, [selectedId, selectedItem]);

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

  const selectedDayPosts = useMemo(() => {
    if (!selectedDate) return [];
    return postsByDate.get(selectedDate) || [];
  }, [postsByDate, selectedDate]);

  const handleToggleWeekday = (dayNum: number) => {
    if (!onUpdatePostingDays) return;
    const count = postingDays.filter((d) => d === dayNum).length;
    let nextCount = count + 1;
    if (nextCount > 3) nextCount = 0;

    const otherDays = postingDays.filter((d) => d !== dayNum);
    const updated = [...otherDays, ...Array(nextCount).fill(dayNum)].sort((a, b) => a - b);
    onUpdatePostingDays(updated);
  };

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
      <div className="panelTitle">
        <span>Calendário Editorial</span>
      </div>

      <section className="monthSurface">
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
                {dayPosts.some((p) => p.isExtra) && (
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "2px",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--accent, #ef5d3d)",
                    }}
                    title="Contém Arte Extra"
                  />
                )}
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

      {selectedDate && (
        <CalendarDayPanel
          selectedDate={selectedDate}
          selectedId={selectedId}
          selectedDayPosts={selectedDayPosts}
          taskMetaMap={taskMetaMap}
          dragSource={dragSource}
          dragOverPostId={dragOverPostId}
          dragOverPosition={dragOverPosition}
          onSelect={onSelect}
          onCreate={onCreate}
          onReorderPosts={onReorderPosts}
          onPostTabDragStart={handlePostTabDragStart}
          onDragEnd={handleDragEnd}
          onPostTabDragOver={handlePostTabDragOver}
          onPostTabDragLeave={handlePostTabDragLeave}
          onPostTabDrop={handlePostTabDrop}
        />
      )}

      {onViewModeChange && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 10px",
            background: "var(--surface-soft, #f8fafc)",
            border: "1px solid var(--border-soft, #e2e8f0)",
            borderRadius: "8px",
            marginBottom: "12px",
            gap: "6px",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted, #94a3b8)",
            }}
          >
            Modos:
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={() => onViewModeChange("kanban")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                color: "var(--ink, #1e293b)",
                transition: "all 0.15s ease",
              }}
              title="Alternar para visão Kanban"
            >
              <Kanban size={12} />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                color: "var(--ink, #1e293b)",
                transition: "all 0.15s ease",
              }}
              title="Alternar para visão em Lista"
            >
              <List size={12} />
              <span>Lista</span>
            </button>
          </div>
        </div>
      )}

      <PostingCadence
        postingDays={postingDays}
        weekdayFormats={weekdayFormats}
        totalItemsCount={items.length}
        itemsWithArtCount={items.filter((i) => Boolean(i.imageUrl)).length}
        onToggleWeekday={handleToggleWeekday}
        onUpdateWeekdayFormat={onUpdateWeekdayFormat}
      />

      {items.filter((it) => Boolean(it.isExtra)).length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "rgba(239, 93, 61, 0.08)",
            border: "1px solid rgba(239, 93, 61, 0.22)",
            borderRadius: "8px",
            fontSize: "12px",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Sparkles size={13} style={{ color: "var(--accent, #ef5d3d)" }} />
            <strong style={{ color: "var(--ink)" }}>Artes Extras:</strong>
            <span
              style={{
                background: "var(--accent, #ef5d3d)",
                color: "#ffffff",
                fontSize: "10px",
                fontWeight: 800,
                padding: "1px 6px",
                borderRadius: "999px",
              }}
            >
              {items.filter((it) => Boolean(it.isExtra)).length}
            </span>
          </div>
          {onViewExtras && (
            <button
              type="button"
              onClick={onViewExtras}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent, #ef5d3d)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                padding: "2px 4px",
                textDecoration: "underline",
              }}
            >
              Ver na aba
            </button>
          )}
        </div>
      )}

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
