"use client";
/**
 * Visão Geral: visualização de todas as artes em formato Kanban ou Lista.
 * Permite alteração direta de Status, Formato e Etapa de Funil.
 */

import { useState, useMemo } from "react";
import { Plus, CalendarDays } from "lucide-react";
import type { ContentItem, ContentStatus } from "../lib/types";
import { OverviewFilters } from "./overview/OverviewFilters";
import { OverviewKanban } from "./overview/OverviewKanban";
import { OverviewList } from "./overview/OverviewList";

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

  const metrics = useMemo(() => {
    const total = items.length;
    const byStatus: Record<ContentStatus, number> = {
      Ideia: 0,
      Produção: 0,
      Revisão: 0,
      Aprovado: 0,
    };

    items.forEach((item) => {
      if (byStatus[item.status] !== undefined) {
        byStatus[item.status]++;
      }
    });

    return { total, byStatus };
  }, [items]);

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

  return (
    <div className="overviewContainer">
      <OverviewFilters
        metrics={metrics}
        search={search}
        onSearchChange={setSearch}
        filterProfile={filterProfile}
        onFilterProfileChange={setFilterProfile}
        filterFormat={filterFormat}
        onFilterFormatChange={setFilterFormat}
        filterFunnel={filterFunnel}
        onFilterFunnelChange={setFilterFunnel}
        mode={mode}
        onModeChange={onModeChange}
        onCreateItem={onCreateItem}
        profileList={profileList}
      />

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
        <OverviewKanban
          filteredItems={filteredItems}
          selectedId={selectedId}
          onSelect={onSelect}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          dragOverColumn={dragOverColumn}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      ) : (
        <OverviewList
          filteredItems={filteredItems}
          selectedId={selectedId}
          onSelect={onSelect}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onOpenInEditor={onOpenInEditor}
        />
      )}
    </div>
  );
}
