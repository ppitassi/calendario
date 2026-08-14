import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Field } from "../Field/Field";
import styles from "./Input.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: ReactNode; description?: ReactNode; error?: ReactNode }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, description, error, className, id, required, ...props }, ref) {
  return <Field id={id} className={className} label={label} description={description} error={error} required={required}>{a => <input ref={ref} id={a.controlId} required={required} aria-invalid={a.invalid || undefined} aria-describedby={[a.descriptionId, a.errorId].filter(Boolean).join(" ") || undefined} className={styles.input} {...props} />}</Field>;
});
