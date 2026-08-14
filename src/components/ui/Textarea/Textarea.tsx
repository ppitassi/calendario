import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Field } from "../Field/Field";
import styles from "./Textarea.module.css";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: ReactNode; description?: ReactNode; error?: ReactNode }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, description, error, className, id, required, ...props }, ref) {
  return <Field id={id} className={className} label={label} description={description} error={error} required={required}>{a => <textarea ref={ref} id={a.controlId} required={required} aria-invalid={a.invalid || undefined} aria-describedby={[a.descriptionId, a.errorId].filter(Boolean).join(" ") || undefined} className={styles.textarea} {...props} />}</Field>;
});
