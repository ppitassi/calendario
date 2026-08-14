import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../../lib/utils";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "glass" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "large";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; icon?: ReactNode; }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "medium", loading = false, icon, className, children, disabled, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cn(styles.button, styles[variant], size !== "medium" && styles[size], className)} {...props}>{loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}{children}</button>;
});
