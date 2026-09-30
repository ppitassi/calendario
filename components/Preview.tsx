"use client";
/** Prévia compacta do post selecionado, alimentada pelo mesmo objeto do editor. */


import { useState, useEffect } from "react";
import { Heart, MessageCircle, MoreHorizontal, Send, Image as ImageIcon } from "lucide-react";
import type { ContentItem, ContentStatus } from "../lib/types";

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
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [item.imageUrl]);

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

      {/* UI: simulação compacta do feed usando exatamente os campos do editor. */}
      <div className="previewArea">
        <span className="sectionLabel">Prévia do Card (Feed Real)</span>
        {/* UI: cartão visual completo, da identidade do perfil à legenda. */}
        <article className="feedCard">
          {/* UI: perfil principal e, quando ativado, o parceiro da publicação collab. */}
          <header>
            {item.isCollab && item.collabProfile ? (
              <div className="feedCollabAvatars">
                <div className="feedAvatar primary">
                  {(item.profile || brand).replace(/^@/, "").slice(0, 2).toUpperCase()}
                </div>
                <div className="feedAvatar secondary">
                  {item.collabProfile.replace(/^@/, "").slice(0, 2).toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="feedAvatar">
                {(item.profile || brand).replace(/^@/, "").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <strong>
                {item.isCollab && item.collabProfile
                  ? `${item.profile || brand} e ${item.collabProfile}`
                  : item.profile || brand}
              </strong>
              <small>
                {item.isCollab ? "Colaboração" : "Publicação"} · {item.channel || "Instagram"}
              </small>
            </div>
            <MoreHorizontal size={16} />
          </header>

          <div className="feedMedia">
            {item.imageUrl && !imageError ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="feedRealImg"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="feedEmptyMedia">
                <ImageIcon size={32} />
                <span>{imageError ? "Falha ao exibir imagem" : "Nenhuma mídia enviada"}</span>
                <small>{imageError ? "Envie a arte novamente ou verifique o link" : "Anexe arte no editor ou cole (Ctrl+V)"}</small>
              </div>
            )}
          </div>

          {/* UI: ícones decorativos reproduzem ações do feed; não executam comandos. */}
          <div className="feedActions">
            <Heart size={18} />
            <MessageCircle size={18} />
            <Send size={18} />
          </div>

          <div className="feedCopy">
            <strong>{item.head || item.title}</strong>
            {item.subhead && <small>{item.subhead}</small>}
            <p>{item.caption || "A legenda da publicação aparecerá aqui."}</p>
            {item.cta && <em className="feedCta">{item.cta}</em>}
            {item.hashtags && <code className="feedHashtags">{item.hashtags}</code>}
          </div>
        </article>
      </div>

      <div className="comments">
        <span className="sectionLabel">Anotações da Produção</span>
        <p>{item.internalNotes || "Nenhuma anotação interna registrada para este card."}</p>
      </div>
    </div>
  );
}
