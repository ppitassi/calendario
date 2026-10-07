"use client";
/**
 * Contêiner autenticado do aplicativo: restaura a última navegação, mantém
 * cliente/mês ativos e entrega o estado correto para catálogo, editor ou apresentação.
 */


import { useState, useEffect, useCallback } from "react";
import { Menu, Calendar } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ClientsControl } from "./ClientsControl";
import { HomeScreen } from "./home/HomeScreen";
import { Studio } from "./Studio";
import { Presentation } from "./Presentation";
import { PresentationsHub } from "./presentations/PresentationsHub";
import { AdminUsers } from "./AdminUsers";
import { GlobalWorkQueue } from "./tasks/GlobalWorkQueue";
import { CreateDemandDrawer } from "./tasks/CreateDemandDrawer";
import { DeveloperSettingsModal } from "./settings/DeveloperSettingsModal";
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
  const [isDevSettingsOpen, setIsDevSettingsOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState<string>(() => {
    // Restaura somente nomes de tela conhecidos; nunca restaura "presentation" diretamente
    // pois os dados de apresentação são voláteis em memória.
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cp:active-screen");
        const storedCalId = localStorage.getItem("cp:active-calendar-id");
        if (stored === "planner" && storedCalId) {
          return "planner";
        }
        if (stored && ["home", "clients", "admin_users", "presentations", "tasks"].includes(stored)) {
          return stored;
        }
      } catch {}
    }
    // Entrada inicial por papel (Seção 3.1 do plano V2)
    if (currentUser?.role === "designer") {
      return "tasks";
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
  const [studioViewMode, setStudioViewMode] = useState<"calendar" | "extras" | "kanban" | "list">("calendar");

  // A apresentação recebe uma fotografia completa para não depender do estado parcial do catálogo.
  const [presentationCal, setPresentationCal] = useState<CalendarRecord | null>(null);
  const [presentationItems, setPresentationItems] = useState<ContentItem[]>([]);
  const [presentationReturnScreen, setPresentationReturnScreen] = useState<string>("presentations");

  // Estado do tema (claro/escuro)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cp:theme");
        if (stored === "dark" || stored === "light") return stored;
      } catch {}
    }
    return "light";
  });

  // Estado do menu mobile
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estado da Gaveta Global de Criação de Demanda
  const [isCreateDemandOpen, setIsCreateDemandOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    async function loadTeam() {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        if (Array.isArray(data.teamMembers)) {
          setTeamMembers(data.teamMembers);
        }
      } catch (err) {
        console.error("Erro ao carregar membros da equipe:", err);
      }
    }
    loadTeam();
  }, []);

  // Aplica o tema ao elemento raiz <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("cp:theme", theme);
    } catch {}
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Restaura a preferência visual da barra lateral respeitando o viewport (<1600px compacta por padrão).
  useEffect(() => {
    try {
      const isWideScreen = typeof window !== "undefined" && window.innerWidth >= 1600;
      const stored = localStorage.getItem("cp:sidebar-pinned");
      if (stored !== null) {
        setIsPinned(stored === "true" && isWideScreen);
      } else {
        setIsPinned(isWideScreen);
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

  // Se a tela ativa exigir dados que não estão presentes, recua em segurança para "home".
  useEffect(() => {
    if (activeScreen === "planner" && !activeCalendarId) {
      setActiveScreen("home");
    } else if (activeScreen === "presentation" && !presentationCal) {
      setActiveScreen("home");
    }
  }, [activeScreen, activeCalendarId, presentationCal]);

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
  const handleOpenPresentation = async (client: Client, returnTo: string = "home") => {
    setPresentationReturnScreen(returnTo);
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
  const handleNavigate = async (
    screen: string,
    viewMode?: "calendar" | "extras" | "kanban" | "list"
  ) => {
    if (viewMode) {
      setStudioViewMode(viewMode);
    }

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

    if (screen === "presentation" || screen === "presentations") {
      setActiveScreen("presentations");
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
      {/* Mobile: backdrop translúcido que fecha o menu lateral ao ser clicado. */}
      {mobileMenuOpen && (
        <div
          className="mobileBackdrop visible"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Header superior global: fixado no topo ocupando toda a largura */}
      {activeScreen !== "presentation" && (activeScreen !== "planner" || !activeCalendarId) && (
        <Header
          currentUser={currentUser}
          onLogout={onLogout}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          activeScreen={activeScreen}
          activeClient={activeClient}
          onNavigate={handleNavigate}
          activeMonth={activeMonth}
          onMonthChange={setActiveMonth}
          onOpenSettings={() => setIsDevSettingsOpen(true)}
        />
      )}

      <div className={styles.layoutContainer}>
        {/* UI: navegação global, seletor de cliente e controles da conta autenticada. */}
        <Sidebar
          activeScreen={activeScreen}
          activeViewMode={studioViewMode}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          clients={clients}
          activeClient={activeClient}
          onSelectClient={handleSelectClient}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
          onLogout={onLogout}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          hasTopHeader={activeScreen !== "presentation" && (activeScreen !== "planner" || !activeCalendarId)}
          onOpenCreateDemand={() => setIsCreateDemandOpen(true)}
          onOpenDeveloperSettings={() => setIsDevSettingsOpen(true)}
        />

        {/* UI: região principal ao lado da barra lateral */}
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

        {/* UI: Nova Home operacional baseada em papéis com prazo global */}
        {!ensuringCalendar && activeScreen === "home" && (
          <HomeScreen
            currentUser={currentUser}
            clients={clients}
            onOpenPlanner={(client, monthStr) => {
              if (monthStr) {
                try {
                  const [y, m] = monthStr.split("-").map(Number);
                  setActiveMonth(new Date(y, m - 1, 1));
                } catch {}
              }
              handleOpenPlanner(client);
            }}
            onOpenCreateDemand={() => setIsCreateDemandOpen(true)}
          />
        )}

        {/* UI: catálogo de clientes com indicadores mensais */}
        {!ensuringCalendar && (
          activeScreen === "clients" ||
          (activeScreen === "planner" && !activeCalendarId) ||
          (activeScreen === "presentation" && !presentationCal)
        ) && (
          <ClientsControl
            clients={clients}
            activeMonth={activeMonth}
            onMonthChange={setActiveMonth}
            onOpenPlanner={handleOpenPlanner}
            onOpenPresentation={handleOpenPresentation}
            onReloadClients={loadClients}
            currentUser={currentUser}
            onOpenCreateDemand={() => setIsCreateDemandOpen(true)}
          />
        )}

        {/* UI: área de trabalho editorial com cabeçalho único e completo integrado */}
        {!ensuringCalendar && activeScreen === "planner" && activeCalendarId && (
          <Studio
            calendarId={activeCalendarId}
            onOpenPresentation={() => {
              if (activeClient) handleOpenPresentation(activeClient, "planner");
            }}
            onMonthChange={(newMonth, newCalId) => {
              setActiveMonth(newMonth);
              setActiveCalendarId(newCalId);
            }}
            onBack={() => {
              loadClients();
              setActiveScreen("home");
            }}
            currentUser={currentUser}
            onLogout={onLogout}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            initialViewMode={studioViewMode}
            onViewModeChange={(mode) => setStudioViewMode(mode)}
            onOpenSettings={() => setIsDevSettingsOpen(true)}
          />
        )}

        {/* UI: Central de Apresentações com métricas e cards de cada cliente */}
        {!ensuringCalendar && activeScreen === "presentations" && (
          <PresentationsHub
            clients={clients}
            activeMonth={activeMonth}
            onOpenPresentation={(cal, items, monthDate, client) => {
              setPresentationReturnScreen("presentations");
              setActiveClient(client);
              setActiveMonth(monthDate);
              setActiveCalendarId(cal.id);
              setPresentationCal(cal);
              setPresentationItems(items);
              setActiveScreen("presentation");
            }}
            onOpenPlanner={(client, monthDate) => {
              if (monthDate) setActiveMonth(monthDate);
              handleOpenPlanner(client);
            }}
            currentUser={currentUser}
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
              setActiveScreen(presentationReturnScreen || "presentations");
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

        {/* UI: Fila Global de Tarefas (Kanban e Lista consolidada para o usuário) */}
        {!ensuringCalendar && activeScreen === "tasks" && (
          <GlobalWorkQueue
            currentUser={currentUser}
            clients={clients}
            onOpenPlanner={(client, monthStr) => {
              if (monthStr) {
                try {
                  const [y, m] = monthStr.split("-").map(Number);
                  setActiveMonth(new Date(y, m - 1, 1));
                } catch {}
              }
              const targetClient = clients.find((c) => c.id === client.id) || (client as Client);
              handleOpenPlanner(targetClient);
            }}
          />
        )}
      </main>
      </div>

      {/* Gaveta Global de Criação de Demanda */}
      <CreateDemandDrawer
        isOpen={isCreateDemandOpen}
        onClose={() => setIsCreateDemandOpen(false)}
        clients={clients}
        preselectedClientId={activeClient?.id}
        teamMembers={teamMembers}
        onSuccess={async () => {
          setIsCreateDemandOpen(false);
          await loadClients();
        }}
      />

      <DeveloperSettingsModal
        isOpen={isDevSettingsOpen}
        onClose={() => setIsDevSettingsOpen(false)}
        initialTab={currentUser.role === "admin" ? "hotkeys" : "hotkeys"}
      />
    </div>
  );
}

