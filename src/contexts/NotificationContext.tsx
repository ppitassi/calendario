import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { NotificationModals } from "./notification/NotificationModals";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export interface AlertState {
  title: string;
  message: string;
  type: NotificationType;
  resolve: () => void;
}

export interface ConfirmState {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "info";
  resolve: (value: boolean) => void;
}

export interface PromptState {
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  resolve: (value: string | null) => void;
}

interface NotificationContextProps {
  toast: (message: string, type?: "success" | "error" | "info") => void;
  alert: (title: string, message: string, type?: NotificationType) => Promise<void>;
  confirm: (title: string, message: string, options?: { confirmText?: string; cancelText?: string; type?: "danger" | "info" }) => Promise<boolean>;
  prompt: (title: string, message: string, options?: { placeholder?: string; defaultValue?: string }) => Promise<string | null>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const hasDialog = Boolean(alertState || confirmState || promptState);

  useEffect(() => {
    if (!hasDialog) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, input, select, a[href]") || []);
    window.setTimeout(() => focusable()[0]?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (alertState) alertState.resolve();
        else if (confirmState) confirmState.resolve(false);
        else if (promptState) promptState.resolve(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [hasDialog, alertState, confirmState, promptState]);

  const toast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const alert = useCallback((title: string, message: string, type: NotificationType = "info") => {
    return new Promise<void>((resolve) => {
      setAlertState({
        title,
        message,
        type,
        resolve: () => {
          setAlertState(null);
          resolve();
        },
      });
    });
  }, []);

  const confirm = useCallback(
    (title: string, message: string, options?: { confirmText?: string; cancelText?: string; type?: "danger" | "info" }) => {
      return new Promise<boolean>((resolve) => {
        setConfirmState({
          title,
          message,
          confirmText: options?.confirmText,
          cancelText: options?.cancelText,
          type: options?.type || "info",
          resolve: (val) => {
            setConfirmState(null);
            resolve(val);
          },
        });
      });
    },
    [],
  );

  const prompt = useCallback((title: string, message: string, options?: { placeholder?: string; defaultValue?: string }) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({
        title,
        message,
        placeholder: options?.placeholder,
        defaultValue: options?.defaultValue,
        resolve: (val) => {
          setPromptState(null);
          resolve(val);
        },
      });
    });
  }, []);

  useEffect(() => {
    const onExpired = () => toast("Sua sessão expirou. Entre novamente para continuar.", "info");
    window.addEventListener("auth-expired", onExpired);
    return () => window.removeEventListener("auth-expired", onExpired);
  }, [toast]);

  return (
    <NotificationContext.Provider value={{ toast, alert, confirm, prompt }}>
      {children}
      <NotificationModals
        toasts={toasts}
        setToasts={setToasts}
        alertState={alertState}
        confirmState={confirmState}
        promptState={promptState}
      />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
