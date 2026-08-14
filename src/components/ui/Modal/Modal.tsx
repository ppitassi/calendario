"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { IconButton } from "../IconButton/IconButton";
import styles from "./Modal.module.css";

export type ModalProps = { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; labelledBy?: string; className?: string; dismissible?: boolean };

export function Modal({ open, onClose, title, children, labelledBy, className, dismissible = true }: ModalProps) {
  const generated = useId();
  const titleId = labelledBy || generated;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose();
      if (event.key !== "Tab" || !ref.current) return;
      const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')?.focus());
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [open, onClose, dismissible]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && dismissible && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} className={cn(styles.dialog, className)}>
        {title ? <header className={styles.header}><h2 id={titleId} className={styles.title}>{title}</h2>{dismissible ? <IconButton label="Fechar" onClick={onClose}><X /></IconButton> : null}</header> : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
