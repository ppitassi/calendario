"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Inbox,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import { auth } from "../lib/auth";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button/Button";
import { IconButton } from "../components/ui/IconButton/IconButton";
import styles from "./AppNotifications.module.css";

export type AppNotification = {
  id: number;
  category: string;
  title: string;
  body: string;
  route: string;
  createdAt: string;
  readAt?: string | null;
  toastPresentedAt?: string | null;
  actorName?: string;
  clientName?: string;
};
type Ctx = {
  unread: number;
  refresh: () => Promise<void>;
  open: boolean;
  setOpen: (value: boolean) => void;
  markRead: (id: number) => Promise<void>;
};
const Context = createContext<Ctx | null>(null);
export const useAppNotifications = () => useContext(Context);

export function HeaderNotificationsButton() {
  const value = useAppNotifications();
  if (!value) return null;
  return (
    <IconButton
      label="Notificações"
      aria-haspopup="dialog"
      aria-expanded={value.open}
      onClick={() => value.setOpen(!value.open)}
      variant="glass"
    >
      <Bell />
      {value.unread > 0 ? (
        <span aria-live="polite" className={styles.badge}>
          {value.unread > 99 ? "99+" : value.unread}
        </span>
      ) : null}
    </IconButton>
  );
}

export function AppNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = auth.currentUser;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const channel = useRef<BroadcastChannel | null>(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [listResponse, countResponse] = await Promise.all([
        fetch(`/api/notifications?filter=${filter}&limit=30`, {
          cache: "no-store",
        }),
        fetch("/api/notifications/unread-count", { cache: "no-store" }),
      ]);
      if (!listResponse.ok || !countResponse.ok) throw new Error();
      const list = await listResponse.json(),
        count = await countResponse.json();
      setItems(list.items || []);
      setUnread(count.count || 0);
    } catch {
      setError("Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, [filter, user?.uid]);
  const markRead = useCallback(async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((value) =>
      value.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    setUnread((value) => Math.max(0, value - 1));
    channel.current?.postMessage({ type: "refresh" });
  }, []);
  const safeRoute = (route: string) => {
    if (
      !route ||
      !route.startsWith("/") ||
      route.startsWith("//") ||
      /^(?:javascript|data|https?):/i.test(route)
    )
      return null;
    try {
      const url = new URL(route, window.location.origin);
      return url.origin === window.location.origin
        ? url.pathname + url.search + url.hash
        : null;
    } catch {
      return null;
    }
  };
  const navigating = useRef(false);
  const openItem = async (item: AppNotification) => {
    if (navigating.current) return;
    const route = safeRoute(item.route);
    if (!route) {
      setError("O item relacionado não está mais disponível.");
      setOpen(true);
      return;
    }
    navigating.current = true;
    setOpen(false);
    setToasts((value) => value.filter((current) => current.id !== item.id));
    if (!item.readAt) void markRead(item.id);
    window.history.pushState({}, "", route);
    window.dispatchEvent(new CustomEvent("app:navigate-notification"));
    navigating.current = false;
  };
  useEffect(() => {
    if (!user) return;
    const broadcast =
      "BroadcastChannel" in window
        ? new BroadcastChannel("content-planner-notifications")
        : null;
    channel.current = broadcast;
    if (broadcast) broadcast.onmessage = () => void refresh();
    void refresh();
    let source: EventSource | null = null;
    try {
      source = new EventSource("/api/notifications/stream");
      source.addEventListener("notifications", (event: any) => {
        const data = JSON.parse(event.data);
        setUnread(data.unread || 0);
        if (data.changed)
          void fetch("/api/notifications?limit=1", { cache: "no-store" })
            .then((response) => response.json())
            .then(async (result) => {
              const item = result.items?.[0];
              if (item) {
                const claim = await fetch(
                  `/api/notifications/${item.id}/claim-toast`,
                  { method: "POST" },
                );
                const claimed = claim.ok
                  ? await claim.json()
                  : { claimed: false };
                if (claimed.claimed)
                  setToasts((value) =>
                    value.some((current) => current.id === item.id)
                      ? value
                      : [item, ...value].slice(0, 3),
                  );
              }
              void refresh();
            });
      });
    } catch {}
    return () => {
      source?.close();
      broadcast?.close();
    };
  }, [user?.uid, refresh]);
  useEffect(() => {
    if (open) void refresh();
  }, [open, filter, refresh]);
  const value = useMemo(
    () => ({ unread, refresh, open, setOpen, markRead }),
    [unread, refresh, open, markRead],
  );
  if (!user) return <>{children}</>;
  return (
    <Context.Provider value={value}>
      {children}
      <AnimatePresence>
        {open ? (
          <>
            <div
              className={styles.backdrop}
              role="presentation"
              onMouseDown={() => setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Central de notificações"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              className={styles.panel}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className={styles.panelHeader}>
                <div>
                  <h2>
                    Notificações
                  </h2>
                  <p>{unread} não lidas</p>
                </div>
                <IconButton label="Fechar" onClick={() => setOpen(false)}>
                  <X />
                </IconButton>
              </div>
              <div className={styles.filterBar}>
                <Button
                  size="small"
                  variant={filter === "unread" ? "primary" : "glass"}
                  onClick={() => setFilter("unread")}
                >
                  Não lidas
                </Button>
                <Button
                  size="small"
                  variant={filter === "all" ? "primary" : "glass"}
                  onClick={() => setFilter("all")}
                >
                  Todas
                </Button>
                <Button
                  className="ml-auto"
                  size="small"
                  variant="ghost"
                  icon={<CheckCheck />}
                  onClick={async () => {
                    await fetch("/api/notifications/read-all", {
                      method: "POST",
                    });
                    setUnread(0);
                    void refresh();
                    channel.current?.postMessage({ type: "refresh" });
                  }}
                >
                  Marcar todas
                </Button>
              </div>
              <div className={styles.list}>
                {loading ? (
                  <div className={styles.skeletonList}>
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={styles.skeleton}
                      />
                    ))}
                  </div>
                ) : null}
                {error ? (
                  <Button
                    onClick={() => void refresh()}
                    className="w-full"
                    variant="danger"
                  >
                    {error} Tentar novamente
                  </Button>
                ) : null}
                {!loading && !error && !items.length ? (
                  <div className={styles.empty}>
                    <Inbox />
                    <p>Nenhuma notificação por aqui.</p>
                  </div>
                ) : null}
                {/* style-architecture-button-exception: notification cards are feature-specific interactive data rows. */}
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void openItem(item)}
                    className={cn(
                      styles.item,
                      !item.readAt && styles.itemUnread,
                    )}
                  >
                    <div className={styles.itemContent}>
                      <span className={styles.itemDot} />
                      <div className="min-w-0 flex-1">
                        <strong>{item.title}</strong>
                        <p>
                          {item.body}
                        </p>
                        <span>
                          {item.actorName || item.clientName || ""} ·{" "}
                          {new Date(item.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <ChevronRight />
                    </div>
                  </button>
                ))}
              </div>
              <div className={styles.panelFooter}>
                <a
                  href="/?screen=user_setup&tab=preferences"
                  className={styles.preferencesLink}
                >
                  <Settings />
                  Preferências
                </a>
                <Button
                  size="small"
                  variant="ghost"
                  icon={<RotateCcw />}
                  onClick={() => setOpen(false)}
                >
                  Restaurar posição
                </Button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
      <div className={styles.toasts}>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className={styles.toast}
          >
            <div className={styles.toastContent}>
              <Bell />
              <Button
                className="min-w-0 flex-1"
                variant="ghost"
                onClick={() => void openItem(item)}
              >
                <span className={styles.toastCopy}>
                  <strong>{item.title}</strong>
                  <span>
                    {item.body}
                  </span>
                </span>
              </Button>
              <IconButton
                label="Fechar"
                onClick={() =>
                  setToasts((value) =>
                    value.filter((current) => current.id !== item.id),
                  )
                }
              >
                <X />
              </IconButton>
            </div>
          </motion.div>
        ))}
      </div>
    </Context.Provider>
  );
}
