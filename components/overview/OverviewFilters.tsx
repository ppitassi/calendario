"use client";

import {
  Search,
  X,
  Filter,
  Kanban,
  List,
  Plus,
} from "lucide-react";
import type { ContentStatus } from "../../lib/types";
import { FORMAT_OPTIONS, FUNNEL_OPTIONS } from "./OverviewTypes";

export interface OverviewFiltersProps {
  metrics: {
    total: number;
    byStatus: Record<ContentStatus, number>;
  };
  search: string;
  onSearchChange: (search: string) => void;
  filterProfile: string;
  onFilterProfileChange: (p: string) => void;
  filterFormat: string;
  onFilterFormatChange: (fmt: string) => void;
  filterFunnel: string;
  onFilterFunnelChange: (funnel: string) => void;
  mode: "kanban" | "list";
  onModeChange: (m: "kanban" | "list") => void;
  onCreateItem: () => void;
  profileList: string[];
}

export function OverviewFilters({
  metrics,
  search,
  onSearchChange,
  filterProfile,
  onFilterProfileChange,
  filterFormat,
  onFilterFormatChange,
  filterFunnel,
  onFilterFunnelChange,
  mode,
  onModeChange,
  onCreateItem,
  profileList,
}: OverviewFiltersProps) {
  return (
    <header className="overviewToolbar">
      <div className="overviewStatsGroup">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "4px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 800,
              fontSize: "13px",
              color: "var(--ink)",
              padding: "4px 8px",
              borderRadius: "6px",
              background: "var(--surface-soft, rgba(0,0,0,0.04))",
            }}
          >
            {mode === "kanban" ? <Kanban size={14} /> : <List size={14} />}
            <span>Tarefas • {mode === "kanban" ? "Kanban" : "Lista"}</span>
          </span>
        </div>
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

      <div className="overviewFiltersGroup">
        <div className="overviewSearchBox">
          <Search size={14} className="overviewSearchIcon" />
          <input
            type="text"
            placeholder="Buscar por título, copy, @perfil..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="overviewClearSearch"
              onClick={() => onSearchChange("")}
              title="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {profileList.length > 0 && (
          <div className="overviewFilterSelectWrapper">
            <select
              value={filterProfile}
              onChange={(e) => onFilterProfileChange(e.target.value)}
              className="overviewFilterSelect"
            >
              <option value="all">Todos os perfis</option>
              {profileList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="overviewFilterSelectWrapper">
          <select
            value={filterFormat}
            onChange={(e) => onFilterFormatChange(e.target.value)}
            className="overviewFilterSelect"
          >
            <option value="all">Todos os formatos</option>
            {FORMAT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="overviewFilterSelectWrapper">
          <select
            value={filterFunnel}
            onChange={(e) => onFilterFunnelChange(e.target.value)}
            className="overviewFilterSelect"
          >
            <option value="all">Todo o funil</option>
            {FUNNEL_OPTIONS.map((fn) => (
              <option key={fn} value={fn}>
                {fn}
              </option>
            ))}
          </select>
        </div>

        <div className="overviewViewSwitch">
          <button
            type="button"
            className={`viewSwitchBtn ${mode === "kanban" ? "active" : ""}`}
            onClick={() => onModeChange("kanban")}
            title="Visão em Quadro Kanban"
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
  );
}
