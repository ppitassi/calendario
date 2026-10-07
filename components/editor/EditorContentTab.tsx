"use client";

import {
  MessageSquare,
  Layers,
  Smartphone,
  FileImage,
  CheckCircle,
  X,
  Sparkles,
} from "lucide-react";
import type { ContentItem, ContentType } from "../../lib/types";
import { EXTRA_FORMAT_OPTIONS } from "../../lib/types";
import { EditorProfileSelect } from "./EditorProfileSelect";

export interface EditorContentTabProps {
  item: ContentItem;
  field: (key: keyof ContentItem, value: any) => void;
  currentMeta: {
    tag: string;
    autoTitle: string;
    isCollab: boolean;
    profile: string;
  };
  profileSuggestions: string[];
  isProfileInUse: (p: string) => boolean;
  onSelectProfile: (newProfile: string) => void;
  onToggleCollab: (checked: boolean) => void;
  onCollabProfileChange: (collabProfile: string) => void;
  onDeleteProfileClick: (e: React.MouseEvent, p: string) => void;
  onCreateProfile?: (profile: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  storyFileInputRef: React.RefObject<HTMLInputElement | null>;
  activeFeedImage: string;
  activeStoryImage: string;
  uploadingTarget: "feed" | "story" | null;
  uploadError: string | null;
  onUploadFile: (file: File, target: "feed" | "story") => void;
  onRemoveFeedImage: () => void;
  onRemoveStoryImage: () => void;
  isFeedAndStory: boolean;
  isStoryOnly: boolean;
}

export function EditorContentTab({
  item,
  field,
  currentMeta,
  profileSuggestions,
  isProfileInUse,
  onSelectProfile,
  onToggleCollab,
  onCollabProfileChange,
  onDeleteProfileClick,
  onCreateProfile,
  fileInputRef,
  storyFileInputRef,
  activeFeedImage,
  activeStoryImage,
  uploadingTarget,
  uploadError,
  onUploadFile,
  onRemoveFeedImage,
  onRemoveStoryImage,
  isFeedAndStory,
  isStoryOnly,
}: EditorContentTabProps) {
  const clientComment = (item as any).clientComment || (item as any).client_comment;

  return (
    <div className="editorScroll">
      {clientComment && (
        <div className="clientCommentBanner">
          <div className="clientCommentBannerHeader">
            <MessageSquare size={13} />
            <strong>Observação do Cliente:</strong>
          </div>
          <p className="clientCommentText">"{clientComment}"</p>
        </div>
      )}

      <div className="editorTaskHeader">
        <span className={`editorTaskTag ${currentMeta.isCollab ? "collabTag" : ""}`}>
          {currentMeta.tag}
        </span>
        <span className="editorTaskProfile">
          {currentMeta.profile || "Sem perfil vinculado"}
        </span>
      </div>

      <textarea
        className="documentTitle"
        value={item.title}
        onChange={(e) => field("title", e.target.value)}
        placeholder={currentMeta.autoTitle || "Título interno da publicação..."}
        rows={1}
      />

      <div className="metaGrid">
        <label>
          <span>Data Agendada</span>
          <input
            type="date"
            value={item.date}
            onChange={(e) => field("date", e.target.value)}
            style={{ fontWeight: 800 }}
          />
        </label>
        <label>
          <span>Formato</span>
          <select
            value={item.type || "Feed e Story"}
            onChange={(e) => field("type", e.target.value as ContentType)}
          >
            {["Feed e Story", "Feed", "Story", "Carrossel", "Reels"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Canal / Rede</span>
          <input
            value={item.channel}
            onChange={(e) => field("channel", e.target.value)}
          />
        </label>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "10px 14px",
          background: item.isExtra ? "rgba(239, 93, 61, 0.08)" : "var(--surface-soft, #f8fafc)",
          border: `1px solid ${item.isExtra ? "rgba(239, 93, 61, 0.3)" : "var(--border, #e2e8f0)"}`,
          borderRadius: "10px",
          marginBottom: "14px",
          transition: "all 0.2s ease",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            color: item.isExtra ? "var(--accent, #ef5d3d)" : "var(--ink, #1e293b)",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={Boolean(item.isExtra)}
            onChange={(e) => {
              const checked = e.target.checked;
              field("isExtra", checked);
              if (checked && !item.extraFormat) {
                field("extraFormat", "Banner");
              }
            }}
            style={{ width: "16px", height: "16px", accentColor: "var(--accent, #ef5d3d)", cursor: "pointer" }}
          />
          <Sparkles size={14} />
          <span>Arte Extra / Demanda Avulsa</span>
        </label>

        {item.isExtra && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #64748b)" }}>
              Formato:
            </span>
            <select
              value={item.extraFormat || "Banner"}
              onChange={(e) => field("extraFormat", e.target.value)}
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                cursor: "pointer",
              }}
            >
              {EXTRA_FORMAT_OPTIONS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="copyGrid">
        <label>
          <span>Head (Título principal na arte)</span>
          <input
            value={item.head || ""}
            onChange={(e) => field("head", e.target.value)}
            placeholder="Texto de destaque na arte visual..."
          />
        </label>
        <label>
          <span>Subhead (Linha de apoio na arte)</span>
          <input
            value={item.subhead || ""}
            onChange={(e) => field("subhead", e.target.value)}
            placeholder="Texto secundário da arte..."
          />
        </label>
        <label className="wide grow">
          <span>Legenda Completa (Copy)</span>
          <textarea
            value={item.caption}
            onChange={(e) => field("caption", e.target.value)}
            placeholder="Texto completo da legenda da publicação..."
          />
        </label>
        <label>
          <span>Objetivo da Publicação</span>
          <input
            value={item.objective}
            onChange={(e) => field("objective", e.target.value)}
            placeholder="Ex: Gerar engajamento, captar leads, branding..."
          />
        </label>
        <label>
          <span>Briefing Visual (Instrução para o Designer)</span>
          <textarea
            value={item.visual}
            onChange={(e) => field("visual", e.target.value)}
            placeholder="Orientação de design, referências, iluminação e elementos..."
          />
        </label>
        <label>
          <span>Etapa do Funil</span>
          <select
            value={item.funnelStage || "Topo"}
            onChange={(e) => field("funnelStage", e.target.value)}
          >
            {["Topo", "Meio", "Fundo"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Chamada para Ação (CTA)</span>
          <input
            value={item.cta || ""}
            onChange={(e) => field("cta", e.target.value)}
            placeholder="Ex: Salve este post / Link na bio"
          />
        </label>
        <label className="wide">
          <span>Hashtags</span>
          <input
            value={item.hashtags || ""}
            onChange={(e) => field("hashtags", e.target.value)}
            placeholder="#design #conteudo #marketing"
          />
        </label>
      </div>

      <EditorProfileSelect
        item={item}
        profileSuggestions={profileSuggestions}
        isProfileInUse={isProfileInUse}
        onSelectProfile={onSelectProfile}
        onToggleCollab={onToggleCollab}
        onCollabProfileChange={onCollabProfileChange}
        onDeleteProfileClick={onDeleteProfileClick}
        onCreateProfile={onCreateProfile}
      />

      <div className="mediaButtonsSection">
        <input
          ref={fileInputRef as any}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) onUploadFile(e.target.files[0], "feed");
          }}
        />
        <input
          ref={storyFileInputRef as any}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) onUploadFile(e.target.files[0], "story");
          }}
        />

        <div className="mediaButtonsHeader">
          <span className="sectionTag">Artes da Publicação</span>
        </div>

        <div className="mediaButtonsGroup">
          {isFeedAndStory ? (
            <>
              <div className="mediaCompactItem">
                <button
                  type="button"
                  className={`mediaCompactBtn ${activeFeedImage ? "hasMedia" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingTarget === "feed"}
                  title={activeFeedImage ? "Clique para trocar a arte do Feed" : "Clique para anexar a arte do Feed"}
                >
                  <Layers size={14} className="mediaBtnIcon" />
                  <span className="mediaBtnLabel">
                    {uploadingTarget === "feed"
                      ? "Enviando Feed..."
                      : activeFeedImage
                      ? "Feed Anexado"
                      : "Anexar Feed"}
                  </span>
                  <span className="mediaBtnFormat">1:1 / 4:5</span>
                  {activeFeedImage ? (
                    <span className="mediaMiniBadge success" title="Arte anexada">
                      <CheckCircle size={10} /> Anexada
                    </span>
                  ) : (
                    <span className="mediaMiniBadge pending">Pendente</span>
                  )}
                </button>
                {activeFeedImage && (
                  <button
                    type="button"
                    className="mediaCompactRemoveBtn"
                    onClick={onRemoveFeedImage}
                    title="Remover arte do Feed"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="mediaCompactItem">
                <button
                  type="button"
                  className={`mediaCompactBtn ${activeStoryImage ? "hasMedia" : ""}`}
                  onClick={() => storyFileInputRef.current?.click()}
                  disabled={uploadingTarget === "story"}
                  title={activeStoryImage ? "Clique para trocar a arte do Story" : "Clique para anexar a arte do Story"}
                >
                  <Smartphone size={14} className="mediaBtnIcon" />
                  <span className="mediaBtnLabel">
                    {uploadingTarget === "story"
                      ? "Enviando Story..."
                      : activeStoryImage
                      ? "Story Anexado"
                      : "Anexar Story"}
                  </span>
                  <span className="mediaBtnFormat">9:16</span>
                  {activeStoryImage ? (
                    <span className="mediaMiniBadge success" title="Arte anexada">
                      <CheckCircle size={10} /> Anexada
                    </span>
                  ) : (
                    <span className="mediaMiniBadge pending">Pendente</span>
                  )}
                </button>
                {activeStoryImage && (
                  <button
                    type="button"
                    className="mediaCompactRemoveBtn"
                    onClick={onRemoveStoryImage}
                    title="Remover arte do Story"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </>
          ) : isStoryOnly ? (
            <div className="mediaCompactItem">
              <button
                type="button"
                className={`mediaCompactBtn ${activeStoryImage || activeFeedImage ? "hasMedia" : ""}`}
                onClick={() => storyFileInputRef.current?.click()}
                disabled={uploadingTarget === "story"}
                title={activeStoryImage || activeFeedImage ? "Clique para trocar a arte do Story" : "Clique para anexar a arte do Story"}
              >
                <Smartphone size={14} className="mediaBtnIcon" />
                <span className="mediaBtnLabel">
                  {uploadingTarget === "story"
                    ? "Enviando Story..."
                    : (activeStoryImage || activeFeedImage)
                    ? "Story Anexado"
                    : "Anexar Story"}
                </span>
                <span className="mediaBtnFormat">9:16</span>
                {activeStoryImage || activeFeedImage ? (
                  <span className="mediaMiniBadge success" title="Arte anexada">
                    <CheckCircle size={10} /> Anexada
                  </span>
                ) : (
                  <span className="mediaMiniBadge pending">Pendente</span>
                )}
              </button>
              {(activeStoryImage || activeFeedImage) && (
                <button
                  type="button"
                  className="mediaCompactRemoveBtn"
                  onClick={onRemoveStoryImage}
                  title="Remover arte do Story"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ) : (
            <div className="mediaCompactItem">
              <button
                type="button"
                className={`mediaCompactBtn ${activeFeedImage ? "hasMedia" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingTarget === "feed"}
                title={activeFeedImage ? "Clique para trocar a arte" : "Clique para anexar a arte"}
              >
                <FileImage size={14} className="mediaBtnIcon" />
                <span className="mediaBtnLabel">
                  {uploadingTarget === "feed"
                    ? "Enviando..."
                    : activeFeedImage
                    ? "Arte Anexada"
                    : "Anexar Arte"}
                </span>
                {activeFeedImage ? (
                  <span className="mediaMiniBadge success" title="Arte anexada">
                    <CheckCircle size={10} /> Anexada
                  </span>
                ) : (
                  <span className="mediaMiniBadge pending">Pendente</span>
                )}
              </button>
              {activeFeedImage && (
                <button
                  type="button"
                  className="mediaCompactRemoveBtn"
                  onClick={onRemoveFeedImage}
                  title="Remover arte da publicação"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {uploadError && (
          <div className="uploadAlert error" style={{ marginTop: 8 }}>
            <span>{uploadError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
