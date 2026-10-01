"use client";
/** Prévia compacta do post selecionado, alimentada pelo mesmo objeto do editor. */


import type { ContentItem, ContentStatus } from "../lib/types";
import { InstagramMockup } from "./presentation/InstagramMockup";

/** Simula um card de feed e permite alterar apenas o status editorial do item. */
export function Preview({
  item,
  brand,
  onChange,
}: {
  item: ContentItem;
  brand: string;
  onChange: (item: ContentItem) => void;
}) {
  return (
    <div className="previewRoot">
      {/* UI: status editável e etapa do funil da publicação selecionada. */}
      <label className="previewStatus">
        <span>Status da Publicação</span>
        <select
          value={item.status}
          onChange={(event) =>
            onChange({ ...item, status: event.target.value as ContentStatus })
          }
        >
          {["Ideia", "Produção", "Revisão", "Aprovado"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>

      <div className="funnelBadge">
        <span>Etapa do Funil</span>
        <strong>{item.funnelStage || "Topo"}</strong>
      </div>

      {/* UI: simulação interativa nos 4 formatos do Instagram (Feed, Story, Reels, Carrossel) */}
      <div className="previewArea">
        <InstagramMockup
          post={item}
          brand={brand}
        />
      </div>

      <div className="comments">
        <span className="sectionLabel">Anotações da Produção</span>
        <p>{item.internalNotes || "Nenhuma anotação interna registrada para este card."}</p>
      </div>
    </div>
  );
}
