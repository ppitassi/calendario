import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import styles from "./LiquidTooltipLayer.module.css";

type Tooltip = { text: string; left: number; top: number } | null;

export function LiquidTooltipLayer() {
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  useEffect(() => {
    const hydrate = (root: ParentNode = document) => root.querySelectorAll<HTMLElement>("[title]").forEach(element => { const title = element.getAttribute("title"); if (!title) return; element.dataset.liquidTooltip = title; element.removeAttribute("title"); });
    hydrate();
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node instanceof HTMLElement) { if (node.title) { node.dataset.liquidTooltip = node.title; node.removeAttribute("title"); } hydrate(node); } })));
    observer.observe(document.body, { childList: true, subtree: true });
    const show = (target: EventTarget | null) => { const element = (target as HTMLElement | null)?.closest<HTMLElement>("[data-liquid-tooltip]"); if (!element || matchMedia("(pointer: coarse)").matches) return; const rect = element.getBoundingClientRect(); setTooltip({ text: element.dataset.liquidTooltip || "", left: Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2)), top: rect.top > 64 ? rect.top - 10 : rect.bottom + 10 }); };
    const hide = () => setTooltip(null);
    const over = (event: PointerEvent) => show(event.target); const focus = (event: FocusEvent) => show(event.target);
    document.addEventListener("pointerover", over); document.addEventListener("pointerout", hide); document.addEventListener("focusin", focus); document.addEventListener("focusout", hide); window.addEventListener("scroll", hide, true);
    return () => { observer.disconnect(); document.removeEventListener("pointerover", over); document.removeEventListener("pointerout", hide); document.removeEventListener("focusin", focus); document.removeEventListener("focusout", hide); window.removeEventListener("scroll", hide, true); };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{tooltip && <motion.div role="tooltip" initial={{ opacity: 0, y: 4, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 2, scale: .98 }} style={{ left: tooltip.left, top: tooltip.top }} className={styles.tooltip}>{tooltip.text}</motion.div>}</AnimatePresence>, document.body);
}
