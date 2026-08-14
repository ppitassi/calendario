import { type ReactNode, useId } from "react";
import { cn } from "../../../lib/utils";
import styles from "./Field.module.css";

export type FieldA11y = { controlId: string; descriptionId?: string; errorId?: string; invalid: boolean };
export type FieldProps = {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: (a11y: FieldA11y) => ReactNode;
  id?: string;
  className?: string;
};

export function Field({ label, description, error, required, children, id, className }: FieldProps) {
  const generated = useId();
  const controlId = id || generated;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return <div className={cn(styles.field, className)}>{label ? <label className={styles.label} htmlFor={controlId}>{label}{required ? <span className={styles.required} aria-hidden="true"> *</span> : null}</label> : null}{children({ controlId, descriptionId, errorId, invalid: Boolean(error) })}{description ? <span id={descriptionId} className={styles.description}>{description}</span> : null}{error ? <span id={errorId} className={styles.error} role="alert">{error}</span> : null}</div>;
}
