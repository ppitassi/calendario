"use client";

import { Trash2 } from "lucide-react";
import type { ContentItem, ContentStatus, ContentType } from "../../lib/types";
import {
  STATUS_COLUMNS,
  STATUS_OPTIONS,
  FORMAT_OPTIONS,
  FUNNEL_OPTIONS,
  getFormatIcon,
  formatDateBadge,
} from "./OverviewTypes";

export interface OverviewKanbanProps {
  filteredItems: ContentItem[];
  selectedId: string | null;
  onSelect: (item: ContentItem) => void;
  onUpdateItem: (item: ContentItem) => void;
  onDeleteItem: (id: string) => void;
  dragOverColumn: ContentStatus | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, status: ContentStatus) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetStatus: ContentStatus) => void;
}

export function OverviewKanban({
  filteredItems,
  selectedId,
  onSelect,
  onUpdateItem,
  onDeleteItem,
  dragOverColumn,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: OverviewKanbanProps) {
  return (
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
            onDragOver={(e) => onDragOver(e, col.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, col.id)}
          >
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
                    onDragStart={(e) => onDragStart(e, item.id)}
                    onClick={() => onSelect(item)}
                  >
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

                      <h4 className="kanbanCardTitle">
                        {item.title || "Publicação sem título"}
                      </h4>

                      <div
                        className="kanbanControlsGrid"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
