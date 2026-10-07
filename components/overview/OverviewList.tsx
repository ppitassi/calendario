"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import type { ContentItem, ContentStatus, ContentType } from "../../lib/types";
import {
  STATUS_OPTIONS,
  FORMAT_OPTIONS,
  FUNNEL_OPTIONS,
  getFormatIcon,
  formatDateBadge,
} from "./OverviewTypes";

export interface OverviewListProps {
  filteredItems: ContentItem[];
  selectedId: string | null;
  onSelect: (item: ContentItem) => void;
  onUpdateItem: (item: ContentItem) => void;
  onDeleteItem: (id: string) => void;
  onOpenInEditor: (item: ContentItem) => void;
}

export function OverviewList({
  filteredItems,
  selectedId,
  onSelect,
  onUpdateItem,
  onDeleteItem,
  onOpenInEditor,
}: OverviewListProps) {
  return (
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

                <td>
                  <span className="listRowDate">
                    {formatDateBadge(item.date)}
                  </span>
                </td>

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
  );
}
