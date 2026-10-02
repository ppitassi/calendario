/** Botão compacto para ações representadas somente por um ícone visível. */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./IconButton.module.css";

/** `label` é obrigatório porque fornece o nome acessível que o ícone não contém. */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "small" | "medium" | "large";
  variant?: "ghost" | "glass" | "primary" | "danger";
  label: string;
}

/** Aplica tamanho/variante, encaminha a referência e publica `aria-label`. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      size = "medium",
      variant = "ghost",
      label,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          styles.button,
          size !== "medium" && styles[size],
          variant !== "ghost" && styles[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
