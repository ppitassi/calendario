"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  X,
  Calendar,
  Layers,
  Video,
  ExternalLink,
  Sparkles,
  Clock,
  Trash2,
  User,
  UserCheck,
  History,
  ListTodo,
  Info,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Maximize2,
  Minimize2,
  CloudDownload,
  CheckCircle2,
  Eye,
} from "lucide-react";
import styles from "./WorkUnitDrawer.module.css";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  type WorkUnitDetails,
  type TaskStatus,
  type ActivityEvent,
  type TeamMember,
} from "@/lib/task-types";
import { DesignerCopyViewer } from "./DesignerCopyViewer";
import { InstagramMockup } from "@/components/presentation/InstagramMockup";
import type { ContentItem } from "@/lib/types";

interface WorkUnitDrawerProps {
  workUnitId: string | null;
  onClose: () => void;
  onOpenCalendar?: (clientId: string, month: string) => void;
  onStatusUpdated?: () => void;
  teamMembers?: TeamMember[];
}

export function WorkUnitDrawer({
  workUnitId,
  onClose,
  onOpenCalendar,
  onStatusUpdated,
  teamMembers = [],
}: WorkUnitDrawerProps) {
  const [details, setDetails] = useState<WorkUnitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "tasks" | "activity">("tasks");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncingNextcloud, setIsSyncingNextcloud] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Navegação contextual para subdemanda dentro da mesma gaveta
  const [selectedSubtask, setSelectedSubtask] = useState<any | null>(null);

  // Fecha no Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedSubtask) {
          setSelectedSubtask(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedSubtask]);

  const fetchDetails = useCallback(async () => {
    if (!workUnitId) return;
    try {
      const res = await fetch(`/api/tasks/${workUnitId}`);
      if (!res.ok) throw new Error("Falha ao carregar detalhes");
      const data = await res.json();
      setDetails(data.details || null);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    }
  }, [workUnitId]);

  useEffect(() => {
    if (!workUnitId) {
      setDetails(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchDetails().finally(() => {
      setIsLoading(false);
    });
  }, [workUnitId, fetchDetails]);

  if (!workUnitId) return null;

  const unit = details?.unit;
  const tasks = details?.tasks || [];
  const events = details?.events || [];

  const handleUnitStatusChange = async (newStatus: TaskStatus) => {
    if (!unit) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: unit.id,
          status: newStatus,
          kind: "workUnit",
        }),
      });
      if (res.ok) {
        await fetchDetails();
        onStatusUpdated?.();
      }
    } catch (e) {
      console.error("Erro ao atualizar status:", e);
    }
  };

  const handleUnitOwnerChange = async (newOwnerId: string) => {
    if (!unit) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: unit.id,
          ownerId: newOwnerId,
          kind: "workUnit",
        }),
      });
      if (res.ok) {
        await fetchDetails();
        onStatusUpdated?.();
      }
    } catch (e) {
      console.error("Erro ao atualizar dono:", e);
    }
  };

  const handleUnitExecutorChange = async (newExecutorId: string) => {
    if (!unit) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: unit.id,
          executorId: newExecutorId || null,
          assigneeId: newExecutorId || null,
          kind: "workUnit",
        }),
      });
      if (res.ok) {
        await fetchDetails();
        onStatusUpdated?.();
      }
    } catch (e) {
      console.error("Erro ao atualizar executor:", e);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          kind: "task",
        }),
      });
      if (res.ok) {
        await fetchDetails();
        onStatusUpdated?.();
      }
    } catch (e) {
      console.error("Erro ao atualizar status da tarefa:", e);
    }
  };

  const handleTaskAssigneeChange = async (taskId: string, newAssigneeId: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          assigneeId: newAssigneeId || null,
          kind: "task",
        }),
      });
      if (res.ok) {
        await fetchDetails();
        onStatusUpdated?.();
      }
    } catch (e) {
      console.error("Erro ao atualizar executor da tarefa:", e);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks?id=${taskId}&kind=task`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchDetails();
        onStatusUpdated?.();
      }
    } catch (e) {
      console.error("Erro ao excluir tarefa:", e);
    }
  };

  const handleSyncNextcloud = async (specificTaskId?: string) => {
    if (!workUnitId) return;
    setIsSyncingNextcloud(true);
    setSyncFeedback(null);
    try {
      const res = await fetch(`/api/tasks/${workUnitId}/sync-nextcloud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: specificTaskId || selectedSubtask?.id || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao sincronizar com Nextcloud");
      }
      setSyncFeedback(data.message || `${data.importedCount || 0} arte(s) vinculada(s)!`);
      await fetchDetails();
      onStatusUpdated?.();
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback(`Erro: ${err.message || "Não foi possível puxar do Nextcloud"}`);
      setTimeout(() => setSyncFeedback(null), 6000);
    } finally {
      setIsSyncingNextcloud(false);
    }
  };

  // Helper to format event date/time
  const formatEventTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const getEventDateGroup = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return "HOJE";
      }
      if (date.toDateString() === yesterday.toDateString()) {
        return "ONTEM";
      }
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "HISTÓRICO";
    }
  };

  const renderEventDescription = (ev: ActivityEvent) => {
    const actor = ev.actorName || "Alguém";

    switch (ev.eventType) {
      case "task_created":
        return <span><strong>{actor}</strong> criou esta demanda</span>;
      case "status_changed": {
        const oldLabel = ev.oldValue ? (TASK_STATUS_LABELS[ev.oldValue as TaskStatus] || ev.oldValue) : "—";
        const newLabel = ev.newValue ? (TASK_STATUS_LABELS[ev.newValue as TaskStatus] || ev.newValue) : "—";
        return (
          <div>
            <span><strong>{actor}</strong> alterou o status</span>
            <div className={styles.timelineDiffBox}>
              <span className={styles.diffOld}>{oldLabel}</span>
              <ArrowRight size={11} className={styles.diffArrow} />
              <span className={styles.diffNew}>{newLabel}</span>
            </div>
          </div>
        );
      }
      case "calendar_created":
        return (
          <span>
            <strong>{actor}</strong> criou o calendário (herdando{" "}
            <strong>{ev.newValue || "responsável pelo cliente"}</strong> como dono)
          </span>
        );
      case "calendar_executor_assigned":
        return (
          <span>
            <strong>{actor}</strong> definiu{" "}
            <strong>{ev.newValue || "membro"}</strong> como executor do calendário
          </span>
        );
      case "calendar_executor_changed":
        return (
          <div>
            <span><strong>{actor}</strong> alterou o executor do calendário</span>
            <div className={styles.timelineDiffBox}>
              <span className={styles.diffOld}>{ev.oldValue || "Nenhum"}</span>
              <ArrowRight size={11} className={styles.diffArrow} />
              <span className={styles.diffNew}>{ev.newValue || "Nenhum"}</span>
            </div>
          </div>
        );
      case "task_assignee_changed":
        return (
          <span>
            <strong>{actor}</strong> atribuiu a tarefa para{" "}
            <strong>{ev.newValue || "membro"}</strong>
          </span>
        );
      case "task_assignment_inherited":
        return (
          <span>
            <strong>{actor}</strong> redefiniu a tarefa para herdar executor do calendário
          </span>
        );
      case "task_assignment_override_removed":
        return (
          <span>
            <strong>{actor}</strong> removeu override de atribuição da tarefa
          </span>
        );
      case "assigned":
        return (
          <span>
            <strong>{actor}</strong> atribuiu a execução da demanda para{" "}
            <strong>{ev.newValue || "membro"}</strong>
          </span>
        );
      case "owner_changed":
        return (
          <span>
            <strong>{actor}</strong> definiu o responsável direto como{" "}
            <strong>{ev.newValue || "membro"}</strong>
          </span>
        );
      case "completed":
        return <span><strong>{actor}</strong> concluiu esta tarefa</span>;
      case "deleted":
        return <span><strong>{actor}</strong> moveu a tarefa para a lixeira</span>;
      case "restored":
        return <span><strong>{actor}</strong> restaurou esta tarefa da lixeira</span>;
      case "attachment_added":
        return (
          <span>
            <strong>{actor}</strong> adicionou o arquivo{" "}
            <strong>{ev.newValue || "anexo"}</strong>
          </span>
        );
      case "attachment_removed":
        return (
          <span>
            <strong>{actor}</strong> removeu o arquivo{" "}
            <strong>{ev.oldValue || "anexo"}</strong>
          </span>
        );
      case "comment_added":
        return <span><strong>{actor}</strong> adicionou um comentário</span>;
      default:
        return (
          <span>
            <strong>{actor}</strong> atualizou <code>{ev.fieldName || "registro"}</code>
          </span>
        );
    }
  };

  // Group events by date label
  const groupedEvents = events.reduce<Record<string, ActivityEvent[]>>((acc, ev) => {
    const groupKey = getEventDateGroup(ev.createdAt);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(ev);
    return acc;
  }, {});

  const progressPercent = unit?.progress?.percent || 0;

  return (
    <div
      className={`${styles.overlay} ${isExpanded ? styles.overlayExpanded : ""}`}
      onClick={onClose}
    >
      <div
        className={`${styles.drawer} ${isExpanded ? styles.drawerExpanded : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className={styles.loadingArea}>
            <div className={styles.spinner} />
            <span>Carregando unidade de trabalho...</span>
          </div>
        )}

        {error && (
          <div className={styles.loadingArea}>
            <ShieldAlert size={24} color="#ef4444" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && unit && (
          <>
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerTop}>
                <div className={styles.clientBadge}>
                  <span
                    className={styles.clientDot}
                    style={{ background: unit.clientAccent || "#3b82f6" }}
                  />
                  <span>{unit.clientName}</span>
                </div>

                <div className={styles.headerActions}>
                  {/* Botão Puxar Artes do Nextcloud */}
                  <button
                    className={styles.syncNextcloudBtn}
                    onClick={() => handleSyncNextcloud()}
                    disabled={isSyncingNextcloud}
                    title="Buscar e vincular automaticamente arquivos que a equipe já salvou na pasta do cliente no Nextcloud"
                  >
                    <CloudDownload size={14} className={isSyncingNextcloud ? styles.spinning : ""} />
                    <span>{isSyncingNextcloud ? "Puxando..." : "Puxar do Nextcloud"}</span>
                  </button>

                  {/* Botão Full Size / Normal */}
                  <button
                    className={styles.expandToggleBtn}
                    onClick={() => setIsExpanded((prev) => !prev)}
                    title={isExpanded ? "Minimizar para gaveta lateral" : "Expandir em tela cheia (Modo Designer / Full Size)"}
                  >
                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>

                  {unit.type === "calendar" && unit.sourceId && onOpenCalendar && (
                    <button
                      className={styles.openCalendarBtn}
                      onClick={() => {
                        const month = unit.dueDate ? unit.dueDate.slice(0, 7) : "";
                        onOpenCalendar(unit.clientId, month);
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>Abrir Planejador</span>
                    </button>
                  )}
                  <button className={styles.closeBtn} onClick={onClose}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Feedback de Sincronização do Nextcloud */}
              {syncFeedback && (
                <div
                  className={`${styles.syncFeedbackBanner} ${
                    syncFeedback.startsWith("Erro") ? styles.error : styles.success
                  }`}
                >
                  <CheckCircle2 size={14} />
                  <span>{syncFeedback}</span>
                </div>
              )}

              <div className={styles.titleArea}>
                {selectedSubtask ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedSubtask(null)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "transparent",
                        border: "none",
                        color: "var(--accent, #ef5d3d)",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        marginBottom: "6px",
                        padding: 0,
                      }}
                    >
                      <ArrowLeft size={14} />
                      <span>Voltar à demanda mãe ({unit.title})</span>
                    </button>
                    <h2 className={styles.title}>{selectedSubtask.title}</h2>
                    <div className={styles.metaRow}>
                      <div className={styles.metaItem}>
                        <Calendar size={13} />
                        <span>Prazo: {selectedSubtask.dueDate || "Sem data"}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span style={{ color: "#64748b" }}>Tipo:</span>
                        <strong>{selectedSubtask.type}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className={styles.title}>{unit.title}</h2>
                    <div className={styles.metaRow}>
                      <div className={styles.metaItem}>
                        <Calendar size={13} />
                        <span>Prazo: {unit.dueDate || "Sem data"}</span>
                      </div>

                      <div className={styles.metaItem}>
                        <span style={{ color: "#64748b" }}>Status:</span>
                        <select
                          className={styles.statusSelect}
                          value={unit.status}
                          onChange={(e) =>
                            handleUnitStatusChange(e.target.value as TaskStatus)
                          }
                          style={{
                            borderColor: TASK_STATUS_COLORS[unit.status],
                            color: TASK_STATUS_COLORS[unit.status],
                          }}
                        >
                          <option value="not_started">Não iniciado</option>
                          <option value="in_progress">Em execução</option>
                          <option value="waiting">Em espera</option>
                          <option value="awaiting_approval">Aguardando aprovação</option>
                          <option value="completed">Completo</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Progress and Breakdown */}
              <div className={styles.progressSection}>
                <div className={styles.progressHeader}>
                  <span>
                    Progresso: {unit.progress?.completed || 0}/{unit.taskCount} concluídas
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className={styles.breakdownPills}>
                  {unit.breakdown.feedStory > 0 && (
                    <div className={styles.breakdownPill}>
                      <Layers size={13} color="#60a5fa" />
                      <span>{unit.breakdown.feedStory} Feed/Story</span>
                    </div>
                  )}
                  {unit.breakdown.videos > 0 && (
                    <div className={styles.breakdownPill}>
                      <Video size={13} color="#c084fc" />
                      <span>{unit.breakdown.videos} Vídeos</span>
                    </div>
                  )}
                  {unit.breakdown.extras > 0 && (
                    <div className={styles.breakdownPill}>
                      <Sparkles size={13} color="#facc15" />
                      <span>{unit.breakdown.extras} Extras</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabsNav}>
              <button
                className={`${styles.tabBtn} ${activeTab === "details" ? styles.active : ""}`}
                onClick={() => setActiveTab("details")}
              >
                <Info size={14} />
                <span>Detalhes</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === "tasks" ? styles.active : ""}`}
                onClick={() => setActiveTab("tasks")}
              >
                <ListTodo size={14} />
                <span>Tarefas</span>
                <span className={styles.tabBadge}>{tasks.length}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === "activity" ? styles.active : ""}`}
                onClick={() => setActiveTab("activity")}
              >
                <History size={14} />
                <span>Atividade</span>
                <span className={styles.tabBadge}>{events.length}</span>
              </button>
            </div>

            {/* Tab 1: Details and Ownership */}
            {activeTab === "details" && (
              <div className={styles.content}>
                <div className={styles.ownershipSection}>
                  <div className={styles.ownershipGrid}>
                    {/* Accountable Owner */}
                    <div className={styles.ownershipCard}>
                      <div className={styles.ownershipLabel}>
                        <UserCheck size={13} />
                        <span>Responsável (Dono do Cliente)</span>
                      </div>
                      <div className={styles.userPickerRow}>
                        <div className={styles.avatarSmall}>
                          {(unit.ownerName || "D").charAt(0).toUpperCase()}
                        </div>
                        <select
                          className={styles.userSelect}
                          value={unit.ownerId || ""}
                          onChange={(e) => handleUnitOwnerChange(e.target.value)}
                        >
                          <option value="">Não definido</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Default Calendar Executor */}
                    <div className={styles.ownershipCard}>
                      <div className={styles.ownershipLabel}>
                        <User size={13} />
                        <span>Executor do Calendário (Padrão)</span>
                      </div>
                      <div className={styles.userPickerRow}>
                        <div
                          className={styles.avatarSmall}
                          style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                        >
                          {(unit.executorName || unit.assigneeName || unit.ownerName || "E").charAt(0).toUpperCase()}
                        </div>
                        <select
                          className={styles.userSelect}
                          value={unit.executorId || unit.assigneeId || ""}
                          onChange={(e) => handleUnitExecutorChange(e.target.value)}
                        >
                          <option value="">
                            Usar Dono ({unit.ownerName || "Cliente"})
                          </option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Created By (Immutable Audit record) */}
                  <div className={styles.createdByCard}>
                    <span>Criado originalmente por:</span>
                    <span className={styles.createdByName}>
                      👤 {unit.createdByName || "Sistema"}
                    </span>
                  </div>

                  {/* Assignment Breakdown */}
                  {unit.assignmentBreakdown && unit.assignmentBreakdown.length > 0 && (
                    <div className={styles.breakdownSection}>
                      <div className={styles.breakdownSectionTitle}>
                        <Layers size={13} />
                        <span>Divisão de Execução (Assignment Breakdown)</span>
                      </div>
                      <div className={styles.breakdownList}>
                        {unit.assignmentBreakdown.map((b) => (
                          <div key={b.userId} className={styles.breakdownItemRow}>
                            <span>
                              <strong>{b.userName}</strong>
                              {b.isDefaultExecutor ? (
                                <span className={styles.breakdownBadgePrimary}>
                                  Executor principal
                                </span>
                              ) : (
                                <span className={styles.overrideTag} style={{ marginLeft: 6 }}>
                                  Override
                                </span>
                              )}
                            </span>
                            <span>
                              <strong>{b.count}</strong> {b.count === 1 ? "tarefa" : "tarefas"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Tasks List / Subdemanda Detalhada */}
            {activeTab === "tasks" && (
              <div className={styles.content}>
                {selectedSubtask ? (
                  /* Visualização Detalhada da Tarefa / Arte com Designer Workspace e Mockup Instagram */
                  <div className={styles.subtaskDetailContainer}>
                    <div className={styles.subtaskDetailHeader}>
                      <div>
                        <span className={styles.subtaskDetailBadge}>
                          {selectedSubtask.type || "Arte"}
                        </span>
                        <h3 className={styles.subtaskDetailTitle}>{selectedSubtask.title}</h3>
                        {selectedSubtask.dueDate && (
                          <span className={styles.subtaskDetailDueDate}>
                            <Clock size={12} /> Prazo: {selectedSubtask.dueDate}
                          </span>
                        )}
                      </div>

                      <div className={styles.subtaskDetailActions}>
                        <button
                          className={styles.syncNextcloudBtn}
                          onClick={() => handleSyncNextcloud(selectedSubtask.id)}
                          disabled={isSyncingNextcloud}
                          title="Puxar arte do Nextcloud diretamente para esta publicação"
                        >
                          <CloudDownload size={13} className={isSyncingNextcloud ? styles.spinning : ""} />
                          <span>{isSyncingNextcloud ? "Puxando..." : "Puxar Arte (Nextcloud)"}</span>
                        </button>

                        <button
                          className={styles.closeSubtaskBtn}
                          onClick={() => setSelectedSubtask(null)}
                        >
                          Voltar à lista
                        </button>
                      </div>
                    </div>

                    <div className={styles.workspaceGrid}>
                      {/* Coluna 1: Copy, Briefing e Metadados */}
                      <div className={styles.workspaceLeft}>
                        {(selectedSubtask.head ||
                          selectedSubtask.subhead ||
                          selectedSubtask.caption ||
                          selectedSubtask.visual ||
                          selectedSubtask.cta) ? (
                          <DesignerCopyViewer
                            item={{
                              id: selectedSubtask.id,
                              date: selectedSubtask.dueDate || "",
                              title: selectedSubtask.title,
                              type: (selectedSubtask.type as any) || "Feed",
                              status: "Produção",
                              channel: "Instagram",
                              head: selectedSubtask.head || "",
                              subhead: selectedSubtask.subhead || "",
                              caption: selectedSubtask.caption || "",
                              visual: selectedSubtask.visual || "",
                              cta: selectedSubtask.cta || "",
                              imageUrl: selectedSubtask.imageUrl || "",
                            }}
                          />
                        ) : (
                          <div className={styles.emptyCopyBox}>
                            <span>Nenhum copy ou texto cadastrado nesta tarefa.</span>
                          </div>
                        )}
                      </div>

                      {/* Coluna 2: Card do Instagram (Mockup Oficial) */}
                      <div className={styles.workspaceRight}>
                        <div className={styles.mockupContainer}>
                          <div className={styles.mockupHeaderInfo}>
                            <span>Simulação no Instagram</span>
                            {selectedSubtask.imageUrl && (
                              <span className={styles.hasArtBadge}>✓ Arte Vinculada</span>
                            )}
                          </div>

                          <InstagramMockup
                            post={{
                              id: selectedSubtask.id,
                              date: selectedSubtask.dueDate || "",
                              title: selectedSubtask.title,
                              type: (selectedSubtask.type as any) || "Feed",
                              status: "Produção",
                              channel: "Instagram",
                              head: selectedSubtask.head || "",
                              subhead: selectedSubtask.subhead || "",
                              caption: selectedSubtask.caption || "",
                              visual: selectedSubtask.visual || "",
                              cta: selectedSubtask.cta || "",
                              imageUrl: selectedSubtask.imageUrl || "",
                            }}
                            brand={unit.clientName}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Lista de Tarefas da Unidade */
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 className={styles.sectionTitle}>
                        Tarefas da Unidade ({tasks.length})
                      </h3>
                      {tasks.length > 0 && !isExpanded && (
                        <button
                          type="button"
                          className={styles.expandHintBtn}
                          onClick={() => setIsExpanded(true)}
                        >
                          <Maximize2 size={12} />
                          <span>Modo Designer (Full Size)</span>
                        </button>
                      )}
                    </div>

                    {tasks.length === 0 ? (
                      <div className={styles.emptyTasks}>
                        Nenhuma publicação ou tarefa cadastrada nesta unidade.
                      </div>
                    ) : (
                      <div className={styles.taskList}>
                        {tasks.map((task) => (
                          <div key={task.id} className={styles.taskCard}>
                            <div className={styles.taskCardTop}>
                              <div>
                                <span
                                  className={`${styles.taskTypeBadge} ${
                                    task.type.toLowerCase().includes("video") ||
                                    task.type.toLowerCase().includes("reels")
                                      ? styles.video
                                      : task.isExtra
                                      ? styles.extra
                                      : ""
                                  }`}
                                >
                                  {task.type}
                                </span>
                              </div>

                              <div className={styles.taskActions}>
                                <button
                                  className={styles.previewCardBtn}
                                  onClick={() => setSelectedSubtask(task)}
                                  title="Abrir prévia do Instagram e copy em destaque"
                                >
                                  <Eye size={12} />
                                  <span>Prévia & Arte</span>
                                </button>

                                <select
                                  className={styles.taskStatusSelect}
                                  value={task.status}
                                  onChange={(e) =>
                                    handleTaskStatusChange(
                                      task.id,
                                      e.target.value as TaskStatus
                                    )
                                  }
                                  style={{
                                    borderColor: TASK_STATUS_COLORS[task.status],
                                    color: TASK_STATUS_COLORS[task.status],
                                  }}
                                >
                                  <option value="not_started">Não iniciado</option>
                                  <option value="in_progress">Em execução</option>
                                  <option value="waiting">Em espera</option>
                                  <option value="awaiting_approval">Aguardando aprovação</option>
                                  <option value="completed">Completo</option>
                                </select>

                                <button
                                  className={styles.taskTrashBtn}
                                  title="Excluir tarefa"
                                  onClick={() => handleDeleteTask(task.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <h4
                              className={styles.taskTitle}
                              style={{ cursor: "pointer" }}
                              onClick={() => setSelectedSubtask(task)}
                              title="Clique para ver os detalhes e prévia do Instagram desta publicação"
                            >
                              {task.title}
                            </h4>

                            {(task.head || task.subhead || task.caption || task.visual || task.cta) && (
                              <div style={{ margin: "10px 0" }}>
                                <DesignerCopyViewer
                                  item={{
                                    id: task.id,
                                    date: task.dueDate || "",
                                    title: task.title,
                                    type: (task.type as any) || "Feed",
                                    status: "Produção",
                                    channel: "Instagram",
                                    head: task.head || "",
                                    subhead: task.subhead || "",
                                    caption: task.caption || "",
                                    visual: task.visual || "",
                                    cta: task.cta || "",
                                    imageUrl: task.imageUrl || "",
                                  }}
                                />
                              </div>
                            )}

                            <div className={styles.taskCardBottom}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                                  Executor:
                                </span>
                                <select
                                  className={styles.userSelect}
                                  style={{ padding: "2px 6px", fontSize: "0.72rem", maxWidth: 210 }}
                                  value={task.assigneeId || ""}
                                  onChange={(e) => handleTaskAssigneeChange(task.id, e.target.value)}
                                >
                                  <option value="">
                                    Herdar do calendário — {unit.executorName || unit.ownerName || "Padrão"}
                                  </option>
                                  {teamMembers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                                {task.isInheritedAssignment ? (
                                  <span className={styles.inheritedTag}>Herdado</span>
                                ) : (
                                  <span className={styles.overrideTag}>Override</span>
                                )}
                              </div>

                              {task.dueDate ? (
                                <div className={styles.taskDate}>
                                  <Clock size={12} />
                                  <span>{task.dueDate}</span>
                                </div>
                              ) : (
                                <span />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab 3: Activity Feed (Audit Trail Timeline) */}
            {activeTab === "activity" && (
              <div className={styles.content}>
                <h3 className={styles.sectionTitle}>
                  Histórico de Atividades ({events.length})
                </h3>

                {events.length === 0 ? (
                  <div className={styles.emptyTimeline}>
                    Nenhuma atividade registrada até o momento.
                  </div>
                ) : (
                  <div className={styles.timelineContainer}>
                    <div className={styles.timelineLine} />

                    {Object.entries(groupedEvents).map(([dateGroup, groupEvents]) => (
                      <div key={dateGroup} className={styles.timelineGroup}>
                        <div className={styles.timelineDateLabel}>{dateGroup}</div>

                        {groupEvents.map((ev) => {
                          const markerType =
                            ev.eventType === "status_changed"
                              ? styles.status
                              : ev.eventType === "assigned" || ev.eventType === "owner_changed"
                              ? styles.assigned
                              : ev.eventType === "task_created"
                              ? styles.created
                              : ev.eventType === "deleted"
                              ? styles.delete
                              : "";

                          return (
                            <div key={ev.id} className={styles.timelineItem}>
                              <div className={`${styles.timelineMarker} ${markerType}`} />
                              <div className={styles.timelineCard}>
                                <div className={styles.timelineCardHeader}>
                                  <div className={styles.actorInfo}>
                                    <div className={styles.actorAvatarMini}>
                                      {(ev.actorName || "U").charAt(0).toUpperCase()}
                                    </div>
                                    <span className={styles.actorName}>
                                      {ev.actorName || "Usuário"}
                                    </span>
                                  </div>
                                  <span className={styles.timelineTime}>
                                    {formatEventTime(ev.createdAt)}
                                  </span>
                                </div>
                                <div className={styles.timelineActionText}>
                                  {renderEventDescription(ev)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
