"use client";
/**
 * Visão Geral: visualização de todas as artes em formato Kanban ou Lista.
 * Permite alteração direta de Status, Formato e Etapa de Funil.
 */

import React, { useState, useMemo } from "react";
import {
  Kanban,
  List,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Layers,
  Smartphone,
  FileImage,
  Sparkles,
  Clock,
  Eye,
  CheckCircle2,
  Filter,
  X,
  CalendarDays,
  Film,
  Library,
} from "lucide-react";
import type { ContentItem, ContentStatus, ContentType } from "../lib/types";

export interface OverviewViewProps {
  items: ContentItem[];
  selectedId: string | null;
  onSelect: (item: ContentItem) => void;
  onUpdateItem: (item: ContentItem) => void;
  onDeleteItem: (id: string) => void;
  onCreateItem: () => void;
  mode: "kanban" | "list";
  onModeChange: (mode: "kanban" | "list") => void;
  onOpenInEditor: (item: ContentItem) => void;
  monthName?: string;
  availableProfiles?: string[];
}

const STATUS_COLUMNS: {
  id: ContentStatus;
  label: string;
  color: string;
  bgLight: string;
  borderLight: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}[] = [
  {
    id: "Ideia",
    label: "Ideia",
    color: "#6366f1",
    bgLight: "rgba(99, 102, 241, 0.08)",
    borderLight: "rgba(99, 102, 241, 0.25)",
    icon: Sparkles,
  },
  {
    id: "Produção",
    label: "Em Produção",
    color: "#0284c7",
    bgLight: "rgba(2, 132, 199, 0.08)",
    borderLight: "rgba(2, 132, 199, 0.25)",
    icon: Clock,
  },
  {
    id: "Revisão",
    label: "Em Revisão",
    color: "#d97706",
    bgLight: "rgba(217, 119, 6, 0.08)",
    borderLight: "rgba(217, 119, 6, 0.25)",
    icon: Eye,
  },
  {
    id: "Aprovado",
    label: "Aprovado",
    color: "#16a34a",
    bgLight: "rgba(22, 163, 74, 0.08)",
    borderLight: "rgba(22, 163, 74, 0.25)",
    icon: CheckCircle2,
  },
];

const FORMAT_OPTIONS: ContentType[] = [
  "Feed e Story",
  "Feed",
  "Story",
  "Carrossel",
  "Reels",
];

const FUNNEL_OPTIONS: ("Topo" | "Meio" | "Fundo")[] = ["Topo", "Meio", "Fundo"];

const STATUS_OPTIONS: ContentStatus[] = ["Ideia", "Produção", "Revisão", "Aprovado"];

export function OverviewView({
  items,
  selectedId,
  onSelect,
  onUpdateItem,
  onDeleteItem,
  onCreateItem,
  mode,
  onModeChange,
  onOpenInEditor,
  monthName,
  availableProfiles = [],
}: OverviewViewProps) {
  const [search, setSearch] = useState("");
  const [filterProfile, setFilterProfile] = useState("all");
  const [filterFormat, setFilterFormat] = useState("all");
  const [filterFunnel, setFilterFunnel] = useState("all");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ContentStatus | null>(null);

  // Perfis únicos disponíveis nos itens + suggestions
  const profileList = useMemo(() => {
    const set = new Set<string>();
    availableProfiles.forEach((p) => {
      if (p?.trim()) set.add(p.trim());
    });
    items.forEach((item) => {
      if (item.profile?.trim()) set.add(item.profile.trim());
      if (item.collabProfile?.trim()) set.add(item.collabProfile.trim());
    });
    return Array.from(set);
  }, [availableProfiles, items]);

  // Itens filtrados
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(q);
        const headMatch = item.head?.toLowerCase().includes(q);
        const captionMatch = item.caption?.toLowerCase().includes(q);
        const profileMatch = item.profile?.toLowerCase().includes(q);
        const collabMatch = item.collabProfile?.toLowerCase().includes(q);
        if (!titleMatch && !headMatch && !captionMatch && !profileMatch && !collabMatch) {
          return false;
        }
      }
      if (filterProfile !== "all") {
        const matchesProfile =
          item.profile === filterProfile || item.collabProfile === filterProfile;
        if (!matchesProfile) return false;
      }
      if (filterFormat !== "all" && item.type !== filterFormat) {
        return false;
      }
      if (filterFunnel !== "all" && (item.funnelStage || "Topo") !== filterFunnel) {
        return false;
      }
      return true;
    });
  }, [items, search, filterProfile, filterFormat, filterFunnel]);

  // Contadores para o resumo
  const metrics = useMemo(() => {
    const total = items.length;
    const byStatus: Record<ContentStatus, number> = {
      Ideia: 0,
      Produção: 0,
      Revisão: 0,
      Aprovado: 0,
    };
    const byFunnel: Record<string, number> = {
      Topo: 0,
      Meio: 0,
      Fundo: 0,
    };

    items.forEach((item) => {
      if (byStatus[item.status] !== undefined) {
        byStatus[item.status]++;
      }
      const funnel = item.funnelStage || "Topo";
      if (byFunnel[funnel] !== undefined) {
        byFunnel[funnel]++;
      }
    });

    return { total, byStatus, byFunnel };
  }, [items]);

  // Manipulação de drag-and-drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, status: ContentStatus) => {
    e.preventDefault();
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ContentStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    if (!id) return;
    const target = items.find((item) => item.id === id);
    if (target && target.status !== targetStatus) {
      onUpdateItem({ ...target, status: targetStatus });
    }
    setDraggedId(null);
  };

  // Helper para ícone de formato
  const getFormatIcon = (type: ContentType) => {
    switch (type) {
      case "Feed e Story":
        return <Layers size={13} />;
      case "Story":
        return <Smartphone size={13} />;
      case "Carrossel":
        return <Library size={13} />;
      case "Reels":
        return <Film size={13} />;
      default:
        return <FileImage size={13} />;
    }
  };

  // Helper para formatar data (ex: 2026-10-15 -> "15 Out")
  const formatDateBadge = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    const day = parts[2];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    return `${day} ${months[monthIndex] || ""}`;
  };

  return (
    <div className="overviewContainer">
      {/* Barra superior de métricas e filtros rápidos */}
      <header className="overviewToolbar">
        <div className="overviewStatsGroup">
          <div className="overviewStatPill total">
            <span>Total:</span>
            <strong>{metrics.total}</strong>
          </div>
          <div className="overviewStatsDivided">
            <span className="statMiniChip ideia" title="Status: Ideia">
              Ideia <b>{metrics.byStatus.Ideia}</b>
            </span>
            <span className="statMiniChip producao" title="Status: Em Produção">
              Produção <b>{metrics.byStatus.Produção}</b>
            </span>
            <span className="statMiniChip revisao" title="Status: Em Revisão">
              Revisão <b>{metrics.byStatus.Revisão}</b>
            </span>
            <span className="statMiniChip aprovado" title="Status: Aprovado">
              Aprovado <b>{metrics.byStatus.Aprovado}</b>
            </span>
          </div>
        </div>

        {/* Controles de filtro e busca */}
        <div className="overviewFiltersGroup">
          {/* Busca por texto */}
          <div className="overviewSearchBox">
            <Search size={14} className="overviewSearchIcon" />
            <input
              type="text"
              placeholder="Buscar por título, copy, @perfil..."
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

          {/* Filtro por Perfil */}
          {profileList.length > 0 && (
            <select
              className="overviewFilterSelect"
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
              title="Filtrar por perfil"
            >
              <option value="all">Todos os Perfis</option>
              {profileList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

          {/* Filtro por Formato */}
          <select
            className="overviewFilterSelect"
            value={filterFormat}
            onChange={(e) => setFilterFormat(e.target.value)}
            title="Filtrar por formato"
          >
            <option value="all">Todos os Formatos</option>
            {FORMAT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Filtro por Funil */}
          <select
            className="overviewFilterSelect"
            value={filterFunnel}
            onChange={(e) => setFilterFunnel(e.target.value)}
            title="Filtrar por etapa do funil"
          >
            <option value="all">Todo o Funil</option>
            <option value="Topo">Topo de Funil</option>
            <option value="Meio">Meio de Funil</option>
            <option value="Fundo">Fundo de Funil</option>
          </select>

          {/* Alternador Kanban / Lista */}
          <div className="overviewViewSwitch">
            <button
              type="button"
              className={`viewSwitchBtn ${mode === "kanban" ? "active" : ""}`}
              onClick={() => onModeChange("kanban")}
              title="Visão em Colunas Kanban"
            >
              <Kanban size={14} />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              className={`viewSwitchBtn ${mode === "list" ? "active" : ""}`}
              onClick={() => onModeChange("list")}
              title="Visão em Lista / Tabela"
            >
              <List size={14} />
              <span>Lista</span>
            </button>
          </div>

          {/* Botão de nova publicação */}
          <button
            type="button"
            className="overviewCreateBtn"
            onClick={onCreateItem}
            title="Criar nova publicação"
          >
            <Plus size={14} />
            <span>Nova Publicação</span>
          </button>
        </div>
      </header>

      {/* Conteúdo principal: Kanban ou Lista */}
      {filteredItems.length === 0 ? (
        <div className="overviewEmptyState">
          <CalendarDays size={42} className="emptyIcon" />
          <h3>Nenhuma publicação encontrada</h3>
          <p>
            {items.length === 0
              ? `Nenhum post agendado para ${monthName || "este mês"}.`
              : "Nenhum post corresponde aos filtros ou busca selecionados."}
          </p>
          {items.length === 0 ? (
            <button type="button" className="primaryButton" onClick={onCreateItem}>
              <Plus size={14} /> Criar primeira publicação
            </button>
          ) : (
            <button
              type="button"
              className="secondarySmallBtn"
              onClick={() => {
                setSearch("");
                setFilterProfile("all");
                setFilterFormat("all");
                setFilterFunnel("all");
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : mode === "kanban" ? (
        /* VISÃO EM KANBAN */
        <div className="kanbanBoard">
          {STATUS_COLUMNS.map((col) => {
            const columnItems = filteredItems.filter(
              (item) => item.status === col.id
            );
            const isOver = dragOverColumn === col.id;
            const ColIcon = col.icon;

            return (
              <div
                key={col.id}
                className={`kanbanColumn ${isOver ? "dragOver" : ""}`}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Cabeçalho da coluna */}
                <div
                  className="kanbanColumnHeader"
                  style={{
                    borderTopColor: col.color,
                  }}
                >
                  <div className="kanbanColumnTitleGroup">
                    <ColIcon size={14} style={{ color: col.color }} />
                    <strong style={{ color: col.color }}>{col.label}</strong>
                  </div>
                  <span className="kanbanColumnBadge">{columnItems.length}</span>
                </div>

                {/* Lista de cards da coluna */}
                <div className="kanbanCardsList">
                  {columnItems.map((item) => {
                    const activeThumb =
                      item.imageUrl ||
                      (item as any).image_url ||
                      item.storyUrl ||
                      (item as any).story_url ||
                      null;
                    const isSelected = selectedId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`kanbanCard ${isSelected ? "selected" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onClick={() => onSelect(item)}
                      >
                        {/* Imagem de preview (se houver) */}
                        {activeThumb ? (
                          <div className="kanbanCardThumb">
                            <img src={activeThumb} alt={item.title} loading="lazy" />
                            <span className="kanbanThumbFormat">
                              {getFormatIcon(item.type)}
                              <span>{item.type}</span>
                            </span>
                          </div>
                        ) : (
                          <div className="kanbanCardNoThumb">
                            {getFormatIcon(item.type)}
                            <span>{item.type}</span>
                          </div>
                        )}

                        <div className="kanbanCardBody">
                          {/* Topo do card: Data, Perfil e Excluir */}
                          <div className="kanbanCardTop">
                            <div className="kanbanCardMetaRow">
                              <span className="kanbanDateBadge">
                                {formatDateBadge(item.date)}
                              </span>
                              {item.profile && (
                                <span className="kanbanProfileBadge">
                                  {item.profile}
                                  {item.isCollab && item.collabProfile && (
                                    <span className="kanbanCollabSuffix">
                                      {" "}+ {item.collabProfile}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="kanbanDeleteBtn"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Deseja realmente excluir esta publicação?")) {
                                  onDeleteItem(item.id);
                                }
                              }}
                              title="Excluir post"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Título do post */}
                          <h4 className="kanbanCardTitle">
                            {item.title || "Publicação sem título"}
                          </h4>

                          {/* CONTROLES RÁPIDOS INLINE (MUDANÇA DE STATUS, FORMATO E FUNIL) */}
                          <div
                            className="kanbanControlsGrid"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* 1. STATUS */}
                            <div className="kanbanControlField">
                              <label>Status</label>
                              <select
                                className={`kanbanSelect statusSelect status-${item.status.toLowerCase()}`}
                                value={item.status}
                                onChange={(e) =>
                                  onUpdateItem({
                                    ...item,
                                    status: e.target.value as ContentStatus,
                                  })
                                }
                              >
                                {STATUS_OPTIONS.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 2. FORMATO */}
                            <div className="kanbanControlField">
                              <label>Formato</label>
                              <select
                                className="kanbanSelect formatSelect"
                                value={item.type || "Feed e Story"}
                                onChange={(e) =>
                                  onUpdateItem({
                                    ...item,
                                    type: e.target.value as ContentType,
                                  })
                                }
                              >
                                {FORMAT_OPTIONS.map((fmt) => (
                                  <option key={fmt} value={fmt}>
                                    {fmt}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 3. ETAPA DE FUNIL */}
                            <div className="kanbanControlField">
                              <label>Funil</label>
                              <select
                                className={`kanbanSelect funnelSelect funnel-${(
                                  item.funnelStage || "Topo"
                                ).toLowerCase()}`}
                                value={item.funnelStage || "Topo"}
                                onChange={(e) =>
                                  onUpdateItem({
                                    ...item,
                                    funnelStage: e.target.value as any,
                                  })
                                }
                              >
                                {FUNNEL_OPTIONS.map((fn) => (
                                  <option key={fn} value={fn}>
                                    {fn}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Rodapé do card: Abrir no Editor completo */}
                          <div className="kanbanCardFooter">
                            <button
                              type="button"
                              className="kanbanOpenEditorBtn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenInEditor(item);
                              }}
                              title="Abrir no editor com prévia do Instagram"
                            >
                              <span>Editar Detalhes</span>
                              <ExternalLink size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {columnItems.length === 0 && (
                    <div className="kanbanColumnEmpty">
                      <span>Nenhum post aqui</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISÃO EM LISTA / TABELA */
        <div className="listViewContainer">
          <table className="listViewTable">
            <thead>
              <tr>
                <th style={{ width: 64 }}>Arte</th>
                <th style={{ width: 110 }}>Data</th>
                <th>Publicação / Perfil</th>
                <th style={{ width: 160 }}>Formato</th>
                <th style={{ width: 130 }}>Etapa de Funil</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 110, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const activeThumb =
                  item.imageUrl ||
                  (item as any).image_url ||
                  item.storyUrl ||
                  (item as any).story_url ||
                  null;
                const isSelected = selectedId === item.id;

                return (
                  <tr
                    key={item.id}
                    className={`listViewRow ${isSelected ? "selected" : ""}`}
                    onClick={() => onSelect(item)}
                  >
                    {/* 1. Arte thumbnail */}
                    <td>
                      {activeThumb ? (
                        <div className="listRowThumb">
                          <img src={activeThumb} alt={item.title} loading="lazy" />
                        </div>
                      ) : (
                        <div className="listRowNoThumb">
                          {getFormatIcon(item.type)}
                        </div>
                      )}
                    </td>

                    {/* 2. Data */}
                    <td>
                      <span className="listRowDate">
                        {formatDateBadge(item.date)}
                      </span>
                    </td>

                    {/* 3. Título & Perfil */}
                    <td>
                      <div className="listRowTitleCell">
                        <strong>{item.title || "Publicação sem título"}</strong>
                        {item.profile ? (
                          <span className="listRowProfileTag">
                            {item.profile}
                            {item.isCollab && item.collabProfile && (
                              <span className="collabPart"> + {item.collabProfile}</span>
                            )}
                          </span>
                        ) : (
                          <span className="listRowNoProfileTag">Sem @ vinculado</span>
                        )}
                      </div>
                    </td>

                    {/* 4. FORMATO (INLINE SELECT) */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="listSelectWrapper">
                        <select
                          className="listInlineSelect formatSelect"
                          value={item.type || "Feed e Story"}
                          onChange={(e) =>
                            onUpdateItem({
                              ...item,
                              type: e.target.value as ContentType,
                            })
                          }
                        >
                          {FORMAT_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* 5. ETAPA DE FUNIL (INLINE SELECT) */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="listSelectWrapper">
                        <select
                          className={`listInlineSelect funnelSelect funnel-${(
                            item.funnelStage || "Topo"
                          ).toLowerCase()}`}
                          value={item.funnelStage || "Topo"}
                          onChange={(e) =>
                            onUpdateItem({
                              ...item,
                              funnelStage: e.target.value as any,
                            })
                          }
                        >
                          {FUNNEL_OPTIONS.map((fn) => (
                            <option key={fn} value={fn}>
                              {fn}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* 6. STATUS (INLINE SELECT) */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="listSelectWrapper">
                        <select
                          className={`listInlineSelect statusSelect status-${item.status.toLowerCase()}`}
                          value={item.status}
                          onChange={(e) =>
                            onUpdateItem({
                              ...item,
                              status: e.target.value as ContentStatus,
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* 7. Ações */}
                    <td
                      style={{ textAlign: "right" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="listRowActions">
                        <button
                          type="button"
                          className="listRowBtn edit"
                          onClick={() => onOpenInEditor(item)}
                          title="Abrir no editor"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          type="button"
                          className="listRowBtn delete"
                          onClick={() => {
                            if (confirm("Deseja realmente excluir esta publicação?")) {
                              onDeleteItem(item.id);
                            }
                          }}
                          title="Excluir post"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
