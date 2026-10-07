"use client";
/**
 * Central de Apresentações (PresentationsHub).
 * Exibe lista/cards com dados de quantas apresentações foram geradas por cliente,
 * permitindo abrir apresentações interativas, compartilhar links e acompanhar aprovações.
 */

import { useState, useEffect, useMemo } from "react";
import {
  MonitorPlay,
  Share2,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  X,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Layers,
  Sparkles,
  FileText,
  Users,
} from "lucide-react";
import type { Client, CalendarRecord, ContentItem, SafeUser } from "@/lib/types";
import { parseMonthKey, monthLabel } from "@/lib/date";
import styles from "./PresentationsHub.module.css";

export interface PresentationsHubProps {
  clients: Client[];
  activeMonth: Date;
  onOpenPresentation: (
    calendar: CalendarRecord,
    items: ContentItem[],
    monthDate: Date,
    client: Client
  ) => void;
  onOpenPlanner: (client: Client, monthDate?: Date) => void;
  currentUser?: SafeUser;
}

interface CalendarSummary {
  id: string;
  client_id: string;
  title: string;
  month: string;
  brand: string;
  accent?: string;
  status: string;
  is_pre_calendar?: number | boolean;
  share_token?: string | null;
  client_feedback_status?: string | null;
  client_feedback?: string | null;
  client_feedback_at?: string | null;
  items_count?: number;
  client_name?: string;
  client_segment?: string;
}

export function PresentationsHub({
  clients,
  activeMonth,
  onOpenPresentation,
  onOpenPlanner,
  currentUser: _currentUser,
}: PresentationsHubProps) {
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Carrega todos os calendários do sistema
  useEffect(() => {
    let isMounted = true;
    async function loadAllCalendars() {
      try {
        setLoading(true);
        const res = await fetch("/api/calendars");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.calendars)) {
            setCalendars(data.calendars);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar apresentações:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAllCalendars();
    return () => {
      isMounted = false;
    };
  }, []);

  // Agrupa calendários por cliente
  const calendarsByClient = useMemo(() => {
    const map = new Map<string, CalendarSummary[]>();
    calendars.forEach((cal) => {
      const list = map.get(cal.client_id) || [];
      list.push(cal);
      map.set(cal.client_id, list);
    });
    return map;
  }, [calendars]);

  // Se nenhum cliente estiver selecionado, seleciona o primeiro com apresentações
  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      const firstWithCal = clients.find((c) => (calendarsByClient.get(c.id)?.length || 0) > 0);
      setSelectedClientId(firstWithCal ? firstWithCal.id : clients[0].id);
    }
  }, [clients, calendarsByClient, selectedClientId]);

  // Clientes filtrados por busca
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.segment && c.segment.toLowerCase().includes(q))
    );
  }, [clients, search]);

  // Apresentações do cliente selecionado
  const activeClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const activeClientCalendars = useMemo(() => {
    if (!selectedClientId) return [];
    return (calendarsByClient.get(selectedClientId) || []).sort(
      (a, b) => b.month.localeCompare(a.month)
    );
  }, [calendarsByClient, selectedClientId]);

  // Métricas gerais
  const metrics = useMemo(() => {
    const totalCalendars = calendars.length;
    let approved = 0;
    let pending = 0;
    let preCalendars = 0;

    calendars.forEach((c) => {
      const fStatus = c.client_feedback_status;
      if (fStatus === "approve" || fStatus === "approved" || fStatus === "approve_with_notes" || fStatus === "approved_with_notes") {
        approved++;
      } else {
        pending++;
      }
      if (Boolean(c.is_pre_calendar)) {
        preCalendars++;
      }
    });

    return { totalCalendars, approved, pending, preCalendars };
  }, [calendars]);

  // Abre a apresentação interativa completa
  const handleLaunchPresentation = async (cal: CalendarSummary) => {
    try {
      const res = await fetch(`/api/calendars/${cal.id}`);
      if (!res.ok) throw new Error("Falha ao carregar apresentação");
      const data = await res.json();
      if (data.calendar) {
        const client: Client = clients.find((c) => c.id === cal.client_id) || {
          id: cal.client_id,
          name: cal.client_name || cal.brand,
          segment: cal.client_segment || "",
          tone: "",
          audience: "",
          strategy: "",
          accent: cal.accent || "#ef5d3d",
          posting_days: [],
          created_by_id: "",
          created_at: "",
        };
        const monthDate = parseMonthKey(cal.month);
        onOpenPresentation(data.calendar, data.items || [], monthDate, client);
      }
    } catch (err) {
      console.error("Erro ao abrir apresentação:", err);
      alert("Não foi possível carregar a apresentação selecionada.");
    }
  };

  // Copia o link do portal do cliente com token exclusivo
  const handleCopyClientLink = async (cal: CalendarSummary) => {
    try {
      let token = cal.share_token;
      if (!token) {
        const res = await fetch(`/api/calendars/${cal.id}/share-token`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          token = data.share_token;
          // Atualiza o estado local
          setCalendars((prev) =>
            prev.map((item) => (item.id === cal.id ? { ...item, share_token: token } : item))
          );
        }
      }

      if (token) {
        const url = `${window.location.origin}/portal/${token}`;
        await navigator.clipboard.writeText(url);
        setCopiedId(cal.id);
        setTimeout(() => setCopiedId(null), 2500);
      }
    } catch (err) {
      console.error("Erro ao copiar link:", err);
      alert("Erro ao copiar link do cliente.");
    }
  };

  const formatMonthTitle = (monthStr: string) => {
    try {
      const date = parseMonthKey(monthStr);
      return monthLabel(date);
    } catch {
      return monthStr;
    }
  };

  return (
    <div className={styles.hubContainer}>
      {/* Cabeçalho */}
      <div className={styles.hubHeader}>
        <div className={styles.hubTitleArea}>
          <h1>
            <MonitorPlay size={26} color="var(--tenant-primary, #e3002f)" />
            <span>Central de Apresentações</span>
          </h1>
          <p>
            Acompanhe todas as apresentações interativas de conteúdo geradas para cada cliente,
            com status de aprovação em tempo real e links compartilháveis.
          </p>
        </div>
      </div>

      {/* Métricas Gerais */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div
            className={styles.metricIcon}
            style={{ background: "rgba(227, 0, 47, 0.1)", color: "var(--tenant-primary, #e3002f)" }}
          >
            <MonitorPlay size={20} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Apresentações Geradas</span>
            <span className={styles.metricValue}>{metrics.totalCalendars}</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div
            className={styles.metricIcon}
            style={{ background: "rgba(16, 185, 129, 0.1)", color: "#059669" }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Aprovadas pelo Cliente</span>
            <span className={styles.metricValue} style={{ color: "#059669" }}>
              {metrics.approved}
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div
            className={styles.metricIcon}
            style={{ background: "rgba(245, 158, 11, 0.1)", color: "#d97706" }}
          >
            <Clock size={20} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Em Revisão / Produção</span>
            <span className={styles.metricValue} style={{ color: "#d97706" }}>
              {metrics.pending}
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div
            className={styles.metricIcon}
            style={{ background: "rgba(99, 102, 241, 0.1)", color: "#4f46e5" }}
          >
            <FileText size={20} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Pré-Calendários</span>
            <span className={styles.metricValue} style={{ color: "#4f46e5" }}>
              {metrics.preCalendars}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtro */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por cliente ou segmento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => setSearch("")}
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Layout Split: Clientes à Esquerda | Apresentações à Direita */}
      <div className={styles.layoutSplit}>
        {/* Lista de Clientes */}
        <div className={styles.clientsList}>
          <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em", padding: "0 4px" }}>
            Clientes ({filteredClients.length})
          </div>

          {filteredClients.map((client) => {
            const count = calendarsByClient.get(client.id)?.length || 0;
            const isSelected = selectedClientId === client.id;
            const initials = client.name.slice(0, 2).toUpperCase();

            return (
              <button
                key={client.id}
                type="button"
                className={`${styles.clientCardItem} ${isSelected ? styles.clientCardItemActive : ""}`}
                onClick={() => setSelectedClientId(client.id)}
              >
                <div className={styles.clientCardMain}>
                  <div
                    className={styles.clientAvatar}
                    style={{
                      background: client.logo_url ? "transparent" : (client.accent || "var(--tenant-primary, #e3002f)"),
                      padding: client.logo_url ? "0.15rem" : "0",
                    }}
                  >
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className={styles.clientMeta}>
                    <span className={styles.clientName}>{client.name}</span>
                    <span className={styles.clientSegment}>{client.segment || "Sem segmento"}</span>
                  </div>
                </div>

                <div className={styles.clientCountBadge} title={`${count} apresentações geradas`}>
                  <MonitorPlay size={12} />
                  <span>{count}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Painel de Apresentações do Cliente Selecionado */}
        <div className={styles.presentationsPanel}>
          {activeClient ? (
            <>
              <div className={styles.panelHeader}>
                <div className={styles.panelHeaderTitle}>
                  <MonitorPlay size={20} color="var(--tenant-primary, #e3002f)" />
                  <span>Apresentações de {activeClient.name}</span>
                </div>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => onOpenPlanner(activeClient, activeMonth)}
                  title="Abrir estúdio de planejamento deste cliente"
                >
                  <ExternalLink size={13} />
                  <span>Abrir no Estúdio</span>
                </button>
              </div>

              {activeClientCalendars.length === 0 ? (
                <div className={styles.emptyState}>
                  <MonitorPlay size={32} strokeWidth={1.5} />
                  <strong>Nenhuma apresentação gerada para {activeClient.name}</strong>
                  <p style={{ margin: 0, fontSize: "13px" }}>
                    Crie um calendário no estúdio para gerar a primeira apresentação de conteúdo deste cliente.
                  </p>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    style={{ marginTop: "8px", maxWidth: "200px" }}
                    onClick={() => onOpenPlanner(activeClient, activeMonth)}
                  >
                    <span>Criar Calendário</span>
                  </button>
                </div>
              ) : (
                <div className={styles.presentationsGrid}>
                  {activeClientCalendars.map((cal) => {
                    const fStatus = cal.client_feedback_status;
                    const isApproved = fStatus === "approve" || fStatus === "approved";
                    const isApprovedNotes = fStatus === "approve_with_notes" || fStatus === "approved_with_notes";
                    const isRejectedNotes = fStatus === "reject_with_notes" || fStatus === "rejected_with_notes";
                    const isWaiting = !fStatus && Boolean(cal.share_token);

                    return (
                      <div key={cal.id} className={styles.presentationCard}>
                        <div className={styles.cardTop}>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <span className={styles.cardTypeBadge}>
                              <CalendarDays size={11} />
                              Conteúdo Mensal
                            </span>
                            {Boolean(cal.is_pre_calendar) && (
                              <span className={styles.cardPreBadge}>
                                <FileText size={11} />
                                Pré-Calendário
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className={styles.cardTitle}>{formatMonthTitle(cal.month)}</h3>
                          <div className={styles.cardSub}>{cal.title || `Planejamento de ${cal.brand}`}</div>
                        </div>

                        {/* Status de Aprovação */}
                        <div>
                          {isApproved ? (
                            <span className={`${styles.statusPill} ${styles.statusApproved}`}>
                              <CheckCircle2 size={12} />
                              Aprovado pelo Cliente
                            </span>
                          ) : isApprovedNotes ? (
                            <span className={`${styles.statusPill} ${styles.statusApprovedNotes}`}>
                              <AlertCircle size={12} />
                              Aprovado c/ Ressalvas
                            </span>
                          ) : isRejectedNotes ? (
                            <span className={`${styles.statusPill} ${styles.statusRejectedNotes}`}>
                              <AlertCircle size={12} />
                              Ajustes Solicitados
                            </span>
                          ) : isWaiting ? (
                            <span className={`${styles.statusPill} ${styles.statusWaiting}`}>
                              <Clock size={12} />
                              Aguardando Cliente
                            </span>
                          ) : (
                            <span className={`${styles.statusPill} ${styles.statusDraft}`}>
                              <Clock size={12} />
                              Em Produção Interna
                            </span>
                          )}
                        </div>

                        {/* Métricas do card */}
                        <div className={styles.cardStats}>
                          <span><strong>{cal.items_count || 0}</strong> publicações</span>
                          <span>•</span>
                          <span>Mês: <strong>{cal.month}</strong></span>
                        </div>

                        {/* Ações */}
                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={() => handleLaunchPresentation(cal)}
                            title="Abrir apresentação interativa em tela cheia"
                          >
                            <MonitorPlay size={13} />
                            <span>Apresentar</span>
                          </button>

                          <button
                            type="button"
                            className={`${styles.btnSecondary} ${copiedId === cal.id ? styles.copiedBadge : ""}`}
                            onClick={() => handleCopyClientLink(cal)}
                            title="Copiar link exclusivo do cliente"
                          >
                            {copiedId === cal.id ? <Check size={13} /> : <Share2 size={13} />}
                            <span>{copiedId === cal.id ? "Copiado!" : "Link"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Card preparado para o futuro: outros tipos de apresentação */}
                  <div className={styles.futureCard}>
                    <Layers size={26} strokeWidth={1.5} />
                    <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Novos Formatos de Apresentação</strong>
                    <p style={{ margin: 0, fontSize: "11px", lineHeight: "1.4" }}>
                      Em breve: Apresentações de Estratégia de Marca, Propostas e Relatórios Mensais de BI integrados neste mesmo espaço.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>
              <Users size={32} />
              <strong>Selecione um cliente</strong>
              <p>Escolha um cliente à esquerda para visualizar suas apresentações.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
