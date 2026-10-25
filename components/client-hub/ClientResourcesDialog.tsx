"use client";
import { useEffect, useRef, useState } from "react";
import type { SafeUser } from "@/lib/types";
import { ClientHub } from "./ClientHub";
import styles from "./Hub.module.css";

/** Abre o contexto do cliente sem desmontar o editor ou perder a publicação selecionada. */
export function ClientResourcesDialog({ client, currentUser, section, calendarId, month, onClose, onApplied }: {
  client: { id: string; name: string }; currentUser: SafeUser; section: string;
  calendarId?: string; month?: string; onClose: () => void; onApplied?: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const close = () => { if (!dirty || window.confirm("Descartar alterações não salvas?")) onClose(); };
  return <dialog data-client-resources ref={dialog} className={styles.dialog} aria-label={`Recursos de ${client.name}`} onCancel={event => { event.preventDefault(); close(); }}>
    <header className={styles.dialogHeader}><strong>{client.name} · contexto do cliente</strong><button type="button" onClick={close}>Voltar ao trabalho</button></header>
    <ClientHub client={client} currentUser={currentUser} initialSection={section} calendarId={calendarId} month={month} onDirtyChange={setDirty} onApplied={onApplied} />
  </dialog>;
}
