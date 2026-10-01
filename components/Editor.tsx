"use client";
/** Formulário que edita conteúdo, distribuição, mídia e notas internas de uma publicação. */


import { useRef, useState, useMemo } from "react";
import { Trash2, Upload, CheckCircle, FileImage, Link as LinkIcon } from "lucide-react";
import type { ContentItem, ContentStatus, ContentType } from "../lib/types";

/** Edita uma cópia controlada do item e devolve toda alteração ao estado do Studio. */
export function Editor({
  item,
  onChange,
  onDelete,
  availableProfiles = [],
  brand = "",
}: {
  item: ContentItem;
  onChange: (item: ContentItem) => void;
  onDelete: (id: string) => void;
  availableProfiles?: string[];
  brand?: string;
}) {
  const [tab, setTab] = useState<"content" | "media" | "notes">("content");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [optimisticPreview, setOptimisticPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef(item);
  itemRef.current = item;

  /** Atualiza um único campo sem descartar os demais valores e entrega a cópia a `onChange`. */
  const field = (key: keyof ContentItem, value: any) =>
    onChange({ ...itemRef.current, [key]: value });

  // Reúne perfis conhecidos, marca e valores atuais do post, removendo duplicados.
  const profileSuggestions = useMemo(() => {
    const set = new Set<string>(availableProfiles);
    if (brand) set.add(`@${brand.toLowerCase().replace(/\s+/g, "")}`);
    if (item.profile) set.add(item.profile);
    if (item.collabProfile) set.add(item.collabProfile);
    return Array.from(set).filter(Boolean);
  }, [availableProfiles, brand, item.profile, item.collabProfile]);

  /** Envia a imagem como multipart, grava a URL retornada no item e expõe falhas no painel. */
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setOptimisticPreview(localUrl);
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao realizar upload");

      field("imageUrl", data.url);
      setOptimisticPreview(null);
    } catch (err: any) {
      setUploadError(err.message || "Erro no upload");
      setOptimisticPreview(null);
    } finally {
      setUploading(false);
    }
  };

  /** Captura imagens coladas com Ctrl+V diretamente na tela do editor. */
  const handlePaste = (e: React.ClipboardEvent) => {
    const clipItems = e.clipboardData?.items;
    if (!clipItems) return;
    for (let i = 0; i < clipItems.length; i++) {
      if (clipItems[i].type.startsWith("image/")) {
        const file = clipItems[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleFileUpload(file);
          break;
        }
      }
    }
  };

  /** Impede a abertura do arquivo pelo navegador e envia o primeiro item arrastado. */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrl = () => {
    if (customUrl.trim()) {
      field("imageUrl", customUrl.trim());
      setCustomUrl("");
      setShowUrlInput(false);
    }
  };

  const activeImage =
    optimisticPreview ||
    item.imageUrl ||
    (item as any).image_url ||
    (item as any).imageurl;

  return (
    <div className="editorRoot" onPaste={handlePaste}>
      {/* UI: abas separam conteúdo, arquivo publicado e anotações privadas da equipe. */}
      <div className="editorTabs">
        {/* UI: a aba ativa determina apenas o painel visível; o item permanece o mesmo. */}
        <button
          className={tab === "content" ? "active" : ""}
          onClick={() => setTab("content")}
        >
          Conteúdo
        </button>
        <button
          className={tab === "media" ? "active" : ""}
          onClick={() => setTab("media")}
        >
          Mídia {item.imageUrl && <span className="mediaActiveDot" />}
        </button>
        <button
          className={tab === "notes" ? "active" : ""}
          onClick={() => setTab("notes")}
        >
          Notas Internas
        </button>

        {/* UI: upload rápido funciona em qualquer aba e a lixeira remove o post inteiro. */}
        <div className="editorTabActions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
            }}
          />
          <button
            className="quickUploadBtn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload rápido de imagem para este card"
            disabled={uploading}
          >
            <Upload size={13} />
            <span>{uploading ? "Enviando..." : "Upload Imagem"}</span>
          </button>

          <button
            className="deleteAction"
            onClick={() => onDelete(item.id)}
            title="Excluir esta publicação"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {tab === "content" && (
        <div className="editorScroll">
          <textarea
            className="documentTitle"
            value={item.title}
            onChange={(e) => field("title", e.target.value)}
            placeholder="Título interno da publicação..."
            rows={1}
          />

          {/* UI: metadados operacionais usados no calendário e no fluxo de produção. */}
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
            <label>
              <span>Status da Produção</span>
              <select
                value={item.status}
                onChange={(e) => field("status", e.target.value as ContentStatus)}
              >
                {["Ideia", "Produção", "Revisão", "Aprovado"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>

          {/* UI: copy, objetivo, briefing, funil, CTA e hashtags que compõem o post (conteúdo principal). */}
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

          {/* UI: Linha discreta de arte anexada no Conteúdo (a prévia real já fica visível no painel do Instagram à direita) */}
          {activeImage ? (
            <div className="editorMediaSection">
              <div className="editorMediaSectionHeader">
                <span className="editorSectionTitle">
                  <FileImage size={15} /> Arte Anexada
                </span>
                <div className="editorMediaActions">
                  <button
                    type="button"
                    className="secondarySmallBtn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload size={12} /> {uploading ? "Enviando..." : "Trocar Arte"}
                  </button>
                  <button
                    type="button"
                    className="dangerSmallBtn"
                    onClick={() => {
                      setOptimisticPreview(null);
                      field("imageUrl", "");
                    }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`editorMediaDropPrompt ${isDragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                setIsDragging(false);
                handleDrop(e);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={22} className="uploadIcon" />
              <div>
                <strong>Anexar arte desta publicação (Feed / Story)</strong>
                <small>Clique para escolher, arraste o arquivo aqui ou cole com <b>Ctrl+V</b></small>
              </div>
              {uploading && <div className="smallSpinner" />}
            </div>
          )}

          {uploadError && (
            <div className="uploadAlert error" style={{ marginBottom: 12 }}>
              <span>{uploadError}</span>
            </div>
          )}

          {/* UI: define o perfil principal e, opcionalmente, o parceiro da publicação collab. */}
          <div className="profileCollabBox">
            {/* UI: o interruptor também apaga o segundo perfil ao desativar a collab. */}
            <div className="profileCollabHeader">
              <div>
                <span className="sectionTag">Distribuição de Perfis</span>
                <strong>Publicação em Perfil / Collab</strong>
              </div>
              <label className="collabSwitchLabel">
                <input
                  type="checkbox"
                  checked={Boolean(item.isCollab)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onChange({
                      ...item,
                      isCollab: checked,
                      collabProfile: checked ? (item.collabProfile || "") : "",
                    });
                  }}
                />
                <span className="collabSwitchBadge">
                  {item.isCollab ? "Collab Ativo" : "Collab Desativado"}
                </span>
              </label>
            </div>

            {/* UI: campos livres com atalhos para perfis já usados neste calendário. */}
            <div className="profileFieldsGrid">
              <div className="profileField">
                <label>
                  <span>Perfil Principal ({item.isCollab ? "Autor 1" : "Conta"})</span>
                  <input
                    type="text"
                    value={item.profile || ""}
                    onChange={(e) => field("profile", e.target.value)}
                    placeholder="Ex: @perfilA ou Nome da Conta"
                  />
                </label>
                {profileSuggestions.length > 0 && (
                  <div className="profilePills">
                    {profileSuggestions.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={item.profile === p ? "active" : ""}
                        onClick={() => field("profile", p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {item.isCollab && (
                <div className="profileField collabField">
                  <label>
                    <span>Perfil Colaborador (Autor 2 / Parceiro)</span>
                    <input
                      type="text"
                      value={item.collabProfile || ""}
                      onChange={(e) => field("collabProfile", e.target.value)}
                      placeholder="Ex: @perfilB ou @parceiro"
                    />
                  </label>
                  {profileSuggestions.length > 0 && (
                    <div className="profilePills">
                      {profileSuggestions.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={item.collabProfile === p ? "active" : ""}
                          onClick={() => field("collabProfile", p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {item.isCollab && (
              <div className="collabNotice">
                <span className="collabDot" />
                <span>
                  Esta publicação será apresentada em conjunto como collab entre{" "}
                  <strong>{item.profile || "Perfil A"}</strong> e{" "}
                  <strong>{item.collabProfile || "Perfil B"}</strong>.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "media" && (
        <div className="mediaPanel">
          {/* UI: introduz o armazenamento real da imagem associada a esta publicação. */}
          <div className="mediaHeader">
            {/* UI: título e instrução deixam claro que o arquivo será persistido no servidor. */}
            <div className="mediaHeaderTitle">
              <FileImage size={18} />
              <div>
                <strong>Mídia Real da Publicação</strong>
                <p>Faça o upload do arquivo real (PNG, JPG, WEBP). Ele será salvo no servidor e exibido no calendário.</p>
              </div>
            </div>
          </div>

          {/* UI: área clicável e arrastável que envia uma imagem ao servidor. */}
          <div
            className={`uploadDropzone ${uploading ? "uploading" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} className="uploadIcon" />
            <div className="dropzoneCopy">
              <strong>{uploading ? "Enviando arquivo ao servidor..." : "Clique ou arraste uma imagem aqui"}</strong>
              <span>Formatos suportados: PNG, JPG, JPEG, WEBP e GIF</span>
            </div>
            <button
              type="button"
              className="primaryButton compactBtn"
              disabled={uploading}
            >
              {uploading ? "Gravando..." : "Selecionar do Computador"}
            </button>
          </div>

          {uploadError && (
            <div className="uploadAlert error">
              <span>{uploadError}</span>
            </div>
          )}

          {/* UI: mídia persistida, com remoção, prévia integral e URL utilizada pelas apresentações. */}
          {activeImage ? (
            <div className="uploadedMediaCard">
              {/* UI: confirmação do upload e ação que desvincula a mídia do item. */}
              <div className="mediaCardTop">
                <span className="mediaStatusLabel">
                  <CheckCircle size={14} color="#10b981" /> Arte Visual Vinculada
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="secondarySmallBtn"
                    onClick={() => window.open(activeImage, "_blank")}
                  >
                    Abrir Original
                  </button>
                  <button
                    className="removeMediaBtn"
                    onClick={() => {
                      setOptimisticPreview(null);
                      field("imageUrl", "");
                    }}
                  >
                    Remover Mídia
                  </button>
                </div>
              </div>

              {/* UI: mostra exatamente o endereço salvo no campo `imageUrl`. */}
              <div className="mediaRealPreviewWrapper">
                <img
                  src={activeImage}
                  alt={item.title}
                  className="mediaRealImg"
                />
              </div>

              <div className="mediaUrlRow">
                <small>Endereço salvo:</small>
                <code>{item.imageUrl || "Enviando para o banco de dados..."}</code>
              </div>
            </div>
          ) : (
            <div className="noMediaNotice">
              <p>Nenhuma imagem associada a este card ainda. Faça o upload acima ou cole com <b>Ctrl+V</b>.</p>
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {!showUrlInput ? (
              <button
                type="button"
                className="secondarySmallBtn"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setShowUrlInput(true)}
              >
                <LinkIcon size={12} /> Ou colar link direto de imagem externa
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6, width: "100%", maxWidth: 540 }}>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://exemplo.com/imagem.png"
                  style={{ flex: 1, padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)" }}
                />
                <button
                  type="button"
                  className="primaryButton compactBtn"
                  onClick={handleApplyUrl}
                >
                  Salvar Link
                </button>
                <button
                  type="button"
                  className="secondarySmallBtn"
                  onClick={() => setShowUrlInput(false)}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="notesPanel">
          {/* UI: aviso de que estas observações são internas e não aparecem na apresentação. */}
          <div className="notesHeader">
            <strong>Alinhamento Interno (Designer ⇄ Social Media)</strong>
            <p>Observações privadas da equipe sobre este card.</p>
          </div>
          <textarea
            value={item.internalNotes || ""}
            onChange={(e) => field("internalNotes", e.target.value)}
            placeholder="Digite feedbacks, links de assets no Figma, ou notas entre designer e social media..."
            rows={8}
          />
        </div>
      )}
    </div>
  );
}
