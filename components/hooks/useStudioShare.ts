"use client";

import { useState } from "react";
import type { CalendarRecord } from "../../lib/types";

export interface UseStudioShareProps {
  calendar: CalendarRecord | null;
  setCalendar: React.Dispatch<React.SetStateAction<CalendarRecord | null>>;
  addNotification: (message: string) => void;
}

export function useStudioShare({
  calendar,
  setCalendar,
  addNotification,
}: UseStudioShareProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [loadingShareToken, setLoadingShareToken] = useState(false);

  const handleOpenShareModal = async () => {
    if (!calendar?.id) return;
    setShowShareModal(true);
    setLoadingShareToken(true);
    try {
      const res = await fetch(`/api/calendars/${calendar.id}/share-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.shareToken) {
        const fullUrl = `${window.location.origin}/portal/${data.shareToken}`;
        setShareUrl(fullUrl);
      }
    } catch (e) {
      console.error("Erro ao gerar link de compartilhamento:", e);
    } finally {
      setLoadingShareToken(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  const handleGenerateNewToken = async () => {
    if (!calendar?.id) return;
    if (
      !confirm(
        "Gerar um novo link invalidará o link compartilhado anteriormente. Deseja continuar?"
      )
    )
      return;
    setLoadingShareToken(true);
    try {
      const res = await fetch(`/api/calendars/${calendar.id}/share-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew: true }),
      });
      const data = await res.json();
      if (data.shareToken) {
        const fullUrl = `${window.location.origin}/portal/${data.shareToken}`;
        setShareUrl(fullUrl);
      }
    } catch (e) {
      console.error("Erro ao gerar novo token:", e);
    } finally {
      setLoadingShareToken(false);
    }
  };

  const handleTogglePreCalendar = async () => {
    if (!calendar?.id) return;
    const anyCal = calendar as any;
    const currentVal = Boolean(
      Number(anyCal.is_pre_calendar) === 1 ||
        anyCal.is_pre_calendar === true ||
        anyCal.is_pre_calendar === "1" ||
        Number(anyCal.isPreCalendar) === 1 ||
        anyCal.isPreCalendar === true ||
        Number(anyCal.client_has_pre_calendar) === 1 ||
        anyCal.client_has_pre_calendar === true
    );
    const nextVal = !currentVal;
    const updatedCal: CalendarRecord = {
      ...calendar,
      is_pre_calendar: nextVal ? 1 : 0,
      isPreCalendar: nextVal,
      client_has_pre_calendar: nextVal ? 1 : 0,
    };
    setCalendar(updatedCal);
    try {
      await fetch(`/api/calendars/${calendar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_pre_calendar: nextVal ? 1 : 0,
          isPreCalendar: nextVal,
        }),
      });
      addNotification(
        nextVal
          ? "Modo Pré-calendário ativado: imagens omitidas para validação de copy."
          : "Modo Pré-calendário desativado: apresentação completa com artes visuais."
      );
    } catch (e) {
      console.error("Erro ao alterar status de pré-calendário:", e);
    }
  };

  return {
    showShareModal,
    setShowShareModal,
    shareUrl,
    copiedShareLink,
    loadingShareToken,
    handleOpenShareModal,
    handleCopyShareLink,
    handleGenerateNewToken,
    handleTogglePreCalendar,
  };
}
