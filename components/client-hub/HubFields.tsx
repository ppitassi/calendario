"use client";
import { useId, type ReactNode } from "react";
import styles from "./Hub.module.css";
/** Campos controlados com rótulo nativo para teclado, leitor de tela e testes de fluxo. */
export function Field({ label, value, onChange, multiline = false, type = "text", required = false, min, max, step, maxLength = 8000 }: {
  label: string; value: string | number; onChange: (value: string) => void;
  multiline?: boolean; type?: string; required?: boolean; min?: number; max?: number; step?: string; maxLength?: number;
}) {
  const id = useId();
  return <div className={styles.field}><label htmlFor={id}>{label}</label>
    {multiline ? <textarea id={id} value={value} onChange={e => onChange(e.target.value)} required={required} maxLength={maxLength} />
      : <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} required={required} min={min} max={max} step={step} maxLength={maxLength} />}
  </div>;
}
export function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = useId();
  return <div className={styles.field}><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => onChange(e.target.value)}>{children}</select></div>;
}
export function PublishCheck({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.check}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />Exibir no portal do cliente</label>;
}
export const civilToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const shortDate = (date: string) => date ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
