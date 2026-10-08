"use client";

import React, { useEffect } from "react";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { MonthlyCalendarGrid } from "./MonthlyCalendarGrid";
import type { ContentItem, ContentType } from "@/lib/types";
import styles from "./MonthlyCalendarDrawer.module.css";

interface MonthlyCalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  brandName?: string;
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

export function MonthlyCalendarDrawer({
  isOpen,
  onClose,
  brandName,
  month,
  items,
  selectedId,
  postingDays,
  weekdayFormats,
  onMonthChange,
  onSelect,
  onCreate,
  onCreateFromReference,
  onCreateBatch,
  onMovePost,
  onMoveDayPosts,
  onReorderPosts,
  onUpdatePostingDays,
  onUpdateWeekdayFormat,
  availableProfiles,
}: MonthlyCalendarDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.calendarIconBadge}>
              <CalendarIcon size={16} />
            </div>
            <div className={styles.titleArea}>
              <h3 className={styles.drawerTitle}>
                {brandName ? `Calendário de ${brandName}` : "Calendário do Ciclo"}
              </h3>
              <span className={styles.drawerSub}>
                Navegue pelas datas e selecione publicações para o workspace
              </span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              title="Fechar calendário"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <MonthlyCalendarGrid
            month={month}
            items={items}
            selectedId={selectedId}
            postingDays={postingDays}
            weekdayFormats={weekdayFormats}
            onMonthChange={onMonthChange}
            onSelect={(item) => {
              onSelect(item);
              onClose();
            }}
            onCreate={onCreate}
            onCreateFromReference={onCreateFromReference}
            onCreateBatch={onCreateBatch}
            onMovePost={onMovePost}
            onMoveDayPosts={onMoveDayPosts}
            onReorderPosts={onReorderPosts}
            onUpdatePostingDays={onUpdatePostingDays}
            onUpdateWeekdayFormat={onUpdateWeekdayFormat}
            availableProfiles={availableProfiles}
          />
        </div>
      </div>
    </div>
  );
}
