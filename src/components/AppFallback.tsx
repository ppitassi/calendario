import type { ReactNode } from "react";
import { Surface } from "./ui/Surface/Surface";
import styles from "./AppFallback.module.css";

export function AppFallback({ eyebrow, title, message, actions, details, role = "alert" }: { eyebrow?: ReactNode; title: ReactNode; message: ReactNode; actions?: ReactNode; details?: ReactNode; role?: "alert" | "status" }) {
  return <main className={styles.page} role={role}>
    <Surface level="strong" className={styles.card}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      {details ? <div className={styles.details}>{details}</div> : null}
    </Surface>
  </main>;
}
