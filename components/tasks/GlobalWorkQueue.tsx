"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  CheckSquare,
  Search,
  Kanban as KanbanIcon,
  List as ListIcon,
  Trash2,
  MoreHorizontal,
  RotateCcw,
  Eye,
  EyeOff,
  Filter,
  Users,
  User,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import styles from "./GlobalWorkQueue.module.css";
import { WorkUnitDrawer } from "./WorkUnitDrawer";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  type WorkQueueItem,
  type TaskStatus,
} from "@/lib/task-types";

interface ClientOption {
  id: string;
  name: string;
  primaryColor?: string;
}

interface GlobalWorkQueueProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  clients: ClientOption[];
  onOpenPlanner?: (client: ClientOption, monthStr?: string) => void;
}

interface ColumnDef {
  id: TaskStatus;
  title: string;
  color: string;
  styleKey: "notStarted" | "inProgress" | "waiting" | "awaitingApproval" | "completed";
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: "not_started", title: "Não iniciado", color: "#94a3b8", styleKey: "notStarted" },
  { id: "in_progress", title: "Em execução", color: "#38bdf8", styleKey: "inProgress" },
  { id: "waiting", title: "Em espera", color: "#f59e0b", styleKey: "waiting" },
  { id: "awaiting_approval", title: "Aguardando aprovação", color: "#ec4899", styleKey: "awaitingApproval" },
  { id: "completed", title: "Completo", color: "#10b981", styleKey: "completed" },
];

export function GlobalWorkQueue({
  currentUser,
  clients,
  onOpenPlanner,
}: GlobalWorkQueueProps) {
  // 1. Escopo padrão: "me" (Meu Trabalho - user-scoped work queue)
  const [scope, setScope] = useState<"me" | "team">("me");
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // 4. Exibir Concluídos controla diretamente includeCompleted (default false)
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(false);
  
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedWorkUnitId, setSelectedWorkUnitId] = useState<string | null>(null);

  // Expansão de demanda mãe na lista (Accordion)
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());
  const [unitTasksMap, setUnitTasksMap] = useState<Record<string, any[]>>({});
  const [loadingUnitsMap, setLoadingUnitsMap] = useState<Record<string, boolean>>({});

  const toggleUnitExpansion = async (unitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedUnitIds);
    if (next.has(unitId)) {
      next.delete(unitId);
      setExpandedUnitIds(next);
      return;
    }

    next.add(unitId);
    setExpandedUnitIds(next);

    if (!unitTasksMap[unitId]) {
      try {
        setLoadingUnitsMap((prev) => ({ ...prev, [unitId]: true }));
        const res = await fetch(`/api/tasks/${unitId}`);
        const data = await res.json();
        if (data.details?.tasks) {
          setUnitTasksMap((prev) => ({ ...prev, [unitId]: data.details.tasks }));
        }
      } catch (err) {
        console.error("Erro ao carregar subdemandas da unidade:", err);
      } finally {
        setLoadingUnitsMap((prev) => ({ ...prev, [unitId]: false }));
      }
    }
  };

  // Soft Delete & Undo
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    title: string;
    kind: "workUnit" | "task";
  } | null>(null);
  const [lastDeletedItem, setLastDeletedItem] = useState<{
    item: WorkQueueItem;
    kind: "workUnit" | "task";
  } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Popover ref
  const advancedPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        advancedPopoverRef.current &&
        !advancedPopoverRef.current.contains(e.target as Node)
      ) {
        setShowAdvancedFilters(false);
      }
    }
    if (showAdvancedFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAdvancedFilters]);

  // Fetch Work Queue
  const fetchWorkQueue = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("scope", scope);
      params.set("includeCompleted", includeCompleted ? "true" : "false");
      if (selectedClientId) params.set("clientId", selectedClientId);
      if (selectedType) params.set("type", selectedType);
      if (selectedStatus) params.set("status", selectedStatus);
      if (searchQuery) params.set("search", searchQuery);
      
      // Filtro de responsável só é enviado no escopo de equipe
      if (scope === "team" && selectedResponsible && selectedResponsible !== "all") {
        params.set("responsibleFilter", selectedResponsible);
      }

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar fila de trabalho");
      const data = await res.json();
      setItems(data.items || []);
      if (data.teamMembers) {
        setTeamMembers(data.teamMembers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkQueue();
  }, [scope, selectedClientId, selectedType, selectedStatus, selectedResponsible, includeCompleted]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchWorkQueue();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const counts = {
      total: items.length,
      not_started: 0,
      in_progress: 0,
      waiting: 0,
      awaiting_approval: 0,
      completed: 0,
    };
    items.forEach((item) => {
      if (item.status === "not_started") counts.not_started++;
      else if (item.status === "in_progress") counts.in_progress++;
      else if (item.status === "waiting") counts.waiting++;
      else if (item.status === "awaiting_approval") counts.awaiting_approval++;
      else if (item.status === "completed") counts.completed++;
    });
    return counts;
  }, [items]);

  // 7. Kanban: coluna representa status. Completed só entra quando includeCompleted === true
  const visibleColumns = useMemo(() => {
    if (!includeCompleted && selectedStatus !== "completed") {
      return ALL_COLUMNS.filter((col) => col.id !== "completed");
    }
    return ALL_COLUMNS;
  }, [includeCompleted, selectedStatus]);

  // Drag and Drop (apenas para status)
  const [draggedItem, setDraggedItem] = useState<{ id: string; kind: "workUnit" | "task" } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const isDraggingRef = useRef(false);

  const handleDragStart = (e: React.DragEvent, item: WorkQueueItem) => {
    isDraggingRef.current = true;
    setDraggedItem({ id: item.id, kind: item.kind });
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ id: item.id, kind: item.kind })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setDragOverColumn(null);
    }
  };

  const handleStatusDrop = async (itemId: string, newStatus: TaskStatus, kind: "workUnit" | "task") => {
    const currentItem = items.find((i) => i.id === itemId);
    if (!currentItem || currentItem.status === newStatus) return;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: newStatus } : it))
    );

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: itemId,
          status: newStatus,
          kind,
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar novo status");
      }
    } catch (err) {
      console.error("Falha ao mover card:", err);
      fetchWorkQueue();
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    let itemId = e.dataTransfer.getData("text/plain") || draggedItem?.id;
    let itemKind: "workUnit" | "task" = draggedItem?.kind || "workUnit";

    try {
      const json = e.dataTransfer.getData("application/json");
      if (json) {
        const parsed = JSON.parse(json);
        if (parsed.id) itemId = parsed.id;
        if (parsed.kind) itemKind = parsed.kind;
      }
    } catch {}

    if (itemId) {
      handleStatusDrop(itemId, targetStatus, itemKind);
    }

    setDraggedItem(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  // Soft Delete flow
  const promptDelete = (e: React.MouseEvent, item: WorkQueueItem) => {
    e.stopPropagation();
    setItemToDelete({
      id: item.id,
      title: item.title,
      kind: item.kind,
    });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    const foundItem = items.find((i) => i.id === target.id);

    // Optimistic removal
    setItems((prev) => prev.filter((i) => i.id !== target.id));
    if (foundItem) {
      setLastDeletedItem({ item: foundItem, kind: target.kind });
      setShowToast(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setShowToast(false);
      }, 6000);
    }

    setItemToDelete(null);

    try {
      await fetch(`/api/tasks?id=${target.id}&kind=${target.kind}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Erro ao excluir tarefa:", err);
      fetchWorkQueue();
    }
  };

  const handleUndo = async () => {
    if (!lastDeletedItem) return;
    const { item, kind } = lastDeletedItem;

    // Optimistic restore
    setItems((prev) => [item, ...prev]);
    setShowToast(false);
    setLastDeletedItem(null);

    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          id: item.id,
          kind,
        }),
      });
    } catch (err) {
      console.error("Erro ao restaurar tarefa:", err);
      fetchWorkQueue();
    }
  };

  const handleCardClick = (item: WorkQueueItem) => {
    if (isDraggingRef.current) return;
    if (item.kind === "workUnit") {
      setSelectedWorkUnitId(item.id);
    } else if (item.workUnitId) {
      setSelectedWorkUnitId(item.workUnitId);
    }
  };

  const handleOpenCalendarFromDrawer = (clientId: string, month: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client && onOpenPlanner) {
      onOpenPlanner(client, month);
    }
  };

  const getStatusStyleClass = (st: TaskStatus) => {
    switch (st) {
      case "not_started":
        return styles.notStarted;
      case "in_progress":
        return styles.inProgress;
      case "waiting":
        return styles.waiting;
      case "awaiting_approval":
        return styles.awaitingApproval;
      case "completed":
        return styles.completed;
      default:
        return styles.notStarted;
    }
  };

  const clearAllFilters = () => {
    setSelectedClientId("");
    setSelectedStatus("");
    setSelectedType("");
    setSelectedResponsible("all");
    setSearchQuery("");
    setShowAdvancedFilters(false);
  };

  const hasActiveFilters =
    Boolean(selectedClientId) ||
    Boolean(selectedStatus) ||
    Boolean(selectedType) ||
    (scope === "team" && selectedResponsible !== "all") ||
    Boolean(searchQuery);

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon}>
              <CheckSquare size={20} />
            </div>
            <div className={styles.headerTextGroup}>
              <div className={styles.titleWithScope}>
                <h1 className={styles.title}>
                  {scope === "me" ? "Meu Trabalho" : "Fila da Equipe"}
                </h1>

                {/* 2. Alternador de visão de gestão: Minha fila | Toda a equipe */}
                <div className={styles.scopeSwitcher}>
                  <button
                    className={`${styles.scopeBtn} ${scope === "me" ? styles.active : ""}`}
                    onClick={() => {
                      setScope("me");
                      setSelectedResponsible("all");
                    }}
                  >
                    Minha fila
                  </button>
                  <button
                    className={`${styles.scopeBtn} ${scope === "team" ? styles.active : ""}`}
                    onClick={() => setScope("team")}
                  >
                    Toda a equipe
                  </button>
                </div>
              </div>

              {/* 3. Contadores compactos sem badge pollution */}
              <div className={styles.compactMetrics}>
                <span>
                  <strong>{metrics.total}</strong> {metrics.total === 1 ? "tarefa" : "tarefas"}
                </span>
                {metrics.in_progress > 0 && (
                  <>
                    <span className={styles.metricDivider}>·</span>
                    <span>
                      <span className={`${styles.metricDot} ${styles.inProgress}`} />
                      {metrics.in_progress} em execução
                    </span>
                  </>
                )}
                {metrics.awaiting_approval > 0 && (
                  <>
                    <span className={styles.metricDivider}>·</span>
                    <span>
                      <span className={`${styles.metricDot} ${styles.awaitingApproval}`} />
                      {metrics.awaiting_approval} aguardando aprovação
                    </span>
                  </>
                )}
                {metrics.waiting > 0 && (
                  <>
                    <span className={styles.metricDivider}>·</span>
                    <span>
                      <span className={`${styles.metricDot} ${styles.waiting}`} />
                      {metrics.waiting} em espera
                    </span>
                  </>
                )}
                {includeCompleted && metrics.completed > 0 && (
                  <>
                    <span className={styles.metricDivider}>·</span>
                    <span>{metrics.completed} concluídas</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.topRightActions}>
            {/* 4. Exibir Concluídos controla o filtro diretamente */}
            <button
              className={`${styles.toggleCompletedBtn} ${includeCompleted ? styles.active : ""}`}
              onClick={() => setIncludeCompleted((prev) => !prev)}
              title={includeCompleted ? "Ocultar tarefas concluídas" : "Exibir tarefas concluídas"}
            >
              {includeCompleted ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{includeCompleted ? "Ocultar Concluídos" : "Exibir Concluídos"}</span>
            </button>

            <div className={styles.viewSwitcher}>
              <button
                className={`${styles.viewBtn} ${viewMode === "kanban" ? styles.active : ""}`}
                onClick={() => setViewMode("kanban")}
              >
                <KanbanIcon size={14} />
                <span>Kanban</span>
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === "list" ? styles.active : ""}`}
                onClick={() => setViewMode("list")}
              >
                <ListIcon size={14} />
                <span>Lista</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5. Barra de filtros simplificada: [ Buscar tarefas... ] [ Cliente ] [ Status ] [ Tipo ] [ Filtros + ] */}
        <div className={styles.controlsRow}>
          <div className={styles.searchAndFilters}>
            <div className={styles.searchBox}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Buscar tarefas..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className={styles.filterSelect}
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Cliente: Todos</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={selectedStatus}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStatus(val);
                if (val === "completed") {
                  setIncludeCompleted(true);
                }
              }}
            >
              <option value="">Status: Todos</option>
              <option value="not_started">Não iniciado</option>
              <option value="in_progress">Em execução</option>
              <option value="waiting">Em espera</option>
              <option value="awaiting_approval">Aguardando aprovação</option>
              {includeCompleted && <option value="completed">Completo</option>}
            </select>

            <select
              className={styles.filterSelect}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">Tipo: Todos</option>
              <option value="calendar">Calendários</option>
              <option value="extra_request">Artes Extras</option>
              <option value="campaign">Campanhas</option>
              <option value="project">Projetos</option>
            </select>

            {/* 2. Filtro por responsável habilitado apenas no escopo de equipe */}
            {scope === "team" && (
              <select
                className={styles.filterSelect}
                value={selectedResponsible}
                onChange={(e) => setSelectedResponsible(e.target.value)}
              >
                <option value="all">Responsável: Todos</option>
                <option value="me">Responsável: Eu</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}

            {/* 6. Filtros secundários via popover [ Filtros + ] */}
            <div className={styles.advancedFiltersWrapper} ref={advancedPopoverRef}>
              <button
                className={`${styles.advancedFiltersBtn} ${showAdvancedFilters || hasActiveFilters ? styles.active : ""}`}
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                title="Filtros adicionais"
              >
                <Filter size={13} />
                <span>Filtros +</span>
              </button>

              {showAdvancedFilters && (
                <div className={styles.advancedFiltersPopover}>
                  <p className={styles.popoverTitle}>Filtros Avançados</p>
                  
                  {hasActiveFilters && (
                    <button className={styles.clearFiltersBtn} onClick={clearAllFilters}>
                      Limpar todos os filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Board Area */}
      {/* 15. Loading State com Skeletons elegantes */}
      {isLoading ? (
        <div className={styles.kanbanArea}>
          <div className={styles.loadingBanner}>
            <span>Carregando suas tarefas...</span>
          </div>
          <div
            className={styles.kanbanColumns}
            style={{ "--col-count": visibleColumns.length } as React.CSSProperties}
          >
            {visibleColumns.map((col) => (
              <div key={col.id} className={styles.skeletonColumn}>
                <div className={styles.skeletonHeader} />
                <div className={styles.skeletonCard} />
                <div className={styles.skeletonCard} />
              </div>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        /* 16. Estado Vazio Limpo */
        <div className={styles.emptyState}>
          <CheckSquare size={32} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>
            {scope === "me" ? "Você não tem tarefas pendentes." : "Nenhuma tarefa pendente."}
          </h3>
          <p className={styles.emptySubtitle}>
            {scope === "me"
              ? "As novas demandas atribuídas a você aparecerão aqui."
              : "As novas demandas da equipe aparecerão aqui."}
          </p>
          {!includeCompleted && (
            <button
              className={styles.emptyActionBtn}
              onClick={() => setIncludeCompleted(true)}
            >
              Exibir concluídas
            </button>
          )}
        </div>
      ) : viewMode === "kanban" ? (
        /* 7 e 8. Kanban View: Uma única superfície por card, sem badge de status interna */
        <div className={styles.kanbanArea}>
          <div
            className={styles.kanbanColumns}
            style={{ "--col-count": visibleColumns.length } as React.CSSProperties}
          >
            {visibleColumns.map((col) => {
              const colItems = items.filter((item) => item.status === col.id);
              return (
                <div
                  key={col.id}
                  className={`${styles.column} ${
                    dragOverColumn === col.id ? styles.dragOver : ""
                  }`}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  <div className={styles.columnHeader}>
                    <div className={styles.columnTitleGroup}>
                      <span className={styles.columnDot} style={{ background: col.color }} />
                      <span className={styles.columnTitle}>{col.title}</span>
                    </div>
                    <span className={styles.columnBadge}>{colItems.length}</span>
                  </div>

                  <div className={styles.columnCards}>
                    {colItems.map((item) => (
                      <div
                        key={item.id}
                        className={`${styles.workCard} ${
                          draggedItem?.id === item.id ? styles.dragging : ""
                        }`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick(item)}
                      >
                        {/* Header: Título e Ações contextuais de hover */}
                        <div className={styles.cardHeader}>
                          <h3 className={styles.cardTitle}>{item.title}</h3>
                          <div
                            className={styles.cardHoverActions}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className={styles.cardActionIconBtn}
                              title="Ver detalhes"
                              onClick={() => handleCardClick(item)}
                            >
                              <MoreHorizontal size={13} />
                            </button>
                            <button
                              className={`${styles.cardActionIconBtn} ${styles.trashBtn}`}
                              title="Excluir da fila"
                              onClick={(e) => promptDelete(e, item)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Cliente: Dot sutil + Nome */}
                        <div className={styles.clientRow}>
                          <span
                            className={styles.clientDot}
                            style={{ background: item.clientAccent || "#3b82f6" }}
                          />
                          <span className={styles.clientName}>{item.clientName}</span>
                        </div>

                        {/* Metadados: Trabalho existente & Prazo */}
                        <div className={styles.cardMetaRow}>
                          <span className={styles.cardMetaText}>
                            {item.kind === "workUnit" ? (
                              item.userSpecificTaskCount !== undefined ? (
                                <span className={styles.highlightAssignee}>
                                  {item.userSpecificTaskCount}{" "}
                                  {item.userSpecificTaskCount === 1
                                    ? "tarefa para você"
                                    : "tarefas para você"}
                                </span>
                              ) : (
                                `${item.breakdown.feedStory} artes · ${item.breakdown.videos} vídeos`
                              )
                            ) : (
                              "Tarefa individual"
                            )}
                          </span>
                          {item.dueDate && (
                            <span className={styles.cardDueDate}>{item.dueDate}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 12. List View: Data List com row hover e divisores sutis */
        <div className={styles.listArea}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Cliente</th>
                  <th>Trabalho</th>
                  <th>Prazo</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", width: 90 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isExpanded = expandedUnitIds.has(item.id);
                  const isUnit = item.kind === "workUnit";
                  const subtasks = unitTasksMap[item.id] || [];
                  const isLoadingSubtasks = loadingUnitsMap[item.id];

                  return (
                    <React.Fragment key={item.id}>
                      <tr key={item.id} onClick={() => handleCardClick(item)}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {isUnit && (
                              <button
                                type="button"
                                onClick={(e) => toggleUnitExpansion(item.id, e)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "2px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  color: "var(--text-muted, #64748b)",
                                }}
                                title={isExpanded ? "Recolher tarefas" : "Expandir tarefas"}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                            <span className={styles.rowTitle}>{item.title}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.rowClient}>
                            <span
                              className={styles.clientDot}
                              style={{ background: item.clientAccent || "#3b82f6" }}
                            />
                            <span>{item.clientName}</span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.cardMetaText}>
                            {item.kind === "workUnit" ? (
                              item.userSpecificTaskCount !== undefined ? (
                                <span className={styles.highlightAssignee}>
                                  {item.userSpecificTaskCount} para você
                                </span>
                              ) : (
                                `${item.taskCount} tarefas`
                              )
                            ) : (
                              "1 tarefa"
                            )}
                          </span>
                        </td>
                        <td>
                          <span className={styles.cardDueDate}>{item.dueDate || "—"}</span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`${styles.rowStatusBadge} ${getStatusStyleClass(item.status)}`}
                          >
                            {TASK_STATUS_LABELS[item.status] || item.status}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className={styles.rowActions}>
                            {isUnit && item.type === "calendar" && item.sourceId && (
                              <button
                                className={styles.rowActionBtn}
                                title="Abrir planejamento no calendário"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCalendarFromDrawer(
                                    item.clientId,
                                    item.dueDate ? item.dueDate.slice(0, 7) : ""
                                  );
                                }}
                              >
                                <ExternalLink size={13} />
                              </button>
                            )}
                            <button
                              className={styles.rowActionBtn}
                              title="Ver detalhes na drawer"
                              onClick={() => handleCardClick(item)}
                            >
                              <MoreHorizontal size={13} />
                            </button>
                            <button
                              className={`${styles.rowActionBtn} ${styles.trash}`}
                              title="Excluir"
                              onClick={(e) => promptDelete(e, item)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Accordion Subtasks Rows */}
                      {isExpanded && (
                        <>
                          {isLoadingSubtasks && (
                            <tr style={{ background: "var(--surface-soft, #f8fafc)" }}>
                              <td colSpan={6} style={{ padding: "8px 2rem", fontSize: "0.8rem", color: "#64748b" }}>
                                Carregando tarefas vinculadas...
                              </td>
                            </tr>
                          )}
                          {!isLoadingSubtasks && subtasks.length === 0 && (
                            <tr style={{ background: "var(--surface-soft, #f8fafc)" }}>
                              <td colSpan={6} style={{ padding: "8px 2rem", fontSize: "0.8rem", color: "#64748b" }}>
                                Nenhuma subdemanda cadastrada.
                              </td>
                            </tr>
                          )}
                          {!isLoadingSubtasks &&
                            subtasks.map((st: any) => (
                              <tr
                                key={st.id}
                                style={{ background: "var(--surface-soft, #f8fafc)", cursor: "pointer" }}
                                onClick={() => handleCardClick(item)}
                              >
                                <td style={{ paddingLeft: "2.5rem" }}>
                                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                                    ↳ {st.title} ({st.type})
                                  </span>
                                </td>
                                <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                  {st.assigneeName || "Padrão"}
                                </td>
                                <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                  {st.type}
                                </td>
                                <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                  {st.dueDate || "—"}
                                </td>
                                <td>
                                  <span
                                    className={`${styles.rowStatusBadge} ${getStatusStyleClass(
                                      st.status
                                    )}`}
                                    style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                                  >
                                    {TASK_STATUS_LABELS[st.status as TaskStatus] || st.status}
                                  </span>
                                </td>
                                <td></td>
                              </tr>
                            ))}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9 e 11. Progressive Disclosure: Detalhes completos no lateral drawer */}
      <WorkUnitDrawer
        workUnitId={selectedWorkUnitId}
        onClose={() => setSelectedWorkUnitId(null)}
        onOpenCalendar={handleOpenCalendarFromDrawer}
        onStatusUpdated={fetchWorkQueue}
        teamMembers={teamMembers}
      />

      {/* 13. Modal de Exclusão (Soft Delete) */}
      {itemToDelete && (
        <div className={styles.modalOverlay} onClick={() => setItemToDelete(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIconTitle}>
              <div className={styles.confirmTrashIcon}>
                <Trash2 size={18} />
              </div>
              <h2 className={styles.confirmTitle}>Excluir tarefa?</h2>
            </div>
            <p className={styles.confirmMessage}>
              <span className={styles.confirmTargetName}>{itemToDelete.title}</span> será removida da fila.
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setItemToDelete(null)}
              >
                Cancelar
              </button>
              <button
                className={styles.deleteBtn}
                onClick={confirmDelete}
              >
                <Trash2 size={13} />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. Toast com Desfazer (Optimistic UI) */}
      {showToast && (
        <div className={styles.toastContainer}>
          <span className={styles.toastText}>Tarefa removida da sua fila.</span>
          <button className={styles.undoBtn} onClick={handleUndo}>
            <RotateCcw size={12} />
            <span>Desfazer</span>
          </button>
        </div>
      )}
    </div>
  );
}
