import { useRef, useState } from "react";
import { monthKey } from "../../lib/date";
import type { CalendarRecord, ContentItem } from "../../lib/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseStudioPersistenceProps {
  calendar: CalendarRecord | null;
  customProfiles: string[];
  month: Date;
  addNotification: (message: string) => void;
}

export function useStudioPersistence({
  calendar,
  customProfiles,
  month,
  addNotification,
}: UseStudioPersistenceProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<{
    items: ContentItem[];
    cal: any;
    postingDays: number[];
    weekdayFormats: any;
    profiles?: string[];
  } | null>(null);

  const performSave = async (
    targetItems: ContentItem[],
    targetCal: any,
    targetPostingDays: number[],
    targetWeekdayFormats: any,
    targetProfiles: string[] = customProfiles
  ) => {
    if (!calendar) return;

    const seen = new Set<string>();
    const cleanItems = targetItems.map((it) => {
      let id = it.id ? String(it.id).trim() : "";
      if (!id || seen.has(id)) {
        id = crypto.randomUUID();
      }
      seen.add(id);
      return { ...it, id };
    });

    const baseProfiles = targetProfiles !== undefined ? targetProfiles : customProfiles;
    const profilesToSave = Array.from(
      new Set([
        ...(baseProfiles || []),
        ...(cleanItems.map((it) => it.profile?.trim()).filter(Boolean) as string[]),
        ...(cleanItems.map((it) => it.collabProfile?.trim()).filter(Boolean) as string[]),
      ])
    ).filter(Boolean);

    try {
      const res = await fetch(`/api/calendars/${calendar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: targetCal?.title,
          month: monthKey(month),
          brand: targetCal?.brand,
          project: targetCal?.project,
          accent: targetCal?.accent,
          strategy: targetCal?.strategy,
          audience: targetCal?.audience,
          objective: targetCal?.objective,
          status: targetCal?.status,
          assignedToId: targetCal?.assigned_to_id,
          postingDays: targetPostingDays,
          weekdayFormats: targetWeekdayFormats,
          items: cleanItems,
          profiles: profilesToSave,
          is_pre_calendar: targetCal
            ? (Boolean(
                Number(targetCal.is_pre_calendar) === 1 ||
                targetCal.is_pre_calendar === true ||
                targetCal.is_pre_calendar === "1" ||
                Number(targetCal.isPreCalendar) === 1 ||
                targetCal.isPreCalendar === true ||
                Number(targetCal.client_has_pre_calendar) === 1 ||
                targetCal.client_has_pre_calendar === true
              ) ? 1 : 0)
            : undefined,
        }),
      });

      if (!res.ok) {
        setSaveStatus("error");
        const data = await res.json().catch(() => ({}));
        addNotification(data.error || "Erro ao salvar alterações no banco de dados.");
      } else {
        setSaveStatus("saved");
        setTimeout(() => {
          setSaveStatus((curr) => (curr === "saved" ? "idle" : curr));
        }, 2000);
      }
    } catch {
      setSaveStatus("error");
      addNotification("Erro de conexão ao tentar sincronizar as alterações.");
    }
  };

  const saveChanges = async (
    items: ContentItem[],
    updatedCal = calendar,
    postingDays: number[] = [],
    weekdayFormats: any = {},
    updatedProfiles = customProfiles
  ) => {
    if (!calendar) return;

    setSaveStatus("saving");

    if (isSavingRef.current) {
      pendingSaveRef.current = {
        items,
        cal: updatedCal,
        postingDays,
        weekdayFormats,
        profiles: updatedProfiles,
      };
      return;
    }

    isSavingRef.current = true;
    try {
      await performSave(items, updatedCal, postingDays, weekdayFormats, updatedProfiles);
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        const next = pendingSaveRef.current;
        pendingSaveRef.current = null;
        saveChanges(next.items, next.cal, next.postingDays, next.weekdayFormats, next.profiles);
      }
    }
  };

  return {
    saveChanges,
    performSave,
    saveStatus,
  };
}
