"use client";
/** Catálogo de clientes com indicadores do calendário para a competência selecionada. */

import { useState, useMemo } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  CalendarDays,
  MonitorPlay,
  Trash2,
  Pencil,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { Client, SafeUser } from "../lib/types";
import { ClientModal } from "./ClientModal";
import styles from "./ClientsControl.module.css";

/** Dados e ações que pertencem ao contêiner; esta tela não duplica a fonte da lista. */
interface ClientsControlProps {
  clients: Client[];
  activeMonth: Date;
  onMonthChange: (month: Date) => void;
  onOpenPlanner: (client: Client) => void;
  onOpenPresentation: (client: Client) => void;
  onReloadClients: () => Promise<void>;
  currentUser: SafeUser;
  onOpenCreateDemand?: () => void;
}

/** Filtra o catálogo, calcula KPIs mensais e administra o cadastro local de clientes. */
export function ClientsControl({
  clients,
  onOpenPlanner,
  onOpenPresentation,
  onReloadClients,
  currentUser,
  onOpenCreateDemand,
}: ClientsControlProps) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const openNewModal = () => {
    setEditingClient(null);
    setShowModal(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setShowModal(true);
  };

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.segment && c.segment.toLowerCase().includes(q))
    );
  }, [clients, search]);

  const kpis = useMemo(() => {
    let ready = 0;
    let inProgress = 0;
    let pending = 0;

    for (const c of clients) {
      const itemsCount = c.month_items_count || 0;
      const status = c.month_calendar_status;

      if (status === "approved") {
        ready++;
      } else if (itemsCount > 0) {
        inProgress++;
      } else {
        pending++;
      }
    }

    return {
      total: clients.length,
      ready,
      inProgress,
      pending,
    };
  }, [clients]);

  const handleDeleteClient = async (client: Client) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir o cliente "${client.name}"? Todos os seus calendários serão removidos.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await onReloadClients();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir cliente");
      }
    } catch {
      alert("Falha de conexão ao excluir cliente");
    }
  };

  return (
    <div className={styles.root}>
      {/* UI: título do catálogo e contexto da competência exibida. */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Controle de Clientes</h1>
          <p>
            Status operacional dos planejamentos e calendários para o mês.
          </p>
        </div>

        <div className={styles.headerActions}>
          {(currentUser.role === "admin" || currentUser.role === "social_media") && onOpenCreateDemand && (
            <button
              type="button"
              className={styles.newDemandBtn}
              onClick={onOpenCreateDemand}
              title="Criar nova demanda global ou extra para um cliente"
            >
              <Plus size={16} />
              <span>Nova Demanda</span>
            </button>
          )}

          <button
            type="button"
            className={styles.newClientBtn}
            onClick={openNewModal}
          >
            <Plus size={16} />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* UI: cartões informativos com o volume e o progresso das competências. */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper}>
            <Users size={18} />
          </div>
          <div className={styles.kpiInfo}>
            <span>TOTAL DE CLIENTES</span>
            <strong>{kpis.total}</strong>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div
            className={styles.kpiIconWrapper}
            style={{
              background: "rgba(22, 163, 74, 0.12)",
              color: "#16a34a",
            }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div className={styles.kpiInfo}>
            <span>PRONTOS PARA APRESENTAÇÃO</span>
            <strong style={{ color: "#16a34a" }}>{kpis.ready}</strong>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div
            className={styles.kpiIconWrapper}
            style={{
              background: "rgba(2, 132, 199, 0.12)",
              color: "#0284c7",
            }}
          >
            <Clock size={18} />
          </div>
          <div className={styles.kpiInfo}>
            <span>EM PRODUÇÃO</span>
            <strong style={{ color: "#0284c7" }}>{kpis.inProgress}</strong>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div
            className={styles.kpiIconWrapper}
            style={{
              background: "rgba(227, 0, 47, 0.12)",
              color: "#e3002f",
            }}
          >
            <AlertCircle size={18} />
          </div>
          <div className={styles.kpiInfo}>
            <span>PENDENTES NO MÊS</span>
            <strong style={{ color: "#e3002f" }}>{kpis.pending}</strong>
          </div>
        </div>
      </div>

      {/* UI: campo de busca rápida com ícone decorativo. */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por cliente ou segmento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* UI: listagem dos clientes; vazia instrui o operador a criar o primeiro registro. */}
      <div className={styles.clientList}>
        {filteredClients.length === 0 ? (
          <div className={styles.emptyList}>
            <Users size={32} className={styles.emptyIcon} />
            <h2>Nenhum cliente encontrado</h2>
            <p>
              {search
                ? "Nenhum cliente corresponde ao filtro de busca informado."
                : "Cadastre seu primeiro cliente para iniciar o planejamento de conteúdo."}
            </p>
            {!search && (
              <button
                type="button"
                className={styles.newClientBtn}
                onClick={openNewModal}
              >
                <Plus size={16} />
                <span>Cadastrar Cliente Agora</span>
              </button>
            )}
          </div>
        ) : (
          filteredClients.map((client) => {
            const itemsCount = client.month_items_count || 0;
            const feedbackStatus = client.month_client_feedback_status;
            const isPre = Boolean(
              Number(client.month_is_pre_calendar) === 1 ||
              client.month_is_pre_calendar === true ||
              client.has_pre_calendar
            );

            const isApproved = feedbackStatus === "approve" || feedbackStatus === "approved";
            const isApprovedWithNotes = feedbackStatus === "approve_with_notes" || feedbackStatus === "approved_with_notes";
            const isRejectedWithNotes = feedbackStatus === "reject_with_notes" || feedbackStatus === "rejected_with_notes";
            const isWaitingReview = !feedbackStatus && Boolean(client.month_share_token);
            const isInternalApproved = !feedbackStatus && client.month_calendar_status === "approved";
            const isInProgress = !feedbackStatus && !isInternalApproved && itemsCount > 0;
            const isPending = !feedbackStatus && !isInternalApproved && !isInProgress;
            const clientInitials = client.name.slice(0, 2).toUpperCase();

            return (
              <div key={client.id} className={styles.clientRow}>
                <div className={styles.clientIdentity}>
                  <div
                    className={styles.clientAvatar}
                    style={{
                      background: client.logo_url ? "transparent" : (client.accent || "var(--tenant-primary)"),
                      padding: client.logo_url ? "0.2rem" : "0",
                    }}
                  >
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      clientInitials
                    )}
                  </div>
                  <div className={styles.clientDetails}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <h3>{client.name}</h3>
                      {Boolean(client.has_pre_calendar) && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: "rgba(227, 0, 47, 0.15)",
                            color: "#ff6b81",
                            fontWeight: 600,
                            letterSpacing: "0.03em",
                            border: "1px solid rgba(227, 0, 47, 0.3)",
                          }}
                        >
                          Pré-calendário
                        </span>
                      )}
                    </div>
                    <span>{client.segment || "Segmento não informado"}</span>
                  </div>
                </div>

                <div className={styles.statusColumn}>
                  {isApproved && (
                    <div className={cn(styles.statusPill, styles.statusPillApproved)}>
                      <div className={styles.statusDot} />
                      <span>{isPre ? "PRÉ-CALENDÁRIO APROVADO" : "CALENDÁRIO APROVADO"}</span>
                    </div>
                  )}
                  {isApprovedWithNotes && (
                    <div
                      className={cn(styles.statusPill, styles.statusPillApprovedNotes)}
                      title={client.month_client_feedback ? `Ressalvas: ${client.month_client_feedback}` : undefined}
                    >
                      <div className={styles.statusDot} />
                      <span>APROVADO C/ RESSALVAS</span>
                    </div>
                  )}
                  {isRejectedWithNotes && (
                    <div
                      className={cn(styles.statusPill, styles.statusPillRejectedNotes)}
                      title={client.month_client_feedback ? `Motivo: ${client.month_client_feedback}` : undefined}
                    >
                      <div className={styles.statusDot} />
                      <span>REPROVADO C/ RESSALVAS</span>
                    </div>
                  )}
                  {isWaitingReview && (
                    <div className={cn(styles.statusPill, styles.statusPillWaiting)}>
                      <div className={styles.statusDot} />
                      <span>AGUARDANDO APROVAÇÃO</span>
                    </div>
                  )}
                  {isInternalApproved && (
                    <div className={cn(styles.statusPill, styles.statusPillReady)}>
                      <div className={styles.statusDot} />
                      <span>PRONTO PARA APRESENTAÇÃO</span>
                    </div>
                  )}
                  {isInProgress && (
                    <div className={cn(styles.statusPill, styles.statusPillProgress)}>
                      <div className={styles.statusDot} />
                      <span>EM PRODUÇÃO</span>
                    </div>
                  )}
                  {isPending && (
                    <div className={cn(styles.statusPill, styles.statusPillPending)}>
                      <div className={styles.statusDot} />
                      <span>PENDENTE NO MÊS</span>
                    </div>
                  )}
                  {client.month_client_feedback && (
                    <span className={styles.feedbackNoteSnippet} title={client.month_client_feedback}>
                      💬 &quot;{client.month_client_feedback.slice(0, 45)}{client.month_client_feedback.length > 45 ? "..." : ""}&quot;
                    </span>
                  )}
                  <span className={styles.postVolumeInfo}>
                    {itemsCount === 0
                      ? "Nenhum post planejado neste mês"
                      : `${itemsCount} post${itemsCount > 1 ? "s" : ""} planejado${
                          itemsCount > 1 ? "s" : ""
                        }`}
                  </span>
                </div>

                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionBtnPlan}
                    onClick={() => onOpenPlanner(client)}
                    title="Abrir o planejador para compor e escrever publicações"
                  >
                    <CalendarDays size={14} />
                    <span>Planejar & Escrever</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionBtnPresent}
                    onClick={() => onOpenPresentation(client)}
                    title="Abrir a apresentação deste cliente"
                  >
                    <MonitorPlay size={14} />
                    <span>Apresentação</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionBtnEdit}
                    onClick={() => openEditModal(client)}
                    title="Editar informações e logo do cliente"
                  >
                    <Pencil size={13} />
                    <span>Editar</span>
                  </button>

                  {(currentUser.role === "admin" ||
                    currentUser.id === client.created_by_id) && (
                    <button
                      type="button"
                      className={styles.deleteClientBtn}
                      onClick={() => handleDeleteClient(client)}
                      title="Excluir cliente"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ClientModal
        isOpen={showModal}
        editingClient={editingClient}
        onClose={() => setShowModal(false)}
        onSaved={onReloadClients}
      />
    </div>
  );
}
