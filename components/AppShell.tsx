"use client";
/**
 * Contêiner autenticado do aplicativo: restaura a última navegação, mantém
 * cliente/mês ativos e entrega o estado correto para catálogo, editor ou apresentação.
 */


import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { ClientsControl } from "./ClientsControl";
import { Studio } from "./Studio";
import { Presentation } from "./Presentation";
import { AdminUsers } from "./AdminUsers";
import { monthKey, parseMonthKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { Client, SafeUser, CalendarRecord, ContentItem } from "@/lib/types";
import styles from "./AppShell.module.css";

/** Dados da sessão que o contêiner pode consumir sem conhecer cookie ou senha. */
interface AppShellProps {
  currentUser: SafeUser;
  onLogout: () => void;
}

/** Coordena navegação, persistência local de preferências e carregamento dos calendários. */
export function AppShell({ currentUser, onLogout }: AppShellProps) {
  const [activeScreen, setActiveScreen] = useState<string>(() => {
    // Restaura somente nomes de tela conhecidos; qualquer resíduo antigo volta ao catálogo.
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cp:active-screen");
        if (stored && ["home", "planner", "presentation", "admin_users"].includes(stored)) {
          return stored;
        }
      } catch {}
    }
    return "home";
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [activeMonth, setActiveMonth] = useState<Date>(() => {
    // O mês salvo evita que um recarregamento devolva o operador ao mês atual.
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cp:active-month");
        if (stored) {
          return parseMonthKey(stored);
        }
      } catch {}
    }
    return new Date();
  });
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(() => {
    // O identificador é apenas uma retomada de navegação; a API ainda valida o calendário.
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("cp:active-calendar-id") || null;
      } catch {}
    }
    return null;
  });
  const [isPinned, setIsPinned] = useState<boolean>(true);
  const [ensuringCalendar, setEnsuringCalendar] = useState<boolean>(false);

  // A apresentação recebe uma fotografia completa para não depender do estado parcial do catálogo.
  const [presentationCal, setPresentationCal] = useState<CalendarRecord | null>(null);
  const [presentationItems, setPresentationItems] = useState<ContentItem[]>([]);

  // Restaura a preferência visual da barra lateral depois que o navegador está disponível.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cp:sidebar-pinned");
      if (stored !== null) {
        setIsPinned(stored === "true");
      }
    } catch {}
  }, []);

  // Cada efeito persiste somente a parte do contexto que realmente mudou.
  useEffect(() => {
    try {
      localStorage.setItem("cp:active-month", monthKey(activeMonth));
    } catch {}
  }, [activeMonth]);

  // Guarda a tela para retomá-la após atualização da página.
  useEffect(() => {
    try {
      localStorage.setItem("cp:active-screen", activeScreen);
    } catch {}
  }, [activeScreen]);

  // Um calendário nulo não apaga a última seleção válida; a próxima garantia pode reutilizá-la.
  useEffect(() => {
    try {
      if (activeCalendarId) {
        localStorage.setItem("cp:active-calendar-id", activeCalendarId);
      }
    } catch {}
  }, [activeCalendarId]);

  // Persiste a identidade do cliente, não o objeto completo que pode ficar desatualizado.
  useEffect(() => {
    try {
      if (activeClient?.id) {
        localStorage.setItem("cp:active-client-id", activeClient.id);
      }
    } catch {}
  }, [activeClient?.id]);

  /** Alterna a barra fixada e grava a preferência no mesmo passo de estado. */
  const handleTogglePin = () => {
    setIsPinned((prev) => {
      // Derivar de `prev` evita perder cliques rápidos antes da próxima renderização.
      const next = !prev;
      try {
        localStorage.setItem("cp:sidebar-pinned", String(next));
      } catch {}
      return next;
    });
  };

  /**
   * Carrega os clientes com o estado do mês ativo e reconcilia a seleção com
   * o objeto mais recente devolvido pela API.
   */
  const loadClients = useCallback(async () => {
    try {
      const mKey = monthKey(activeMonth);
      const res = await fetch(`/api/clients?month=${mKey}`);
      const data = await res.json();
      if (Array.isArray(data.clients)) {
        setClients(data.clients);
        const storedClientId = typeof window !== "undefined" ? localStorage.getItem("cp:active-client-id") : null;
        if (!activeClient && storedClientId) {
          const match = data.clients.find((c: Client) => c.id === storedClientId);
          if (match) {
            setActiveClient(match);
          } else if (data.clients.length > 0) {
            setActiveClient(data.clients[0]);
          }
        } else if (!activeClient && data.clients.length > 0) {
          setActiveClient(data.clients[0]);
        } else if (activeClient) {
          const updated = data.clients.find((c: Client) => c.id === activeClient.id);
          if (updated) setActiveClient(updated);
        }
      }
    } catch (err) {
      console.error("Error loading clients:", err);
    }
  }, [activeMonth, activeClient?.id]);

  // Trocar o mês refaz a consulta porque os indicadores de cada cliente são mensais.
  useEffect(() => {
    loadClients();
  }, [activeMonth]);

  /** Obtém ou cria o calendário de um cliente/mês e devolve seu identificador. */
  const ensureCalendar = async (clientId: string, month: Date): Promise<string | null> => {
    try {
      setEnsuringCalendar(true);
      const mKey = monthKey(month);
      const res = await fetch("/api/calendars/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, month: mKey }),
      });
      const data = await res.json();
      if (data.calendar?.id) {
        return data.calendar.id;
      }
      return null;
    } catch (err) {
      console.error("Error ensuring calendar:", err);
      return null;
    } finally {
      setEnsuringCalendar(false);
    }
  };

  /** Garante o calendário escolhido antes de abrir o editor. */
  const handleOpenPlanner = async (client: Client) => {
    setActiveClient(client);
    const calId = await ensureCalendar(client.id, activeMonth);
    if (calId) {
      setActiveCalendarId(calId);
      setActiveScreen("planner");
    }
  };

  /** Carrega calendário e itens completos antes de entrar na apresentação. */
  const handleOpenPresentation = async (client: Client) => {
    setActiveClient(client);
    const calId = await ensureCalendar(client.id, activeMonth);
    if (calId) {
      setActiveCalendarId(calId);
      // A apresentação precisa dos itens no mesmo instante que os metadados.
      try {
        const res = await fetch(`/api/calendars/${calId}`);
        const data = await res.json();
        if (data.calendar) {
          setPresentationCal(data.calendar);
          setPresentationItems(data.items || []);
          setActiveScreen("presentation");
        }
      } catch (err) {
        console.error("Error fetching presentation:", err);
      }
    }
  };

  /**
   * Traduz uma opção da barra lateral em navegação; editor e apresentação
   * exigem cliente/calendário, enquanto telas administrativas abrem diretamente.
   */
  const handleNavigate = async (screen: string) => {
    if (screen === "planner") {
      if (activeClient) {
        const calId = await ensureCalendar(activeClient.id, activeMonth);
        if (calId) {
          setActiveCalendarId(calId);
          setActiveScreen("planner");
        }
      } else if (clients.length > 0) {
        handleOpenPlanner(clients[0]);
      } else {
        setActiveScreen("home");
      }
      return;
    }

    if (screen === "presentation") {
      if (activeClient) {
        handleOpenPresentation(activeClient);
      } else if (clients.length > 0) {
        handleOpenPresentation(clients[0]);
      } else {
        setActiveScreen("home");
      }
      return;
    }

    setActiveScreen(screen);
  };

  /** Troca o cliente e atualiza imediatamente a tela que depende dele. */
  const handleSelectClient = async (client: Client) => {
    setActiveClient(client);
    if (activeScreen === "planner") {
      const calId = await ensureCalendar(client.id, activeMonth);
      if (calId) setActiveCalendarId(calId);
    } else if (activeScreen === "presentation") {
      handleOpenPresentation(client);
    }
  };

  return (
    <div className={styles.shell}>
      {/* UI: navegação global, seletor de cliente e controles da conta autenticada. */}
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        clients={clients}
        activeClient={activeClient}
        onSelectClient={handleSelectClient}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        onLogout={onLogout}
      />

      {/* UI: região principal recua conforme a barra esteja fixada ou recolhida. */}
      <main
        className={cn(
          styles.mainArea,
          isPinned ? styles.mainAreaPinned : styles.mainAreaCollapsed
        )}
      >
        {/* UI: bloqueia trocas de tela enquanto a API localiza ou cria o calendário. */}
        {ensuringCalendar && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>Carregando calendário do cliente...</p>
          </div>
        )}

        {/* UI: catálogo inicial com indicadores do cliente no mês selecionado. */}
        {!ensuringCalendar && activeScreen === "home" && (
          <ClientsControl
            clients={clients}
            activeMonth={activeMonth}
            onMonthChange={setActiveMonth}
            onOpenPlanner={handleOpenPlanner}
            onOpenPresentation={handleOpenPresentation}
            onReloadClients={loadClients}
            currentUser={currentUser}
          />
        )}

        {/* UI: área de trabalho editorial; só monta quando já existe calendário. */}
        {!ensuringCalendar && activeScreen === "planner" && activeCalendarId && (
          <Studio
            calendarId={activeCalendarId}
            onOpenPresentation={() => {
              if (activeClient) handleOpenPresentation(activeClient);
            }}
            onMonthChange={(newMonth, newCalId) => {
              setActiveMonth(newMonth);
              setActiveCalendarId(newCalId);
            }}
            onBack={() => {
              loadClients();
              setActiveScreen("home");
            }}
          />
        )}

        {/* UI: leitura em tela cheia usa a fotografia carregada por `handleOpenPresentation`. */}
        {!ensuringCalendar && activeScreen === "presentation" && presentationCal && (
          <Presentation
            calendar={presentationCal}
            month={activeMonth}
            items={presentationItems}
            onClose={() => {
              loadClients();
              setActiveScreen("planner");
            }}
            onMonthChange={async (newMonth) => {
              setActiveMonth(newMonth);
              if (activeClient) {
                const calId = await ensureCalendar(activeClient.id, newMonth);
                if (calId) {
                  const res = await fetch(`/api/calendars/${calId}`);
                  const data = await res.json();
                  if (data.calendar) {
                    setPresentationCal(data.calendar);
                    setPresentationItems(data.items || []);
                  }
                }
              }
            }}
          />
        )}

        {/* UI: gestão de contas fica disponível conforme a própria tela valida o papel atual. */}
        {!ensuringCalendar && activeScreen === "admin_users" && (
          <AdminUsers currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}
