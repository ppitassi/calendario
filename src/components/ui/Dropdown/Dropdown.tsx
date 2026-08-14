"use client";

import { cloneElement, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../lib/utils";
import styles from "./Dropdown.module.css";

export type DropdownItem = { id: string; label: ReactNode; disabled?: boolean };
export function Dropdown({ trigger, items, value, onSelect, label }: { trigger: ReactElement<any>; items: DropdownItem[]; value?: string; onSelect: (id: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const enabledItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not([disabled])') || []);
  const focusItem = (index: number) => {
    const nodes = enabledItems();
    if (!nodes.length) return;
    nodes[(index + nodes.length) % nodes.length]?.focus();
  };
  const positionMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(220, rect.width);
    const height = Math.min(360, items.length * 42 + 16);
    const top = innerHeight - rect.bottom >= height || rect.top < innerHeight - rect.bottom ? rect.bottom + 8 : Math.max(12, rect.top - height - 8);
    setPosition({ top, left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)), width });
  };
  useEffect(() => {
    if (!open) return;
    positionMenu();
    const focusFrame = requestAnimationFrame(() => {
      const nodes = enabledItems();
      const selected = nodes.findIndex(node => node.getAttribute("aria-checked") === "true");
      focusItem(selected >= 0 ? selected : 0);
    });
    const close = (event: MouseEvent) => { if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key); window.addEventListener("resize", positionMenu); window.addEventListener("scroll", positionMenu, true);
    return () => { cancelAnimationFrame(focusFrame); document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); window.removeEventListener("resize", positionMenu); window.removeEventListener("scroll", positionMenu, true); };
  }, [open, items.length]);
  const cloned = cloneElement(trigger, {
    ref: (node: HTMLElement) => { triggerRef.current = node; const original = (trigger as any).ref; if (typeof original === "function") original(node); else if (original) original.current = node; },
    "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": id,
    onClick: (event: any) => { trigger.props.onClick?.(event); setOpen(current => !current); },
    onKeyDown: (event: any) => {
      trigger.props.onKeyDown?.(event);
      if (event.defaultPrevented || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      setOpen(true);
    },
  });
  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const nodes = enabledItems();
    const current = nodes.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") { event.preventDefault(); focusItem(current + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); focusItem(current - 1); }
    else if (event.key === "Home") { event.preventDefault(); focusItem(0); }
    else if (event.key === "End") { event.preventDefault(); focusItem(nodes.length - 1); }
  };
  return <>{cloned}{open && typeof document !== "undefined" ? createPortal(<div ref={menuRef} id={id} role="menu" aria-label={label} style={position} className={styles.menu} onKeyDown={handleMenuKeyDown}>{items.map(item => <button key={item.id} type="button" role="menuitemradio" aria-checked={item.id === value} disabled={item.disabled} className={cn(styles.item, item.id === value && styles.active)} onClick={() => { onSelect(item.id); setOpen(false); triggerRef.current?.focus(); }}>{item.label}</button>)}</div>, document.body) : null}</>;
}
