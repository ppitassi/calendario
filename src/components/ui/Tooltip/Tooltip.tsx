"use client";

import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.css";

export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement<any> }) {
  const id = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const show = (target: EventTarget) => {
    const rect = (target as HTMLElement).getBoundingClientRect();
    setPosition({ left: Math.max(12, Math.min(innerWidth - 12, rect.left + rect.width / 2)), top: rect.top > 60 ? rect.top - 8 : rect.bottom + 32 });
  };
  if (!isValidElement(children)) return children;
  const child = children as ReactElement<any>;
  const trigger = cloneElement(child, {
    "aria-describedby": id,
    onPointerEnter: (event: any) => { child.props.onPointerEnter?.(event); if (!matchMedia("(pointer:coarse)").matches) show(event.currentTarget); },
    onPointerLeave: (event: any) => { child.props.onPointerLeave?.(event); setPosition(null); },
    onFocus: (event: any) => { child.props.onFocus?.(event); show(event.currentTarget); },
    onBlur: (event: any) => { child.props.onBlur?.(event); setPosition(null); },
  });
  return <>{trigger}{position && typeof document !== "undefined" ? createPortal(<div id={id} role="tooltip" className={styles.tooltip} style={position}>{content}</div>, document.body) : null}</>;
}
