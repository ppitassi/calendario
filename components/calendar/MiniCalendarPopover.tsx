"use client";

import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth, dateKey } from "@/lib/date";
import type { ContentItem } from "@/lib/types";
import styles from "./MiniCalendarPopover.module.css";

interface MiniCalendarPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  month: Date;
  onMonthChange: (date: Date) => void;
  items: ContentItem[];
  selectedDate?: string | null;
  onSelectDate: (dateStr: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

// Dias da semana: Segunda a Domingo (padrão Brasil/Apple)
const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function MiniCalendarPopover({
  isOpen,
  onClose,
  month,
  onMonthChange,
  items,
  selectedDate,
  onSelectDate,
}: MiniCalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  // Dias no mês atual
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Primeiro dia da semana no mês (0 = domingo, 1 = segunda, etc.)
  const firstDayRaw = new Date(year, monthIndex, 1).getDay();
  // Ajuste para Segunda-feira ser o índice 0 (Seg=0, Ter=1 ... Dom=6)
  const firstDayCol = (firstDayRaw + 6) % 7;

  // Mapa de contagem de publicações por data YYYY-MM-DD
  const postCountByDate: Record<string, number> = {};
  items.forEach((it) => {
    if (it.date) {
      postCountByDate[it.date] = (postCountByDate[it.date] || 0) + 1;
    }
  });

  const todayKey = dateKey(new Date());

  // Navegar para mês anterior / próximo
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMonthChange(shiftMonth(month, -1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMonthChange(shiftMonth(month, 1));
  };

  const handleDayClick = (dayNum: number) => {
    const dStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    onSelectDate(dStr);
  };

  return (
    <div className={styles.popoverAnchor} ref={popoverRef}>
      <div className={styles.popoverCard}>
        {/* Header Compacto de Navegação do Mês */}
        <div className={styles.header}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={handlePrev}
            title="Mês anterior"
          >
            <ChevronLeft size={14} />
          </button>

          <span className={styles.monthTitle}>{monthLabel(month)}</span>

          <button
            type="button"
            className={styles.navBtn}
            onClick={handleNext}
            title="Próximo mês"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Linha dos Dias da Semana */}
        <div className={styles.weekdaysRow}>
          {WEEKDAYS.map((wd, i) => (
            <span key={i} className={styles.weekday}>
              {wd}
            </span>
          ))}
        </div>

        {/* Grid dos Dias do Mês */}
        <div className={styles.daysGrid}>
          {/* Espaços vazios antes do 1º dia */}
          {Array.from({ length: firstDayCol }).map((_, i) => (
            <div key={`empty-${i}`} className={styles.emptyCell} />
          ))}

          {/* Células de cada dia do mês */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const count = postCountByDate[dayStr] || 0;
            const isToday = dayStr === todayKey;
            const isSelected = selectedDate === dayStr;

            return (
              <button
                key={dayNum}
                type="button"
                className={`${styles.dayBtn} ${isSelected ? styles.selected : ""} ${
                  isToday ? styles.today : ""
                } ${count > 0 ? styles.hasPosts : ""}`}
                onClick={() => handleDayClick(dayNum)}
                title={`${dayNum} de ${monthLabel(month)}${
                  count > 0 ? ` • ${count} ${count === 1 ? "peça" : "peças"}` : ""
                }`}
              >
                <span className={styles.dayNum}>{dayNum}</span>

                {/* Marcadores de publicação discretos (dots) */}
                {count > 0 && (
                  <span className={styles.dotContainer}>
                    {count === 1 && <span className={styles.dot} />}
                    {count === 2 && (
                      <>
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                      </>
                    )}
                    {count >= 3 && (
                      <>
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                      </>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
