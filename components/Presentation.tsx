"use client";
/** Ponto de entrada estável para a apresentação em tela cheia. */


import type { CalendarRecord, ContentItem } from "@/lib/types";
import { ViewerScreen } from "./presentation/ViewerScreen";

/** Adaptador que encaminha os dados do Studio para a tela completa de apresentação. */
export function Presentation({
  calendar,
  month,
  items,
  onClose,
  onMonthChange,
}: {
  calendar: CalendarRecord;
  month: Date;
  items: ContentItem[];
  onClose: () => void;
  onMonthChange?: (newMonth: Date) => void;
}) {
  return (
    <ViewerScreen
      calendar={calendar}
      month={month}
      items={items}
      onClose={onClose}
      onMonthChange={onMonthChange}
    />
  );
}
