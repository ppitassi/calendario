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
      {/* 1. Saudação Direta no Canvas */}
      <div className={styles.welcomeHeader}>
        <div className={styles.greetingGroup}>
          <h1 className={styles.greetingTitle}>Bom dia, {currentUser.name.split(" ")[0]}</h1>
          <p className={styles.greetingSubtitle}>
            {roleWorkspace === "social_media"
              ? "Social Media · Planejamento e validação de copywriting"
              : "Designer · Produção de artes e criativos"}
          </p>
        </div>

        <div className={styles.headerActions}>
          {/* Seletor Social Media / Designer discreto tipo segmented control */}
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

      {/* 2. Seção Direta no Canvas: Entrega dos Calendários */}
      <section className={styles.cycleSection}>
        <div className={styles.cycleHeaderRow}>
          <div>
            <h2 className={styles.cycleSectionTitle}>
              {cycle?.title ? cycle.title : `Entrega dos calendários de ${monthLabel(new Date()).toLowerCase()}`}
            </h2>
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

        {/* Informações de prazo e contadores sem caixa */}
        <div className={styles.cycleDetailsRow}>
          <div className={styles.deadlineBlock}>
            <span className={styles.microLabel}>Prazo geral</span>
            <div className={styles.deadlineNumberGroup}>
              <strong className={styles.deadlineNumber}>
                {data?.globalDeadline || "A definir"}
              </strong>
              {deadlineUrgency.label && (
                <span className={`${styles.deadlineTag} ${styles[deadlineUrgency.type] || ""}`}>
                  {deadlineUrgency.label}
                </span>
              )}
            </div>
          </div>

          <div className={styles.cycleStatsBlock}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{data?.summary?.totalCalendars || 0}</span>
              <span className={styles.statLabel}>
                {(data?.summary?.totalCalendars || 0) === 1 ? "calendário" : "calendários"}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={`${styles.statValue} ${styles.statDelivered}`}>
                {data?.summary?.deliveredCalendars || 0}
              </span>
              <span className={styles.statLabel}>entregues</span>
            </div>
            <div className={styles.statItem}>
              <span className={`${styles.statValue} ${styles.statPending}`}>
                {data?.summary?.pendingCalendars || 0}
              </span>
              <span className={styles.statLabel}>pendentes</span>
            </div>
          </div>
        </div>

        {/* Lista de Calendários de forma sutil e linear */}
        {filteredCalendars.length > 0 && (
          <div className={styles.calendarsListBlock}>
            <div className={styles.calendarsListHeader}>
              <span className={styles.subSectionTitle}>
                {roleWorkspace === "designer" ? "Seus calendários no ciclo" : "Acompanhamento"}
              </span>

              {roleWorkspace !== "designer" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <select
                    value={filterDesigner}
                    onChange={(e) => setFilterDesigner(e.target.value)}
                    className={styles.minimalSelect}
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
                    className={styles.minimalSelect}
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

            <div className={styles.calendarRowList}>
              {filteredCalendars.map((cal: any) => (
                <div
                  key={cal.id}
                  className={styles.calendarRowItem}
                  onClick={() => handleOpenCalendarByClient(cal.clientId, cal.month)}
                  title="Abrir calendário"
                >
                  <div className={styles.calendarRowMain}>
                    <span className={styles.calendarRowClient}>{cal.clientName}</span>
                    <span className={styles.calendarRowMeta}>
                      {cal.designerName} · {cal.approvedItemsCount}/{cal.itemsCount} aprovados
                    </span>
                  </div>

                  <div className={styles.calendarRowRight}>
                    <span
                      className={`${styles.statusPill} ${
                        cal.isDelivered ? styles.pillDelivered : styles.pillPending
                      }`}
                    >
                      {cal.isDelivered ? "Entregue" : "Pendente"}
                    </span>
                    <ChevronRight size={14} className={styles.rowArrow} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className={styles.canvasDivider} />

      {/* 3. Precisa de Atenção — Direto no canvas */}
      <section className={styles.attentionCanvasSection}>
        <h3 className={styles.canvasSectionTitle}>Precisa de atenção</h3>
        {data?.attentionItems?.length === 0 ? (
          <p className={styles.attentionEmptyText}>
            ✓ Tudo em dia. Nenhuma pendência urgente no momento.
          </p>
        ) : (
          <div className={styles.attentionItemsList}>
            {data?.attentionItems?.map((item: any) => (
              <div
                key={item.id}
                className={styles.attentionTextItem}
                onClick={() => handleOpenCalendarByClient(item.clientId, item.month)}
              >
                <span className={styles.attentionDot} />
                <span>{item.reason}</span>
                <strong className={styles.attentionClientName}>· {item.clientName}</strong>
                <ArrowRight size={13} className={styles.attentionArrow} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={styles.canvasDivider} />

      {/* 4. Meu trabalho de hoje & Próximos 7 dias — Diretamente no Canvas */}
      <div className={styles.workColumnsGrid}>
        {/* Coluna 1: Meu trabalho de hoje */}
        <section className={styles.workColumn}>
          <h3 className={styles.canvasSectionTitle}>Meu trabalho de hoje</h3>
          {data?.todayWork?.length === 0 ? (
            <p className={styles.columnEmptyText}>
              Nenhuma publicação programada para hoje.
            </p>
          ) : (
            <div className={styles.workItemsStack}>
              {data?.todayWork?.map((item: any) => (
                <div
                  key={item.id}
                  className={styles.workRow}
                  onClick={() => handleOpenCalendarByClient(item.clientId, item.month)}
                >
                  <div className={styles.workRowContent}>
                    <strong className={styles.workRowTitle}>{item.title}</strong>
                    <span className={styles.workRowSub}>
                      {item.clientName} · {item.type}
                    </span>
                  </div>
                  <span className={styles.workRowStatus}>{item.actionLabel}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Coluna 2: Próximos 7 dias */}
        <section className={styles.workColumn}>
          <h3 className={styles.canvasSectionTitle}>Próximos 7 dias</h3>
          {data?.next7DaysWork?.length === 0 ? (
            <p className={styles.columnEmptyText}>
              Nenhuma entrega agendada para os próximos 7 dias.
            </p>
          ) : (
            <div className={styles.workItemsStack}>
              {data?.next7DaysWork?.map((group: any) => (
                <div key={group.date} className={styles.dayGroupRow}>
                  <span className={styles.dayGroupLabel}>{group.dateFormatted}</span>
                  {group.items.map((it: any) => (
                    <div
                      key={it.id}
                      className={styles.workRow}
                      onClick={() => handleOpenCalendarByClient(it.clientId, it.month)}
                    >
                      <div className={styles.workRowContent}>
                        <strong className={styles.workRowTitle}>{it.clientName}</strong>
                        <span className={styles.workRowSub}>
                          {it.title} ({it.type})
                        </span>
                      </div>
                      <ChevronRight size={13} className={styles.rowArrow} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={styles.canvasDivider} />

      {/* 5. Continuar de onde parei — Objeto Real (Card Reservado) */}
      <section className={styles.recentSection}>
        <h3 className={styles.canvasSectionTitle}>Continuar de onde parei</h3>
        {data?.recentCalendars?.length === 0 ? (
          <p className={styles.columnEmptyText}>Nenhum calendário acessado recentemente.</p>
        ) : (
          <div className={styles.recentObjectsGrid}>
            {data?.recentCalendars?.map((rec: any) => (
              <div
                key={rec.id}
                className={styles.recentObjectCard}
                onClick={() => handleOpenCalendarByClient(rec.clientId, rec.month)}
                title={`Abrir planejamento de ${rec.clientName}`}
              >
                <div className={styles.recentCardBody}>
                  <strong className={styles.recentCardTitle}>{rec.clientName}</strong>
                  <span className={styles.recentCardMeta}>
                    {rec.title} · {rec.designerName}
                  </span>
                </div>
                <div className={styles.recentCardAction}>
                  <ExternalLink size={14} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
