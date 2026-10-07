"use client";

import {
  FileImage,
  Upload,
  CheckCircle,
  Link as LinkIcon,
  X,
} from "lucide-react";

export interface EditorMediaTabProps {
  activeFeedImage: string;
  activeStoryImage: string;
  uploadingTarget: "feed" | "story" | null;
  uploadError: string | null;
  onDrop: (e: React.DragEvent, target?: "feed" | "story") => void;
  onSelectComputerFile: () => void;
  onRemoveFeedImage: () => void;
  onRemoveStoryImage: () => void;
  customUrl: string;
  setCustomUrl: (url: string) => void;
  showUrlInput: boolean;
  setShowUrlInput: (show: boolean) => void;
  onApplyUrl: () => void;
  itemTitle?: string;
  feedUrl?: string;
  storyUrl?: string;
}

export function EditorMediaTab({
  activeFeedImage,
  activeStoryImage,
  uploadingTarget,
  uploadError,
  onDrop,
  onSelectComputerFile,
  onRemoveFeedImage,
  onRemoveStoryImage,
  customUrl,
  setCustomUrl,
  showUrlInput,
  setShowUrlInput,
  onApplyUrl,
  itemTitle = "Publicação",
  feedUrl = "",
  storyUrl = "",
}: EditorMediaTabProps) {
  return (
    <div className="mediaPanel">
      <div className="mediaHeader">
        <div className="mediaHeaderTitle">
          <FileImage size={18} />
          <div>
            <strong>Mídia Real da Publicação</strong>
            <p>Faça o upload do arquivo real (PNG, JPG, WEBP). Ele será salvo no servidor e exibido no calendário.</p>
          </div>
        </div>
      </div>

      <div
        className={`uploadDropzone ${uploadingTarget ? "uploading" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={onSelectComputerFile}
      >
        <Upload size={32} className="uploadIcon" />
        <div className="dropzoneCopy">
          <strong>{uploadingTarget ? "Enviando arquivo ao servidor..." : "Clique ou arraste uma imagem aqui"}</strong>
          <span>Formatos suportados: PNG, JPG, JPEG, WEBP e GIF</span>
        </div>
        <button
          type="button"
          className="primaryButton compactBtn"
          disabled={uploadingTarget !== null}
        >
          {uploadingTarget ? "Gravando..." : "Selecionar do Computador"}
        </button>
      </div>

      {uploadError && (
        <div className="uploadAlert error">
          <span>{uploadError}</span>
        </div>
      )}

      {activeFeedImage ? (
        <div className="uploadedMediaCard compactMediaCard">
          <div className="mediaThumbnailBox">
            <img
              src={activeFeedImage}
              alt={itemTitle}
              className="mediaThumbnailImg"
            />
          </div>

          <div className="mediaMetaDetails">
            <div className="mediaCardTop">
              <span className="mediaStatusLabel">
                <CheckCircle size={14} color="#10b981" /> Arte do Feed (1:1 / 4:5 / 1080×1440)
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="secondarySmallBtn"
                  onClick={() => window.open(activeFeedImage, "_blank")}
                >
                  Abrir
                </button>
                <button
                  type="button"
                  className="dangerSmallBtn"
                  onClick={onRemoveFeedImage}
                >
                  Remover
                </button>
              </div>
            </div>

            <div className="mediaUrlRow">
              <small>URL:</small>
              <code>{feedUrl || "Enviando..."}</code>
            </div>
          </div>
        </div>
      ) : (
        <div className="noMediaNotice">
          <p>Nenhuma arte de Feed associada a este card ainda. Faça o upload acima ou cole com <b>Ctrl+V</b>.</p>
        </div>
      )}

      {activeStoryImage && (
        <div className="uploadedMediaCard compactMediaCard" style={{ marginTop: 10 }}>
          <div className="mediaThumbnailBox storyThumbBox">
            <img
              src={activeStoryImage}
              alt={`${itemTitle} - Story`}
              className="mediaThumbnailImg"
            />
          </div>

          <div className="mediaMetaDetails">
            <div className="mediaCardTop">
              <span className="mediaStatusLabel">
                <CheckCircle size={14} color="#10b981" /> Arte do Story (9:16)
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="secondarySmallBtn"
                  onClick={() => window.open(activeStoryImage, "_blank")}
                >
                  Abrir
                </button>
                <button
                  type="button"
                  className="dangerSmallBtn"
                  onClick={onRemoveStoryImage}
                >
                  Remover
                </button>
              </div>
            </div>

            <div className="mediaUrlRow">
              <small>URL:</small>
              <code>{storyUrl || "Enviando..."}</code>
            </div>
          </div>
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
              onClick={onApplyUrl}
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
  );
}
