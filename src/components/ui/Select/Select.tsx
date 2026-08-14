import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { Field } from "../Field/Field";
import styles from "./Select.module.css";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: ReactNode; description?: ReactNode; error?: ReactNode }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, description, error, className, id, required, children, ...props }, ref) {
  return <Field id={id} className={className} label={label} description={description} error={error} required={required}>{a => <select ref={ref} id={a.controlId} required={required} aria-invalid={a.invalid || undefined} aria-describedby={[a.descriptionId, a.errorId].filter(Boolean).join(" ") || undefined} className={styles.select} {...props}>{children}</select>}</Field>;
});
