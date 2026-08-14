import React, { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, Upload, X, Video } from "lucide-react";
import { PostData } from "../types";
import { api } from "../lib/api";
import { useNotifications } from "../contexts/NotificationContext";
import { Button } from "./ui/Button/Button";
import { IconButton } from "./ui/IconButton/IconButton";
import styles from "./SmartMediaUploader.module.css";
export { compressImage } from "../lib/image-compressor";

export function SmartMediaUploader({
  currentPost,
  onUpdate,
  clientId = "post",
}: {
  currentPost: PostData;
  onUpdate: (updates: Partial<PostData>) => void;
  clientId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [artworkVersions, setArtworkVersions] = useState<any[]>([]);
  const [failedFiles, setFailedFiles] = useState<Array<{ file: File; reason: string }>>([]);
  const [documents, setDocuments] = useState<Array<{ assetId: string; originalName: string; url: string; logicalPath: string; checksum: string }>>([]);
  const { toast } = useNotifications();
  const refreshVersions = () => (currentPost.id ? api.getArtworkVersions(currentPost.id).then(setArtworkVersions).catch(() => setArtworkVersions([])) : Promise.resolve());
  useEffect(() => {
    void refreshVersions();
    if (currentPost.id) void api.getPostMediaAssets(String(currentPost.id)).then((items) => setDocuments(items.filter((item) => item.visibility === "protected"))).catch(() => setDocuments([]));
  }, [currentPost.id]);
  const uploadDocuments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !currentPost.id) return;
    setIsUploading(true);
    for (const file of files) {
      try {
        const uploaded = await api.uploadMediaFile(file, clientId, currentPost.date, String(currentPost.id), "post_document");
        setDocuments((items) => [...items, { ...uploaded, originalName: file.name }]);
      } catch (error: any) { toast(error?.response?.data?.error || `Falha ao enviar ${file.name}.`, "error"); }
    }
    setIsUploading(false);
    event.target.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      const allowed = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);
      const maxItems = currentPost.type === "carousel" ? 10 : currentPost.type === "post" || currentPost.type === "promoted" ? 2 : 1;
      if (files.length > maxItems || files.some((file) => !allowed.has(file.type) || !file.size)) {
        toast(`Selecione ate ${maxItems} arquivos JPEG, PNG, WebP, MP4, WebM ou MOV validos.`, "error");
        e.currentTarget.value = "";
        return;
      }
      setIsUploading(true);

      let newFeed = Array.isArray(currentPost.feedImages) ? [...currentPost.feedImages] : currentPost.feedImages ? [currentPost.feedImages] : [];
      let newStory = currentPost.storyImage || "";
      let newCover = currentPost.coverImage || "";
      let newLinkedinCover = currentPost.linkedinCover || "";

      const isReel = currentPost.type === "reel";
      const isLinkedin = currentPost.type === "linkedin";

      const postDate = currentPost.date;
      let newVideoUrl = currentPost.videoUrl || "";

      const failures: Array<{ file: File; name: string; reason: string }> = [];
      const uploadedAssetIds: string[] = [];
      for (const [fileIndex, file] of files.entries()) {
        try {
          if (file.type.startsWith("video/")) {
            const uploaded = await api.uploadMediaFile(file, clientId, postDate, String(currentPost.id || clientId), "post_video", fileIndex + 1);
            newVideoUrl = uploaded.url;
            if (uploaded.assetId) uploadedAssetIds.push(uploaded.assetId);
            continue;
          }
          const bitmap = await createImageBitmap(file);
          const ratio = bitmap.width / bitmap.height;
          bitmap.close();
          const category = isReel ? "post_cover" : isLinkedin ? "post_linkedin_cover" : ratio <= 0.6 ? "post_story" : "post_feed";
          const uploaded = await api.uploadMediaFile(file, clientId, postDate, String(currentPost.id || clientId), category, fileIndex + 1);
          const uploadedUrl = uploaded.url;
          if (uploaded.assetId) uploadedAssetIds.push(uploaded.assetId);
          if (isReel) {
            newCover = uploadedUrl;
          } else if (isLinkedin) {
            newLinkedinCover = uploadedUrl;
          } else {
            if (ratio <= 0.6) {
              newStory = uploadedUrl;
            } else {
              newFeed.push(uploadedUrl);
            }
          }
        } catch (error: any) {
          failures.push({
            file,
            name: file.name,
            reason: error?.response?.data?.error || error?.message || "Não foi possível concluir o upload.",
          });
        }
      }

      if (currentPost.type !== "carousel") {
        newFeed = newFeed.slice(0, 1);
      } else {
        newFeed = newFeed.slice(0, 10);
      }

      onUpdate({
        feedImages: newFeed,
        storyImage: newStory,
        coverImage: newCover,
        linkedinCover: newLinkedinCover,
        videoUrl: newVideoUrl,
      });
      if (uploadedAssetIds.length && currentPost.id) {
        try {
          const currentVersionAssetIds = (artworkVersions[0]?.items || []).map((item: any) => String(item.mediaAssetId || "")).filter(Boolean);
          await api.createArtworkVersion(currentPost.id, Array.from(new Set([...currentVersionAssetIds, ...uploadedAssetIds])));
          await refreshVersions();
        } catch (error: any) {
          toast(error?.response?.data?.error || "A mídia foi salva, mas a versão da arte não foi registrada.", "error");
        }
      }
      if (failures.length)
        toast(
          failures.length === 1
            ? `Não foi possível enviar ${failures[0].name}. ${failures[0].reason}`
            : `${failures.length} arquivos não foram enviados: ${failures.map((item) => `${item.name} — ${item.reason}`).join("; ")}. Os demais foram preservados.`,
          "error",
        );
      else toast("Midia enviada com sucesso.", "success");
      setFailedFiles(failures.map(({ file, reason }) => ({ file, reason })));
      setIsUploading(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const retryFailedFiles = () => {
    if (isUploading || !failedFiles.length || !fileInputRef.current) return;
    const transfer = new DataTransfer();
    failedFiles.forEach((item) => transfer.items.add(item.file));
    fileInputRef.current.files = transfer.files;
    fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const renderImageItem = (url: string, onRemove: () => void, idx: number | string) => (
    <div key={idx} className={styles.thumbnail}>
      <img src={url} alt="Uploaded" />
      <div className={styles.thumbnailOverlay}>
        <IconButton label="Remover mídia" onClick={onRemove} size="small" variant="glass">
          <X />
        </IconButton>
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      {artworkVersions.length > 0 && (
        <details className={styles.versions}>
          <summary>
            Arte atual: V{artworkVersions[0].versionNumber} · {artworkVersions[0].status}
          </summary>
          <div className={styles.versionList}>
            {artworkVersions.map((version) => (
              <div key={version.id} className={styles.versionRow}>
                <strong>
                  Versão {version.versionNumber}
                  {version.versionNumber === artworkVersions[0].versionNumber ? " · Atual" : ""}
                </strong>
                <span>{version.status}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className={styles.uploadArea}>
        {/* style-architecture-button-exception: the upload dropzone is a feature-specific file interaction, not a standard action button. */}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className={styles.uploadTrigger}
        >
          <Upload />
          <span className={styles.uploadLabel}>
            {isUploading
              ? "Enviando..."
              : currentPost.type === "reel" || currentPost.type === "linkedin"
                ? "Upload de Vídeo ou Capa"
                : "Upload de Mídia (Detecta Feed / Story)"}
          </span>
          <span className={styles.uploadHint}>O servidor preserva o original; o Nextcloud será sincronizado quando configurado.</span>
        </button>

        {/* style-architecture-exception: native file input is required for browser upload integration. */}
        <input
          type="file"
          multiple={currentPost.type === "carousel" || currentPost.type === "post" || currentPost.type === "promoted"}
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          disabled={isUploading}
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <Button disabled={isUploading || !currentPost.id} onClick={() => documentInputRef.current?.click()} icon={<FileText />}>
          Anexar documentos (até 100 MB)
        </Button>
        {/* style-architecture-exception: native file input is required for browser upload integration. */}
        <input ref={documentInputRef} type="file" multiple disabled={isUploading} onChange={uploadDocuments} className="hidden" />
        {documents.length > 0 && <div className={styles.documentList}>{documents.map((document) => <a key={document.assetId} href={document.url} className={styles.documentLink} download><FileText />{document.originalName}</a>)}</div>}
        {failedFiles.length > 0 && (
          <div className={styles.failures} role="alert">
            <div className={styles.failureList}>
              {failedFiles.map(({ file, reason }) => (
                <div key={`${file.name}:${file.size}:${file.lastModified}`}>
                  <strong>{file.name}</strong>
                  <span>— {reason}</span>
                </div>
              ))}
            </div>
            <Button disabled={isUploading} onClick={retryFailedFiles} className="mt-3" variant="danger" size="small">
              Tentar novamente {failedFiles.length === 1 ? "o arquivo" : `os ${failedFiles.length} arquivos`}
            </Button>
          </div>
        )}
      </div>

      {currentPost.videoUrl && (
        <div className={styles.mediaSection}>
          <label className={styles.mediaLabel}>
            <Video /> Vídeo do post
          </label>
          <div className={styles.videoFrame}>
            <video src={currentPost.videoUrl} controls preload="metadata" />
            <IconButton label="Remover vídeo" type="button" onClick={() => onUpdate({ videoUrl: "" })} className="absolute right-2 top-2" variant="glass">
              <X />
            </IconButton>
          </div>
        </div>
      )}

      {(() => {
        const isStandardPost = currentPost.type === "post" || currentPost.type === "promoted" || currentPost.type === "carousel";
        if (!isStandardPost) return null;

        const safeFeedImages = Array.isArray(currentPost.feedImages) ? currentPost.feedImages : currentPost.feedImages ? [currentPost.feedImages] : [];

        return (
          <div className={styles.mediaGroup}>
            <div className={styles.mediaSection}>
              <label className={styles.mediaLabel}>
                <ImageIcon /> Feed ({safeFeedImages.length}/{currentPost.type === "carousel" ? 10 : 1})
              </label>
              {safeFeedImages.length > 0 && (
                <div className={styles.thumbnailList}>
                  {safeFeedImages.map((url, idx) =>
                    renderImageItem(
                      url,
                      () => {
                        const newFeed = [...safeFeedImages];
                        newFeed.splice(idx, 1);
                        onUpdate({ feedImages: newFeed });
                      },
                      idx,
                    ),
                  )}
                </div>
              )}
            </div>

            <div className={styles.mediaSection}>
              <label className={styles.mediaLabel}>
                <ImageIcon /> Story (Formato Vertical)
              </label>
              {currentPost.storyImage && <div className={styles.thumbnailList}>{renderImageItem(currentPost.storyImage, () => onUpdate({ storyImage: "" }), "story")}</div>}
            </div>
          </div>
        );
      })()}

      {currentPost.type === "reel" && currentPost.coverImage && (
        <div className={styles.mediaSection}>
          <label className={styles.mediaLabel}>
            <ImageIcon /> Capa do Reel
          </label>
          <div className={styles.thumbnailList}>{renderImageItem(currentPost.coverImage, () => onUpdate({ coverImage: "" }), "reel-cover")}</div>
        </div>
      )}

      {currentPost.type === "linkedin" && currentPost.linkedinCover && (
        <div className={styles.mediaSection}>
          <label className={styles.mediaLabel}>
            <ImageIcon /> Banner do Artigo
          </label>
          <div className={styles.thumbnailList}>{renderImageItem(currentPost.linkedinCover, () => onUpdate({ linkedinCover: "" }), "linkedin-cover")}</div>
        </div>
      )}
    </div>
  );
}
