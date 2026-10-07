"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Plus,
  Edit2,
  Users,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import styles from "./HomeScreen.module.css";
import type { SafeUser, Client, CalendarCycle } from "@/lib/types";
import { parseMonthKey, monthLabel } from "@/lib/date";
import { WorkUnitDrawer } from "../tasks/WorkUnitDrawer";

interface HomeScreenProps {
  currentUser: SafeUser;
  clients: Client[];
  onOpenPlanner: (client: Client, monthStr?: string) => void;
  onOpenCreateDemand?: () => void;
}

export function HomeScreen({
  currentUser,
  clients,
  onOpenPlanner,
  onOpenCreateDemand,
}: HomeScreenProps) {
  const [roleWorkspace, setRoleWorkspace] = useState<"social_media" | "designer">(
    currentUser.role === "designer" ? "designer" : "social_media"
  );
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal para editar/cadastrar prazo do ciclo
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [savingCycle, setSavingCycle] = useState(false);

  // Filtro de designer e cliente no acompanhamento
  const [filterDesigner, setFilterDesigner] = useState("all");
  const [filterClient, setFilterClient] = useState("all");

  // Drawer de detalhes de demanda ao clicar
  const [selectedWorkUnitId, setSelectedWorkUnitId] = useState<string | null>(null);

  const loadHomeData = async (role: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/home?role=${role}`);
      const json = await res.json();
      setData(json);
      if (json.cycle) {
        setNewDeadline(json.cycle.global_deadline || "");
        setNewTitle(json.cycle.title || "");
        setNewNotes(json.cycle.notes || "");
      }
    } catch (err) {
      console.error("Erro ao carregar dados da Home:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData(roleWorkspace);
  }, [roleWorkspace]);

  const handleSaveCycleDeadline = async () => {
    if (!newDeadline || !data?.cycle?.month) return;
    try {
      setSavingCycle(true);
      const res = await fetch("/api/calendar-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: data.cycle.month,
          globalDeadline: newDeadline,
          title: newTitle,
          notes: newNotes,
        }),
      });
      if (res.ok) {
        setShowCycleModal(false);
        await loadHomeData(roleWorkspace);
      }
    } catch (err) {
      console.error("Erro ao salvar prazo do ciclo:", err);
    } finally {
      setSavingCycle(false);
    }
  };

  // Cálculo da urgência do prazo global
  const deadlineUrgency = useMemo(() => {
    if (!data?.globalDeadline) return { label: "", type: "normal" };
    const today = new Date().toISOString().slice(0, 10);
    const deadline = data.globalDeadline;

    if (deadline === today) {
      return { label: "Entrega hoje", type: "today" };
    }
    if (deadline < today) {
      return { label: "Prazo vencido", type: "overdue" };
    }

    const todayDate = new Date();
    const dDate = new Date(deadline);
    const diffDays = Math.ceil((dDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays <= 7) {
      return { label: "Entrega nesta semana", type: "thisWeek" };
    }
    return { label: `Faltam ${diffDays} dias`, type: "normal" };
  }, [data?.globalDeadline]);

  // Lista de designers únicos para o filtro
  const uniqueDesigners = useMemo(() => {
    if (!data?.followUp?.calendars) return [];
    const set = new Set<string>();
    data.followUp.calendars.forEach((c: any) => {
      if (c.designerName) set.add(c.designerName);
    });
    return Array.from(set);
  }, [data?.followUp?.calendars]);

  // Calendários filtrados
  const filteredCalendars = useMemo(() => {
    if (!data?.followUp?.calendars) return [];
    return data.followUp.calendars.filter((c: any) => {
      if (filterDesigner !== "all" && c.designerName !== filterDesigner) return false;
      if (filterClient !== "all" && c.clientId !== filterClient) return false;
      return true;
    });
  }, [data?.followUp?.calendars, filterDesigner, filterClient]);

  const handleOpenCalendarByClient = (clientId: string, monthStr?: string) => {
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      onOpenPlanner(found, monthStr);
    }
  };

  if (isLoading && !data) {
    return (
      <div className={styles.homeContainer}>
        <div style={{ textAlign: "center", padding: "4rem 0", color: "#64748b" }}>
          Carregando seu espaço de trabalho...
        </div>
      </div>
    );
  }

  const cycle = data?.cycle;
  const isAuthorizedToEditCycle =
    currentUser.role === "admin" || currentUser.role === "social_media";

  return (
    <div className={styles.homeContainer}>
      {/* 1. Header de Boas-vindas com Alternador de Papel (Role-based Workspace) */}
      <div className={styles.welcomeHeader}>
        <div className={styles.greetingGroup}>
          <h1>Bom dia, {currentUser.name.split(" ")[0]}</h1>
          <p className={styles.greetingSubtitle}>
            {roleWorkspace === "social_media"
              ? "Workspace Social Media • Planejamento e validação de copywriting"
              : "Workspace Designer • Produção de artes e criativos"}
          </p>
        </div>

        <div className={styles.headerActions}>
          {/* Seletor Social Media / Designer para administradores e papéis múltiplos */}
          {currentUser.role === "admin" && (
            <div className={styles.workspaceRoleToggle}>
              <button
                className={`${styles.roleToggleBtn} ${
                  roleWorkspace === "social_media" ? styles.active : ""
                }`}
                onClick={() => setRoleWorkspace("social_media")}
              >
                Social Media
              </button>
              <button
                className={`${styles.roleToggleBtn} ${
                  roleWorkspace === "designer" ? styles.active : ""
                }`}
                onClick={() => setRoleWorkspace("designer")}
              >
                Designer
              </button>
            </div>
          )}

          {onOpenCreateDemand && (
            <button className={styles.createDemandBtn} onClick={onOpenCreateDemand}>
              <Plus size={15} />
              <span>Criar demanda</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Destaque: Prazo Global dos Calendários */}
      <section className={styles.globalDeadlineCard}>
        <div className={styles.globalDeadlineTop}>
          <div>
            <h2 className={styles.cycleTitle}>{cycle?.title || "Entrega dos Calendários"}</h2>
            <div className={styles.deadlineHighlight}>
              <CalendarDays size={18} color="var(--accent, #ef5d3d)" />
              <span>
                Prazo geral: <strong>{data?.globalDeadline || "A definir"}</strong>
              </span>
              {deadlineUrgency.label && (
                <span
                  className={`${styles.deadlineUrgencyBadge} ${
                    styles[deadlineUrgency.type] || ""
                  }`}
                >
                  {deadlineUrgency.label}
                </span>
              )}
            </div>
            <p className={styles.cycleNotes}>
              {cycle?.notes ||
                "Todos os designers vinculados a este ciclo compartilham a mesma data final de entrega."}
            </p>
          </div>

          {isAuthorizedToEditCycle && (
            <button
              className={styles.cycleEditBtn}
              onClick={() => setShowCycleModal(true)}
              title="Configurar prazo compartilhado do ciclo"
            >
              <Edit2 size={13} />
              <span>Configurar prazo</span>
            </button>
          )}
        </div>

        {/* Resumo de Entregas do Ciclo */}
        <div className={styles.cycleProgressSummary}>
          <div className={styles.metricItem}>
            <span>Total de Calendários:</span>
            <strong>{data?.summary?.totalCalendars || 0}</strong>
          </div>
          <div className={styles.metricItem}>
            <span style={{ color: "#10b981" }}>Entregues:</span>
            <strong>{data?.summary?.deliveredCalendars || 0}</strong>
          </div>
          <div className={styles.metricItem}>
            <span style={{ color: "#f59e0b" }}>Pendentes:</span>
            <strong>{data?.summary?.pendingCalendars || 0}</strong>
          </div>
        </div>

        {/* Acompanhamento por Designer / Cliente */}
        <div className={styles.followUpSection}>
          <div className={styles.followUpHeader}>
            <span className={styles.followUpTitle}>
              {roleWorkspace === "designer"
                ? "Seus Calendários no Ciclo"
                : "Acompanhamento de Calendários"}
            </span>

            {/* Filtros rápidos */}
            {roleWorkspace !== "designer" && (
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  value={filterDesigner}
                  onChange={(e) => setFilterDesigner(e.target.value)}
                  style={{
                    fontSize: "0.75rem",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #e2e8f0)",
                  }}
                >
                  <option value="all">Todos os Designers</option>
                  {uniqueDesigners.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  style={{
                    fontSize: "0.75rem",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #e2e8f0)",
                  }}
                >
                  <option value="all">Todos os Clientes</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className={styles.followUpGrid}>
            {filteredCalendars.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "#64748b", padding: "8px 0" }}>
                Nenhum calendário pendente neste filtro.
              </div>
            ) : (
              filteredCalendars.map((cal: any) => (
                <div
                  key={cal.id}
                  className={styles.calendarCard}
                  onClick={() => setSelectedWorkUnitId(cal.id)}
                  title="Clique para ver as subdemandas deste calendário na gaveta lateral"
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.clientName}>{cal.clientName}</span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "999px",
                        background: cal.isDelivered
                          ? "rgba(16, 185, 129, 0.1)"
                          : "rgba(245, 158, 11, 0.1)",
                        color: cal.isDelivered ? "#059669" : "#d97706",
                      }}
                    >
                      {cal.isDelivered ? "Entregue" : "Em Produção"}
                    </span>
                  </div>

                  <div className={styles.designerPill}>
                    Responsável: <strong>{cal.designerName}</strong>
                  </div>

                  <div className={styles.calendarActions}>
                    <span style={{ color: "#64748b" }}>
                      {cal.approvedItemsCount}/{cal.itemsCount} aprovados ({cal.progressPercent}%)
                    </span>
                    <button
                      type="button"
                      className={styles.openCalendarLink}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCalendarByClient(cal.clientId, cal.month);
                      }}
                    >
                      <span>Abrir calendário</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 3. Bloco: Precisa de Atenção */}
      <section className={styles.attentionSection}>
        <h3 className={styles.sectionHeading}>
          <AlertCircle size={16} color="#d97706" />
          <span>Precisa de atenção</span>
        </h3>

        <div className={styles.attentionBadgesGrid}>
          {data?.attentionItems?.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "#10b981", fontWeight: 600 }}>
              ✓ Tudo em dia! Nenhuma pendência urgente no momento.
            </div>
          ) : (
            data?.attentionItems?.map((item: any) => (
              <div
                key={item.id}
                className={`${styles.attentionBadge} ${styles[item.badgeType] || ""}`}
                onClick={() => handleOpenCalendarByClient(item.clientId, item.month)}
                title={`Clique para abrir ${item.clientName}`}
              >
                <span>{item.reason}</span>
                <strong>• {item.clientName}</strong>
                <ArrowRight size={12} />
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Grid Principal: Meu Trabalho de Hoje & Próximos 7 Dias / Continuar */}
      <div className={styles.mainWorkGrid}>
        {/* Coluna Esquerda: Meu Trabalho de Hoje */}
        <section className={styles.workCardContainer}>
          <h3 className={styles.sectionHeading}>
            <CheckSquare size={16} />
            <span>Meu trabalho de hoje</span>
          </h3>

          {data?.todayWork?.length === 0 ? (
            <div className={styles.emptyStateMessage}>
              Nenhuma publicação programada para entrega hoje.
            </div>
          ) : (
            <table className={styles.workTable}>
              <thead>
                <tr>
                  <th>Demanda / Cliente</th>
                  <th>Prazo</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {data?.todayWork?.map((item: any) => (
                  <tr
                    key={item.id}
                    className={styles.workTableRow}
                    onClick={() => handleOpenCalendarByClient(item.clientId, item.month)}
                  >
                    <td>
                      <div className={styles.demandTitle}>{item.title}</div>
                      <div className={styles.demandClient}>
                        {item.clientName} • {item.type}
                      </div>
                    </td>
                    <td>
                      <span>{item.dueDate}</span>
                      {item.isAfterGlobalDeadline && (
                        <span
                          className={styles.overdueWarning}
                          title="Atenção: Prevista para depois do prazo global do ciclo"
                        >
                          ⚠️ &gt; ciclo
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={styles.actionTag}>{item.actionLabel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Coluna Direita: Próximos 7 Dias & Continuar de onde parei */}
        <div className={styles.sideWorkCol}>
          {/* Próximos 7 Dias */}
          <section className={styles.workCardContainer}>
            <h3 className={styles.sectionHeading}>
              <Clock size={16} />
              <span>Próximos 7 dias</span>
            </h3>

            {data?.next7DaysWork?.length === 0 ? (
              <div className={styles.emptyStateMessage}>
                Nenhuma entrega agendada para os próximos 7 dias.
              </div>
            ) : (
              data?.next7DaysWork?.map((group: any) => (
                <div key={group.date} className={styles.dayGroup}>
                  <span className={styles.dayLabel}>{group.dateFormatted}</span>
                  {group.items.map((it: any) => (
                    <div
                      key={it.id}
                      className={styles.dayItem}
                      onClick={() => handleOpenCalendarByClient(it.clientId, it.month)}
                    >
                      <div>
                        <strong>{it.clientName}</strong> • {it.title} ({it.type})
                      </div>
                      {it.isAfterGlobalDeadline && (
                        <span style={{ fontSize: "0.7rem", color: "#dc2626", fontWeight: 700 }}>
                          ⚠️ pós-ciclo
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </section>

          {/* Continuar de onde parei */}
          <section className={styles.workCardContainer}>
            <h3 className={styles.sectionHeading}>
              <span>Continuar de onde parei</span>
            </h3>

            <div className={styles.recentGrid}>
              {data?.recentCalendars?.length === 0 ? (
                <div className={styles.emptyStateMessage}>
                  Nenhum calendário acessado recentemente.
                </div>
              ) : (
                data?.recentCalendars?.map((rec: any) => (
                  <div
                    key={rec.id}
                    className={styles.recentItem}
                    onClick={() => handleOpenCalendarByClient(rec.clientId, rec.month)}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{rec.clientName}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {rec.title} • {rec.designerName}
                      </div>
                    </div>
                    <ExternalLink size={13} color="#94a3b8" />
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Modal de Configuração do Prazo Global */}
      {showCycleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowCycleModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "1.75rem",
              borderRadius: "12px",
              maxWidth: "460px",
              width: "90%",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
              Definir Prazo Global do Ciclo
            </h3>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
              Todos os calendários vinculados a <strong>{cycle?.month}</strong> compartilharão este
              mesmo prazo final de entrega.
            </p>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                Título do Ciclo:
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Entrega dos Calendários de Novembro"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                Data Final de Entrega:
              </label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                Observações / Instruções Gerais:
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Ex: Todos os designers devem concluir seus calendários até essa data."
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setShowCycleModal(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCycleDeadline}
                disabled={savingCycle}
                style={{
                  background: "var(--accent, #ef5d3d)",
                  color: "#ffffff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.82rem",
                }}
              >
                {savingCycle ? "Salvando..." : "Salvar Prazo Global"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer com subdemandas ao clicar em uma demanda/calendário na Home */}
      <WorkUnitDrawer
        workUnitId={selectedWorkUnitId}
        onClose={() => setSelectedWorkUnitId(null)}
        onOpenCalendar={(clientId, month) => {
          setSelectedWorkUnitId(null);
          handleOpenCalendarByClient(clientId, month);
        }}
        onStatusUpdated={() => loadHomeData(roleWorkspace)}
      />
    </div>
  );
}
