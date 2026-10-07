"use client";

import { useMemo } from "react";
import { dateKey, monthKey } from "../../lib/date";
import { reconcilePostingDays } from "../../lib/cadence";
import type { CalendarRecord, ContentItem, ContentType } from "../../lib/types";
import { useStudioPersistence } from "./useStudioPersistence";

export interface UseStudioItemsProps {
  calendar: CalendarRecord | null;
  setCalendar: React.Dispatch<React.SetStateAction<CalendarRecord | null>>;
  items: ContentItem[];
  setItems: React.Dispatch<React.SetStateAction<ContentItem[]>>;
  postingDays: number[];
  setPostingDays: React.Dispatch<React.SetStateAction<number[]>>;
  weekdayFormats: Record<number, ContentType>;
  setWeekdayFormats: React.Dispatch<React.SetStateAction<Record<number, ContentType>>>;
  customProfiles: string[];
  setCustomProfiles: React.Dispatch<React.SetStateAction<string[]>>;
  month: Date;
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  addNotification: (message: string) => void;
}

export function useStudioItems({
  calendar,
  setCalendar,
  items,
  setItems,
  postingDays,
  setPostingDays,
  weekdayFormats,
  setWeekdayFormats,
  customProfiles,
  setCustomProfiles,
  month,
  selectedId,
  setSelectedId,
  addNotification,
}: UseStudioItemsProps) {
  const { saveChanges, saveStatus } = useStudioPersistence({
    calendar,
    customProfiles,
    month,
    addNotification,
  });

  const availableProfiles = useMemo(() => {
    const set = new Set<string>();
    customProfiles.forEach((p) => {
      if (p && p.trim()) set.add(p.trim());
    });
    items.forEach((it) => {
      if (it.profile && it.profile.trim()) set.add(it.profile.trim());
      if (it.collabProfile && it.collabProfile.trim()) set.add(it.collabProfile.trim());
    });
    return Array.from(set);
  }, [customProfiles, items]);

  const updateItem = (item: ContentItem) => {
    const updated = items.map((entry) => (entry.id === item.id ? item : entry));
    setItems(updated);
    saveChanges(updated, calendar, postingDays, weekdayFormats);
  };

  const handleUpdatePostingDays = async (newDays: number[]) => {
    if (!calendar) return;

    const defaultProfile = availableProfiles.length === 1 ? availableProfiles[0] : "";
    const finalizedAllItems = reconcilePostingDays(
      items,
      newDays,
      month,
      weekdayFormats,
      defaultProfile
    );

    setItems(finalizedAllItems);
    setPostingDays(newDays);

    if (!selectedId || !finalizedAllItems.some((it) => it.id === selectedId)) {
      const currentMonthPrefix = monthKey(month);
      const firstThisMonth = finalizedAllItems.find((it) => it.date.startsWith(currentMonthPrefix));
      if (firstThisMonth) {
        setSelectedId(firstThisMonth.id);
      }
    }

    const updatedCal = {
      ...calendar,
      posting_days: newDays,
      weekday_formats: weekdayFormats,
    };
    setCalendar(updatedCal);
    await saveChanges(finalizedAllItems, updatedCal, newDays, weekdayFormats);
  };

  const handleUpdateWeekdayFormat = async (dayNum: number, newFormat: ContentType) => {
    if (!calendar) return;
    const updatedFormats: Record<number, ContentType> = {
      ...weekdayFormats,
      [dayNum]: newFormat,
    };
    setWeekdayFormats(updatedFormats);

    const currentMonthPrefix = monthKey(month);
    const updatedItems = items.map((it) => {
      if (it.date.startsWith(currentMonthPrefix)) {
        try {
          const parts = it.date.split("-");
          const itemDayOfWeek = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getDay();
          const isBlankDraft =
            it.status === "Ideia" &&
            !it.imageUrl &&
            (it.title === "Publicação" || it.title === "Nova publicação") &&
            !it.caption &&
            !it.visual;
          if (itemDayOfWeek === dayNum && isBlankDraft) {
            return { ...it, type: newFormat };
          }
        } catch {}
      }
      return it;
    });

    setItems(updatedItems);
    const updatedCal = {
      ...calendar,
      weekday_formats: updatedFormats,
    };
    setCalendar(updatedCal);
    await saveChanges(updatedItems, updatedCal, postingDays, updatedFormats);
  };

  const handleCreateProfile = (newProfile: string) => {
    const clean = newProfile.trim().startsWith("@") ? newProfile.trim() : `@${newProfile.trim()}`;
    if (!clean || clean === "@") return;

    const isFirstProfile = availableProfiles.length === 0;
    const nextProfiles = customProfiles.includes(clean) ? customProfiles : [...customProfiles, clean];
    setCustomProfiles(nextProfiles);

    if (calendar?.client_id) {
      try {
        localStorage.setItem(`cp:profiles:${calendar.client_id}`, JSON.stringify(nextProfiles));
      } catch {}
    }

    if (isFirstProfile) {
      const updated = items.map((entry) => {
        const isDefault = !entry.title || entry.title === "Nova publicação" || entry.title === "Publicação";
        return {
          ...entry,
          profile: clean,
          title: isDefault
            ? entry.isCollab
              ? entry.collabProfile
                ? `${clean} + ${entry.collabProfile}`
                : `${clean} (Collab)`
              : clean
            : entry.title,
        };
      });
      setItems(updated);
      saveChanges(updated, calendar, postingDays, weekdayFormats, nextProfiles);
    } else {
      if (selectedId) {
        const updated = items.map((entry) => {
          if (entry.id === selectedId) {
            const isDefault =
              !entry.title ||
              entry.title === "Nova publicação" ||
              entry.title === "Publicação" ||
              (entry.profile && entry.title === entry.profile);
            return {
              ...entry,
              profile: clean,
              title: isDefault
                ? entry.isCollab
                  ? entry.collabProfile
                    ? `${clean} + ${entry.collabProfile}`
                    : `${clean} (Collab)`
                  : clean
                : entry.title,
            };
          }
          return entry;
        });
        setItems(updated);
        saveChanges(updated, calendar, postingDays, weekdayFormats, nextProfiles);
      } else {
        saveChanges(items, calendar, postingDays, weekdayFormats, nextProfiles);
      }
    }
  };

  const handleDeleteProfile = (profileToDelete: string) => {
    const clean = profileToDelete.trim();
    if (!clean) return;

    const nextProfiles = customProfiles.filter((p) => p !== clean);
    setCustomProfiles(nextProfiles);

    if (calendar?.client_id) {
      try {
        localStorage.setItem(`cp:profiles:${calendar.client_id}`, JSON.stringify(nextProfiles));
      } catch {}
    }

    let itemsChanged = false;
    const updated = items.map((entry) => {
      let changed = false;
      let newProfile = entry.profile;
      let newCollabProfile = entry.collabProfile;
      let newIsCollab = entry.isCollab;

      if (entry.profile === clean) {
        newProfile = "";
        changed = true;
      }
      if (entry.collabProfile === clean) {
        newCollabProfile = "";
        newIsCollab = false;
        changed = true;
      }

      if (!changed) return entry;
      itemsChanged = true;
      return {
        ...entry,
        profile: newProfile,
        collabProfile: newCollabProfile,
        isCollab: newIsCollab,
      };
    });

    if (itemsChanged) {
      setItems(updated);
      saveChanges(updated, calendar, postingDays, weekdayFormats, nextProfiles);
    } else {
      saveChanges(items, calendar, postingDays, weekdayFormats, nextProfiles);
    }
  };

  const createOn = (
    date = dateKey(new Date(month.getFullYear(), month.getMonth(), 1)),
    initialType?: ContentType,
    initialProfile?: string
  ) => {
    const defaultProfile =
      initialProfile !== undefined
        ? initialProfile
        : availableProfiles.length === 1
        ? availableProfiles[0]
        : "";
    let defaultType: ContentType = initialType || "Feed e Story";
    if (!initialType) {
      try {
        const parts = date.split("-");
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        defaultType = weekdayFormats[d.getDay()] || "Feed e Story";
      } catch {}
    }

    const newItem: ContentItem = {
      id: crypto.randomUUID(),
      date,
      title: defaultProfile || "Nova publicação",
      type: defaultType,
      status: "Ideia",
      channel: "Instagram",
      profile: defaultProfile,
      isCollab: false,
      collabProfile: "",
      objective: "",
      head: "",
      subhead: "",
      caption: "",
      visual: "",
      imageUrl: "",
      funnelStage: "Topo",
      internalNotes: "",
    };

    const nextItems = [...items, newItem];
    setItems(nextItems);
    setSelectedId(newItem.id);
    saveChanges(nextItems, calendar, postingDays, weekdayFormats);
  };

  /**
   * Cria publicação inspirada em uma data comemorativa ou feriado oficial.
   */
  const createFromReference = (date: string, referenceTitle: string) => {
    const defaultProfile = availableProfiles.length === 1 ? availableProfiles[0] : "";
    const newItem: ContentItem = {
      id: crypto.randomUUID(),
      date,
      title: `${referenceTitle}`,
      type: "Feed e Story",
      status: "Ideia",
      channel: "Instagram",
      profile: defaultProfile,
      isCollab: false,
      collabProfile: "",
      objective: `Tema editorial inspirado em "${referenceTitle}"`,
      head: referenceTitle,
      subhead: "",
      caption: `Celebração de ${referenceTitle}.`,
      visual: `Criativo temático em comemoração a ${referenceTitle}.`,
      imageUrl: "",
      funnelStage: "Topo",
      internalNotes: `Inspirado no evento de referência: ${referenceTitle}`,
    };

    const nextItems = [...items, newItem];
    setItems(nextItems);
    setSelectedId(newItem.id);
    saveChanges(nextItems, calendar, postingDays, weekdayFormats);
    addNotification(`Publicação inspirada em "${referenceTitle}" criada com sucesso!`);
    return newItem;
  };

  /**
   * Cria publicações em lote para datas selecionadas.
   * Regra V2: Para cada data, cria 1 publicação com o formato especificado.
   */
  const createBatchItems = (dates: string[], type: ContentType = "Feed e Story", profileOverride?: string) => {
    if (!dates || dates.length === 0) return [];
    const defaultProfile = profileOverride || (availableProfiles.length === 1 ? availableProfiles[0] : "");
    const newItems: ContentItem[] = dates.map((date) => ({
      id: crypto.randomUUID(),
      date,
      title: defaultProfile || "Nova publicação",
      type,
      status: "Ideia",
      channel: "Instagram",
      profile: defaultProfile,
      isCollab: false,
      collabProfile: "",
      objective: "",
      head: "",
      subhead: "",
      caption: "",
      visual: "",
      imageUrl: "",
      funnelStage: "Topo",
      internalNotes: "",
    }));

    const nextItems = [...items, ...newItems];
    setItems(nextItems);
    if (newItems.length > 0) {
      setSelectedId(newItems[0].id);
    }
    saveChanges(nextItems, calendar, postingDays, weekdayFormats);
    addNotification(`${newItems.length} publicações criadas em lote com formato ${type}!`);
    return newItems;
  };

  const createExtra = (format: string = "Banner", date?: string) => {
    const defaultProfile = availableProfiles.length === 1 ? availableProfiles[0] : "";
    const targetDate = date || dateKey(new Date(month.getFullYear(), month.getMonth(), 1));

    const newItem: ContentItem = {
      id: crypto.randomUUID(),
      date: targetDate,
      title: `${format} Extra`,
      type: "Feed e Story",
      status: "Ideia",
      channel: "Outro",
      profile: defaultProfile,
      isCollab: false,
      collabProfile: "",
      objective: "Demanda Extra / Avulsa",
      head: "",
      subhead: "",
      caption: "",
      visual: "",
      imageUrl: "",
      funnelStage: "Meio",
      internalNotes: "",
      isExtra: true,
      extraFormat: format,
    };

    const nextItems = [...items, newItem];
    setItems(nextItems);
    setSelectedId(newItem.id);
    saveChanges(nextItems, calendar, postingDays, weekdayFormats);
    addNotification(`Arte extra (${format}) criada com sucesso!`);
    return newItem;
  };

  const removeItem = (id: string) => {
    if (!window.confirm("Excluir esta publicação?")) return;
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    setSelectedId(null);
    saveChanges(updated, calendar, postingDays, weekdayFormats);
  };

  const handleMovePost = (postId: string, targetDate: string) => {
    const targetItem = items.find((it) => it.id === postId);
    if (!targetItem || targetItem.date === targetDate) return;

    const updated = items.map((it) =>
      it.id === postId ? { ...it, date: targetDate } : it
    );
    setItems(updated);
    setSelectedId(postId);
    saveChanges(updated, calendar, postingDays, weekdayFormats);
    addNotification(`Publicação movida para ${targetDate}!`);
  };

  const handleMoveDayPosts = (sourceDate: string, targetDate: string) => {
    if (sourceDate === targetDate) return;
    const postsInSource = items.filter((it) => it.date === sourceDate);
    if (postsInSource.length === 0) return;

    const updated = items.map((it) =>
      it.date === sourceDate ? { ...it, date: targetDate } : it
    );
    setItems(updated);
    setSelectedId(postsInSource[0].id);
    saveChanges(updated, calendar, postingDays, weekdayFormats);
    addNotification(
      postsInSource.length === 1
        ? `Publicação movida para ${targetDate}!`
        : `${postsInSource.length} publicações movidas para ${targetDate}!`
    );
  };

  const handleReorderPosts = (
    sourceId: string,
    targetId: string,
    position: "before" | "after" = "before"
  ) => {
    if (sourceId === targetId) return;
    const sourceIdx = items.findIndex((it) => it.id === sourceId);
    const targetIdx = items.findIndex((it) => it.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const sourceItem = items[sourceIdx];
    const targetItem = items[targetIdx];

    const sameDate = sourceItem.date === targetItem.date;
    const updatedSource = !sameDate ? { ...sourceItem, date: targetItem.date } : sourceItem;

    const remaining = items.filter((it) => it.id !== sourceId);
    const targetIdxInRemaining = remaining.findIndex((it) => it.id === targetId);
    if (targetIdxInRemaining === -1) return;

    const insertIdx = position === "before" ? targetIdxInRemaining : targetIdxInRemaining + 1;
    const reordered = [
      ...remaining.slice(0, insertIdx),
      updatedSource,
      ...remaining.slice(insertIdx),
    ];

    const datePosts = reordered.filter((it) => it.date === targetItem.date);
    const orderMap = new Map<string, number>();
    datePosts.forEach((it, idx) => {
      orderMap.set(it.id, idx);
    });

    const finalItems = reordered.map((it) => {
      if (it.date === targetItem.date && orderMap.has(it.id)) {
        return { ...it, orderIndex: orderMap.get(it.id) };
      }
      return it;
    });

    setItems(finalItems);
    setSelectedId(sourceId);
    saveChanges(finalItems, calendar, postingDays, weekdayFormats);
    addNotification("Ordem das publicações atualizada!");
  };

  const handleClearMonth = () => {
    const currentPrefix = monthKey(month);
    const remainingItems = items.filter((it) => !it.date.startsWith(currentPrefix));
    setItems(remainingItems);
    setSelectedId(null);
    setPostingDays([]);
    if (calendar) {
      const updatedCal = { ...calendar, posting_days: [] };
      setCalendar(updatedCal);
      saveChanges(remainingItems, updatedCal, []);
    }
  };

  return {
    availableProfiles,
    saveChanges,
    saveStatus,
    updateItem,
    handleUpdatePostingDays,
    handleUpdateWeekdayFormat,
    handleCreateProfile,
    handleDeleteProfile,
    createOn,
    createFromReference,
    createBatchItems,
    createExtra,
    removeItem,
    handleMovePost,
    handleMoveDayPosts,
    handleReorderPosts,
    handleClearMonth,
  };
}
