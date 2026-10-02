/** Botão base compartilhado, com variantes, tamanhos, ícone e estado de carregamento. */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Button.module.css";

/** Aparências permitidas pelo design system do Studio. */
export type ButtonVariant = "primary" | "secondary" | "glass" | "ghost" | "danger";
/** Alturas e espaçamentos disponíveis para o botão. */
export type ButtonSize = "small" | "medium" | "large";

/** Propriedades nativas acrescidas das opções visuais e do indicador de espera. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

/**
 * Desabilita a interação durante `loading`, informa `aria-busy` e encaminha a
 * referência ao elemento nativo para focos e integrações externas.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "medium",
    loading = false,
    icon,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        styles.button,
        styles[variant],
        size !== "medium" && styles[size],
        className
      )}
      {...props}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});
