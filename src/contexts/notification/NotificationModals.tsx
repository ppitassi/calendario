import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { ToastItem, AlertState, ConfirmState, PromptState } from "../NotificationContext";
import { Textarea } from "../../components/ui/Textarea/Textarea";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./NotificationModals.module.css";

type NotificationModalsProps = {
  toasts: ToastItem[];
  setToasts: React.Dispatch<React.SetStateAction<ToastItem[]>>;
  alertState: AlertState | null;
  confirmState: ConfirmState | null;
  promptState: PromptState | null;
};

export function NotificationModals({
  toasts,
  setToasts,
  alertState,
  confirmState,
  promptState,
}: NotificationModalsProps) {
  return (
    <>
      {/* TOASTS CONTAINER */}
      <div className={styles.toastContainer}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              role="status"
              aria-live="polite"
              className={styles.toast}
            >
              <div className={styles.toastContent} data-status={t.type}>
                {t.type === "success" && <CheckCircle />}
                {t.type === "error" && <XCircle />}
                {t.type === "info" && <Info />}
                <p>{t.message}</p>
              </div>
              <IconButton
                label="Fechar notificação"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="shrink-0"
                size="small"
              >
                <X />
              </IconButton>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ALERT MODAL */}
      <AnimatePresence>
        {alertState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.backdrop}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="app-alert-title"
              className={styles.dialog}
            >
              <div
                className={styles.statusIcon}
                data-status={alertState.type}
              >
                {alertState.type === "success" && <CheckCircle />}
                {alertState.type === "error" && <XCircle />}
                {alertState.type === "warning" && <AlertTriangle />}
                {alertState.type === "info" && <Info />}
              </div>

              <div className={styles.dialogCopy}>
                <h3 id="app-alert-title">{alertState.title}</h3>
                <p>{alertState.message}</p>
              </div>

              <Button
                onClick={alertState.resolve}
                className="w-full"
                variant="primary"
              >
                Entendido
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM MODAL */}
      <AnimatePresence>
        {confirmState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.backdrop}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="app-confirm-title"
              className={styles.dialog}
            >
              <div
                className={styles.statusIcon}
                data-status={confirmState.type === "danger" ? "error" : "info"}
              >
                {confirmState.type === "danger" ? <AlertTriangle /> : <Info />}
              </div>

              <div className={styles.dialogCopy}>
                <h3 id="app-confirm-title">{confirmState.title}</h3>
                <p>{confirmState.message}</p>
              </div>

              <div className={styles.actions}>
                <Button
                  onClick={() => confirmState.resolve(false)}
                  className="flex-1"
                >
                  {confirmState.cancelText || "Cancelar"}
                </Button>
                <Button
                  onClick={() => confirmState.resolve(true)}
                  className="flex-1"
                  variant={confirmState.type === "danger" ? "danger" : "primary"}
                >
                  {confirmState.confirmText || "Confirmar"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROMPT MODAL */}
      <AnimatePresence>
        {promptState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.backdrop}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="app-prompt-title"
              className={styles.dialog}
            >
              <div className={styles.statusIcon} data-status="info">
                <Info />
              </div>

              <div className={styles.dialogCopy}>
                <h3 id="app-prompt-title">{promptState.title}</h3>
                <label className="sr-only" htmlFor="custom-prompt-input">Resposta</label>
                <p>{promptState.message}</p>
              </div>

              <div className={styles.promptField}>
                <Textarea
                  className="w-full min-h-[100px]"
                  placeholder={promptState.placeholder || "Digite aqui..."}
                  defaultValue={promptState.defaultValue}
                  id="custom-prompt-input"
                  autoFocus
                />
              </div>

              <div className={styles.actions}>
                <Button
                  onClick={() => promptState.resolve(null)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    const inputEl = document.getElementById("custom-prompt-input") as HTMLTextAreaElement | null;
                    promptState.resolve(inputEl?.value || "");
                  }}
                  className="flex-1"
                  variant="primary"
                >
                  Enviar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
