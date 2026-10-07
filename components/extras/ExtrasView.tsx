"use client";
/**
 * Visão dedicada para Demandas Extras do Cliente.
 * Substitui o modelo isolado de "Artes Extras" pelo modelo canônico de Work Units + Tasks,
 * consultando a mesma fonte de dados via /api/demands?clientId=...&type=extra_request.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ImagePlus,
  Plus,
  Search,
  CalendarDays,
  FileImage,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  X,
  User,
  CheckSquare,
} from "lucide-react";
import type { ContentItem, ContentStatus } from "../../lib/types";
import {
  type TaskStatus,
  type Priority,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "../../lib/task-types";
import type { ClientWorkUnitItem } from "../../lib/demand-service";
import { CreateDemandDrawer } from "../tasks/CreateDemandDrawer";

export interface ExtrasViewProps {
  clientId?: string;
  items?: ContentItem[];
  selectedId?: string | null;
  onSelect?: (item: ContentItem) => void;
  onUpdateItem?: (item: ContentItem) => void;
  onDeleteItem?: (id: string) => void;
  onCreateExtra?: (format?: string) => void;
  onOpenInEditor?: (item: ContentItem) => void;
  monthName?: string;
  availableProfiles?: string[];
  currentMonthKey?: string;
}

export function ExtrasView({
  clientId,
  items: legacyItems = [],
  onOpenInEditor,
  monthName,
}: ExtrasViewProps) {
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [workUnits, setWorkUnits] = useState<ClientWorkUnitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [expandedWu, setExpandedWu] = useState<Record<string, boolean>>({});

  // 16. Consulta a mesma fonte canônica de dados de Work Units
  const loadDemands = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/demands?clientId=${clientId}&type=extra_request`);
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setWorkUnits(data.items);
      }
    } catch (err) {
      console.error("Erro ao carregar demandas do cliente:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadDemands();
  }, [loadDemands]);

  // Alterna expansão de detalhes das tarefas de uma WorkUnit
  const toggleExpand = (wuId: string) => {
    setExpandedWu((prev) => ({
      ...prev,
      [wuId]: !prev[wuId],
    }));
  };

  // Alterna status de uma Task da WorkUnit
  const handleToggleTaskStatus = async (taskId: string, currentStatus: TaskStatus) => {
    const nextStatus: TaskStatus = currentStatus === "completed" ? "not_started" : "completed";
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          status: nextStatus,
          kind: "task",
        }),
      });
      await loadDemands();
    } catch (err) {
      console.error("Erro ao atualizar tarefa:", err);
    }
  };

  // Métricas agregadas
  const metrics = useMemo(() => {
    const total = workUnits.length;
    const byStatus: Record<string, number> = {
      not_started: 0,
      in_progress: 0,
      waiting: 0,
      awaiting_approval: 0,
      completed: 0,
    };
    workUnits.forEach((wu) => {
      const st = wu.status || "not_started";
      byStatus[st] = (byStatus[st] || 0) + 1;
    });
    return { total, byStatus };
  }, [workUnits]);

  // Itens filtrados
  const filteredWorkUnits = useMemo(() => {
    return workUnits.filter((wu) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = wu.title?.toLowerCase().includes(q);
        const descMatch = wu.description?.toLowerCase().includes(q);
        const taskMatch = wu.tasks?.some((t) => t.title.toLowerCase().includes(q));
        if (!titleMatch && !descMatch && !taskMatch) return false;
      }
      if (filterPriority !== "all" && wu.priority !== filterPriority) {
        return false;
      }
      if (filterStatus !== "all" && wu.status !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [workUnits, search, filterPriority, filterStatus]);

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return "Sem prazo";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        const parts = dateStr.split("T")[0].split("-");
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
      }
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="overviewContainer extrasViewContainer">
      {/* Barra de Ferramentas / Header das Demandas Extras */}
      <div className="overviewToolbar">
        <div className="overviewStatsGroup">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "rgba(2, 132, 199, 0.12)",
                color: "#0284c7",
              }}
            >
              <ImagePlus size={16} />
            </span>
            <strong style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
              Demandas Extras {monthName ? `• ${monthName}` : ""}
            </strong>
          </div>

          <div className="overviewStatPill total">
            <span>Total:</span>
            <strong>{metrics.total}</strong>
          </div>

          <div className="overviewStatsDivided">
            <span className="statMiniChip ideia" title="Não iniciadas">
              A Fazer <b>{metrics.byStatus.not_started}</b>
            </span>
            <span className="statMiniChip producao" title="Em Execução">
              Em Execução <b>{metrics.byStatus.in_progress}</b>
            </span>
            <span className="statMiniChip revisao" title="Aguardando Aprovação">
              Aprovação <b>{metrics.byStatus.awaiting_approval}</b>
            </span>
            <span className="statMiniChip aprovado" title="Concluídas">
              Concluídas <b>{metrics.byStatus.completed}</b>
            </span>
          </div>
        </div>

        <div className="overviewFiltersGroup" style={{ position: "relative" }}>
          <div className="overviewSearchBox">
            <Search size={14} className="overviewSearchIcon" />
            <input
              type="text"
              placeholder="Buscar demanda ou entrega..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="overviewClearSearch"
                onClick={() => setSearch("")}
                title="Limpar busca"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="overviewFilterSelectWrapper">
            <select
              className="overviewFilterSelect"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              title="Filtrar por Prioridade"
            >
              <option value="all">Todas as prioridades</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="normal">Normal</option>
              <option value="low">Baixa</option>
            </select>
          </div>

          <div className="overviewFilterSelectWrapper">
            <select
              className="overviewFilterSelect"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              title="Filtrar por Status"
            >
              <option value="all">Todos os status</option>
              <option value="not_started">Não iniciado</option>
              <option value="in_progress">Em execução</option>
              <option value="waiting">Em espera</option>
              <option value="awaiting_approval">Aguardando aprovação</option>
              <option value="completed">Concluído</option>
            </select>
          </div>

          <button
            type="button"
            className="primaryButton"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            onClick={() => setShowCreateDrawer(true)}
            title="Criar nova demanda global ou extra"
          >
            <Plus size={14} />
            <span>Nova Demanda</span>
          </button>
        </div>
      </div>

      {/* Grid de Demandas Extras */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {loading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 20px",
              color: "var(--text-muted, #94a3b8)",
            }}
          >
            <Clock size={24} style={{ animation: "spin 1s linear infinite", marginBottom: "8px" }} />
            <p>Carregando demandas extras...</p>
          </div>
        ) : filteredWorkUnits.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 20px",
              textAlign: "center",
              background: "var(--surface, #ffffff)",
              border: "1px dashed var(--border, #cbd5e1)",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(2, 132, 199, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0284c7",
                marginBottom: "16px",
              }}
            >
              <ImagePlus size={28} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--ink, #1e293b)" }}>
              Nenhuma demanda extra cadastrada
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted, #64748b)",
                maxWidth: "380px",
                margin: "0 0 20px 0",
                lineHeight: 1.5,
              }}
            >
              Crie demandas avulsas para banners, reels, criativos ou campanhas fora do fluxo tradicional de calendário.
            </p>
            <button
              type="button"
              className="primaryButton"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: 700,
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
              onClick={() => setShowCreateDrawer(true)}
            >
              <Plus size={16} />
              <span>Criar Primeira Demanda</span>
            </button>
          </div>
        ) : (
          filteredWorkUnits.map((wu) => {
            const isExpanded = Boolean(expandedWu[wu.id]);
            const priorityLabel = (wu.priority && PRIORITY_LABELS[wu.priority as Priority]) || "Normal";
            const priorityColor = (wu.priority && PRIORITY_COLORS[wu.priority as Priority]) || "#64748b";
            const statusLabel = TASK_STATUS_LABELS[wu.status as TaskStatus] || "Não iniciado";
            const statusColor = TASK_STATUS_COLORS[wu.status as TaskStatus] || "#94a3b8";

            return (
              <div
                key={wu.id}
                style={{
                  background: "var(--surface, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "14px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                  overflow: "hidden",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Cabeçalho da Demanda */}
                <div
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                    borderBottom: isExpanded ? "1px solid var(--border, #f1f5f9)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1, minWidth: "260px" }}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(wu.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted, #94a3b8)",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={isExpanded ? "Recolher entregas" : "Ver entregas"}
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "var(--ink, #1e293b)" }}>
                          {wu.title}
                        </h4>

                        {/* Badge de Prioridade */}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "999px",
                            color: priorityColor,
                            background: `${priorityColor}18`,
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {priorityLabel}
                        </span>

                        {/* Badge de Status */}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "999px",
                            color: statusColor,
                            background: `${statusColor}18`,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {wu.description && (
                        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted, #64748b)", lineHeight: 1.4 }}>
                          {wu.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Informações de Prazo e Progresso de Entregas */}
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", flexShrink: 0 }}>
                    <div style={{ textAlign: "right", fontSize: "12px" }}>
                      <span style={{ color: "var(--text-muted, #94a3b8)", display: "block" }}>Prazo:</span>
                      <strong style={{ color: "var(--ink, #1e293b)", fontWeight: 700 }}>
                        {formatDateDisplay(wu.dueDate)}
                      </strong>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "12px" }}>
                      <span style={{ color: "var(--text-muted, #94a3b8)", display: "block" }}>Entregas:</span>
                      <strong style={{ color: "#0284c7", fontWeight: 700 }}>
                        {wu.completedCount} / {wu.taskCount} concluídas
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(wu.id)}
                      style={{
                        padding: "6px 12px",
                        background: "var(--surface-soft, #f8fafc)",
                        border: "1px solid var(--border, #e2e8f0)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--ink, #334155)",
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? "Ocultar Tarefas" : `Ver Tarefas (${wu.taskCount})`}
                    </button>
                  </div>
                </div>

                {/* Lista Expandida de Tarefas / Entregas */}
                {isExpanded && (
                  <div
                    style={{
                      background: "var(--surface-soft, #f8fafc)",
                      padding: "12px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {wu.tasks.length === 0 ? (
                      <p style={{ margin: "8px 0", fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
                        Nenhuma entrega avulsa registrada nesta demanda.
                      </p>
                    ) : (
                      wu.tasks.map((task) => {
                        const isTaskDone = task.status === "completed";
                        return (
                          <div
                            key={task.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "12px",
                              padding: "10px 14px",
                              background: "#ffffff",
                              border: "1px solid var(--border, #e2e8f0)",
                              borderRadius: "8px",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                              <button
                                type="button"
                                onClick={() => handleToggleTaskStatus(task.id, task.status as TaskStatus)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: isTaskDone ? "#10b981" : "var(--text-muted, #cbd5e1)",
                                  display: "flex",
                                  alignItems: "center",
                                  padding: 0,
                                }}
                                title={isTaskDone ? "Marcar como pendente" : "Marcar como concluída"}
                              >
                                <CheckCircle2 size={18} />
                              </button>

                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "rgba(2, 132, 199, 0.08)",
                                  color: "#0284c7",
                                }}
                              >
                                {task.type}
                              </span>

                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: isTaskDone ? "var(--text-muted, #94a3b8)" : "var(--ink, #1e293b)",
                                  textDecoration: isTaskDone ? "line-through" : "none",
                                }}
                              >
                                {task.title}
                              </span>

                              {task.description && (
                                <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                                  — {task.description}
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px" }}>
                              <span style={{ color: "var(--text-muted, #64748b)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <User size={13} />
                                {task.assigneeName || "Padrão do cliente"}
                              </span>

                              <span style={{ color: "var(--text-muted, #94a3b8)" }}>
                                {formatDateDisplay(task.dueDate || wu.dueDate)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Gaveta de Criação de Demanda */}
      {clientId && (
        <CreateDemandDrawer
          isOpen={showCreateDrawer}
          onClose={() => setShowCreateDrawer(false)}
          clients={[{ id: clientId, name: "Cliente Atual" }]}
          preselectedClientId={clientId}
          onSuccess={async () => {
            setShowCreateDrawer(false);
            await loadDemands();
          }}
        />
      )}
    </div>
  );
}
