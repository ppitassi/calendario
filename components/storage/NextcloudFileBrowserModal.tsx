"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Folder,
  FileImage,
  FileVideo,
  FileText,
  File,
  Search,
  LayoutList,
  LayoutGrid,
  Star,
  Clock,
  HardDrive,
  Users,
  Check,
  Loader2,
  AlertCircle,
  Copy,
} from "lucide-react";
import styles from "./NextcloudFileBrowserModal.module.css";
import type { ContentItem } from "@/lib/types";

export interface NextcloudItem {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  mimeType: string;
  extension: string;
  isImage: boolean;
  isVideo: boolean;
  isDoc: boolean;
  lastModified?: string;
  etag?: string;
}

interface NextcloudFileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  clientName?: string;
  selectedItem?: ContentItem | null;
  onImportSuccess: (importedData: { imageUrl: string; filename: string }) => void;
}

export function NextcloudFileBrowserModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  selectedItem,
  onImportSuccess,
}: NextcloudFileBrowserModalProps) {
  // Estado de navegação e histórico (estilo Finder ‹ ›)
  const [currentPath, setCurrentPath] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Lista de itens e loading
  const [items, setItems] = useState<NextcloudItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Busca e visualização
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedFile, setSelectedFile] = useState<NextcloudItem | null>(null);

  // Importação
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatusText, setImportStatusText] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrorLog, setImportErrorLog] = useState<string | null>(null);
  const [hasCopiedLog, setHasCopiedLog] = useState<boolean>(false);

  // Sidebar source list ativa
  const [activeSidebarKey, setActiveSidebarKey] = useState<string>("nextcloud");

  // Cache da última pasta por cliente no localStorage
  const getStoredClientFolder = (): string | null => {
    if (!clientId || typeof window === "undefined") return null;
    try {
      return localStorage.getItem(`nextcloud_last_folder_${clientId}`) || null;
    } catch {
      return null;
    }
  };

  const storeClientFolder = (folderPath: string) => {
    if (!clientId || typeof window === "undefined") return;
    try {
      localStorage.setItem(`nextcloud_last_folder_${clientId}`, folderPath);
    } catch {}
  };

  // Carrega conteúdo de uma pasta
  const loadDirectory = async (targetPath?: string, recordHistory = true) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSelectedFile(null);

    try {
      const url = new URL("/api/storage/nextcloud/browse", window.location.origin);
      if (targetPath) {
        url.searchParams.set("path", targetPath);
      } else if (clientId) {
        // Se temos pasta salva no localStorage, usa como prioridade
        const savedFolder = getStoredClientFolder();
        if (savedFolder) {
          url.searchParams.set("path", savedFolder);
        } else {
          url.searchParams.set("clientId", clientId);
        }
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao conectar ao Nextcloud.");
      }

      const data = await res.json();
      const resolvedPath = data.currentPath || "/";
      setCurrentPath(resolvedPath);
      setItems(data.items || []);
      storeClientFolder(resolvedPath);

      // Gerencia histórico ‹ ›
      if (recordHistory) {
        setHistory((prev) => {
          const nextHist = prev.slice(0, historyIndex + 1);
          return [...nextHist, resolvedPath];
        });
        setHistoryIndex((prev) => prev + 1);
      }
    } catch (err: any) {
      console.error("loadDirectory error:", err);
      setErrorMsg(err.message || "Não foi possível carregar a pasta.");
    } finally {
      setIsLoading(false);
    }
  };

  // Inicializa quando abre o modal
  useEffect(() => {
    if (isOpen) {
      setHistory([]);
      setHistoryIndex(-1);
      setSearchQuery("");
      setSelectedFile(null);
      setErrorMsg(null);
      setImportStatusText(null);
      setImportError(null);
      loadDirectory();
    }
  }, [isOpen, clientId]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Navegar no histórico ‹
  const handleGoBack = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      loadDirectory(history[nextIdx], false);
    }
  };

  // Navegar no histórico ›
  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      loadDirectory(history[nextIdx], false);
    }
  };

  // Subir um nível (pasta pai) ↑
  const handleGoUp = () => {
    if (currentPath === "/" || !currentPath) return;
    const segments = currentPath.split("/").filter(Boolean);
    segments.pop();
    const parentPath = "/" + segments.join("/");
    loadDirectory(parentPath);
  };

  // Duplo clique na pasta ou arquivo
  const handleItemDoubleClick = (item: NextcloudItem) => {
    if (item.type === "directory") {
      loadDirectory(item.path);
    } else if (item.isImage || item.isVideo) {
      handleImport(item);
    }
  };

  // Executar Importação
  const handleImport = async (targetFile?: NextcloudItem) => {
    const fileToImport = targetFile || selectedFile;
    if (!fileToImport || !selectedItem) return;

    setIsImporting(true);
    setImportError(null);
    setImportErrorLog(null);
    setHasCopiedLog(false);
    setImportStatusText(`Importando ${fileToImport.name}…`);

    try {
      const res = await fetch("/api/storage/nextcloud/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: fileToImport.path,
          itemId: selectedItem.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const rawLog = JSON.stringify(
          {
            status: res.status,
            error: data.error || "Erro desconhecido",
            diagnostics: data.diagnostics || null,
            file: { name: fileToImport.name, path: fileToImport.path, size: fileToImport.size },
            selectedItem: { id: selectedItem.id, title: selectedItem.title },
            timestamp: new Date().toISOString(),
          },
          null,
          2
        );
        console.error("[Nextcloud Import Error]", data.error, data.diagnostics);
        setImportErrorLog(rawLog);
        throw new Error(data.error || "Falha na importação.");
      }

      const result = await dataResult(res);
      setImportStatusText(`✓ Arte importada`);

      setTimeout(() => {
        onImportSuccess({
          imageUrl: result.imageUrl,
          filename: fileToImport.name,
        });
        onClose();
      }, 500);
    } catch (err: any) {
      console.error("[Nextcloud Import Exception]", err);
      const displayMsg = err.message || "Não foi possível importar a arte.";
      setImportError(displayMsg);
      if (!importErrorLog) {
        setImportErrorLog(
          JSON.stringify(
            {
              error: displayMsg,
              file: { name: fileToImport.name, path: fileToImport.path },
              selectedItem: { id: selectedItem.id },
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );
      }
      setIsImporting(false);
      setImportStatusText(null);
    }
  };

  const dataResult = async (res: Response) => {
    return await res.json();
  };

  // Formatação de bytes para KB/MB
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "—";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Formatação de data
  const formatDateFriendly = (dStr?: string) => {
    if (!dStr) return "—";
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch {
      return dStr;
    }
  };

  // Breadcrumbs amigáveis
  const breadcrumbSegments = useMemo(() => {
    if (!currentPath || currentPath === "/") return [{ name: "Nextcloud", path: "/" }];
    const parts = currentPath.split("/").filter(Boolean);
    const result = [{ name: "Nextcloud", path: "/" }];
    let acc = "";
    for (const p of parts) {
      acc += "/" + p;
      result.push({ name: p, path: acc });
    }
    return result;
  }, [currentPath]);

  // Filtro de busca e compatibilidade
  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((it) => it.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlayBackdrop} onClick={onClose}>
      <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
        {/* =========================================================
            1. TITLE BAR
            ========================================================= */}
        <header className={styles.windowTitleBar}>
          <div className={styles.titleGroup}>
            <span className={styles.windowTitle}>Importar do Nextcloud</span>
            {selectedItem && (
              <span className={styles.postContextBadge}>
                {selectedItem.title || "Publicação"} · {selectedItem.type}
              </span>
            )}
          </div>

          <button
            type="button"
            className={styles.closeWindowBtn}
            onClick={onClose}
            title="Fechar (Esc)"
          >
            <X size={16} />
          </button>
        </header>

        {/* =========================================================
            2. TOOLBAR / NAVIGATION & BREADCRUMBS
            ========================================================= */}
        <div className={styles.browserToolbar}>
          {/* Navegação de Pastas: Voltar, Avançar e Subir Nível */}
          <div className={styles.navButtonGroup}>
            <button
              type="button"
              className={styles.navIconBtn}
              onClick={handleGoBack}
              disabled={historyIndex <= 0}
              title="Voltar pasta"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className={styles.navIconBtn}
              onClick={handleGoForward}
              disabled={historyIndex >= history.length - 1}
              title="Avançar pasta"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className={styles.navIconBtn}
              onClick={handleGoUp}
              disabled={currentPath === "/" || !currentPath}
              title="Subir um nível"
            >
              <ArrowUp size={15} />
            </button>
          </div>

          {/* Breadcrumb Interativo */}
          <div className={styles.breadcrumbScroll}>
            {breadcrumbSegments.map((seg, idx) => {
              const isLast = idx === breadcrumbSegments.length - 1;
              return (
                <React.Fragment key={seg.path}>
                  <button
                    type="button"
                    className={`${styles.breadcrumbSegment} ${isLast ? styles.current : ""}`}
                    onClick={() => !isLast && loadDirectory(seg.path)}
                  >
                    {seg.name}
                  </button>
                  {!isLast && <span className={styles.breadcrumbSeparator}>›</span>}
                </React.Fragment>
              );
            })}
          </div>

          {/* Lado Direito: Busca e Alternador Lista / Grade */}
          <div className={styles.toolbarRight}>
            <div className={styles.searchBox}>
              <Search size={13} />
              <input
                type="text"
                placeholder="Buscar arquivos…"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className={styles.viewModeToggle}>
              <button
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === "list" ? styles.active : ""}`}
                onClick={() => setViewMode("list")}
                title="Visualização em Lista"
              >
                <LayoutList size={13} />
              </button>
              <button
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === "grid" ? styles.active : ""}`}
                onClick={() => setViewMode("grid")}
                title="Visualização em Grade"
              >
                <LayoutGrid size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================
            3. MAIN BODY (SPLIT VIEW: SIDEBAR + CONTENT + PREVIEW)
            ========================================================= */}
        <div className={styles.browserBody}>
          {/* PAINEL ESQUERDO: SIDEBAR SOURCE LIST */}
          <aside className={styles.sidebarSourceList}>
            <div className={styles.sidebarSection}>
              <span className={styles.sidebarSectionTitle}>Locais</span>
              <button
                type="button"
                className={`${styles.sidebarItem} ${activeSidebarKey === "favorites" ? styles.active : ""}`}
                onClick={() => {
                  setActiveSidebarKey("favorites");
                  if (clientId) {
                    const saved = getStoredClientFolder();
                    if (saved) loadDirectory(saved);
                  }
                }}
              >
                <Star size={13} color="#f59e0b" />
                <span>Favoritos</span>
              </button>

              <button
                type="button"
                className={`${styles.sidebarItem} ${activeSidebarKey === "recent" ? styles.active : ""}`}
                onClick={() => {
                  setActiveSidebarKey("recent");
                }}
              >
                <Clock size={13} />
                <span>Recentes</span>
              </button>

              <button
                type="button"
                className={`${styles.sidebarItem} ${activeSidebarKey === "nextcloud" ? styles.active : ""}`}
                onClick={() => {
                  setActiveSidebarKey("nextcloud");
                  loadDirectory("/");
                }}
              >
                <HardDrive size={13} color="#38bdf8" />
                <span>Nextcloud</span>
              </button>

              <button
                type="button"
                className={`${styles.sidebarItem} ${activeSidebarKey === "client" ? styles.active : ""}`}
                onClick={() => {
                  setActiveSidebarKey("client");
                  loadDirectory(undefined); // carrega pasta padrão do cliente
                }}
              >
                <Users size={13} />
                <span>{clientName || "Clientes"}</span>
              </button>
            </div>
          </aside>

          {/* PAINEL CENTRAL: CONTENT AREA (LISTA OU GRADE) */}
          <main className={styles.contentArea}>
            {isLoading ? (
              <div className={styles.stateContainer}>
                <Loader2 size={24} className="animate-spin" color="#38bdf8" />
                <span>Carregando arquivos…</span>
              </div>
            ) : errorMsg ? (
              <div className={styles.stateContainer}>
                <AlertCircle size={24} color="#ef4444" />
                <span>{errorMsg}</span>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => loadDirectory("/")}
                  style={{ marginTop: 8 }}
                >
                  Ir para a raiz
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className={styles.stateContainer}>
                <Folder size={32} opacity={0.3} />
                <span>Esta pasta está vazia</span>
              </div>
            ) : viewMode === "list" ? (
              /* MODO LISTA */
              <table className={styles.listViewTable}>
                <thead>
                  <tr className={styles.tableHeaderRow}>
                    <th className={styles.tableHeaderCell} style={{ width: "45%" }}>Nome</th>
                    <th className={styles.tableHeaderCell} style={{ width: "25%" }}>Modificado</th>
                    <th className={styles.tableHeaderCell} style={{ width: "15%" }}>Tamanho</th>
                    <th className={styles.tableHeaderCell} style={{ width: "15%" }}>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isSelected = selectedFile?.id === item.id;
                    const isDir = item.type === "directory";
                    const isSupported = isDir || item.isImage || item.isVideo;

                    return (
                      <tr
                        key={item.id}
                        className={`${styles.fileRow} ${isSelected ? styles.selected : ""} ${!isSupported ? styles.muted : ""}`}
                        onClick={() => {
                          if (isDir) {
                            setSelectedFile(null);
                          } else {
                            setSelectedFile(item);
                          }
                        }}
                        onDoubleClick={() => handleItemDoubleClick(item)}
                      >
                        <td className={styles.cellName}>
                          {isDir ? (
                            <Folder size={15} color="#38bdf8" className={styles.rowIcon} />
                          ) : item.isImage ? (
                            <FileImage size={15} color="#10b981" className={styles.rowIcon} />
                          ) : item.isVideo ? (
                            <FileVideo size={15} color="#a855f7" className={styles.rowIcon} />
                          ) : item.isDoc ? (
                            <FileText size={15} color="#f59e0b" className={styles.rowIcon} />
                          ) : (
                            <File size={15} color="#64748b" className={styles.rowIcon} />
                          )}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.name}
                          </span>
                        </td>
                        <td className={styles.cellMeta}>{formatDateFriendly(item.lastModified)}</td>
                        <td className={styles.cellMeta}>{isDir ? "—" : formatBytes(item.size)}</td>
                        <td className={styles.cellMeta}>{isDir ? "Pasta" : item.extension.toUpperCase() || "Arquivo"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* MODO GRADE */
              <div className={styles.gridViewContainer}>
                {filteredItems.map((item) => {
                  const isSelected = selectedFile?.id === item.id;
                  const isDir = item.type === "directory";
                  const isSupported = isDir || item.isImage || item.isVideo;

                  return (
                    <div
                      key={item.id}
                      className={`${styles.gridItemCard} ${isSelected ? styles.selected : ""} ${!isSupported ? styles.muted : ""}`}
                      onClick={() => {
                        if (isDir) {
                          setSelectedFile(null);
                        } else {
                          setSelectedFile(item);
                        }
                      }}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                    >
                      <div className={styles.gridThumbnailFrame}>
                        {isDir ? (
                          <Folder size={36} color="#38bdf8" />
                        ) : item.isImage ? (
                          <img
                            src={`/api/storage/nextcloud/preview?path=${encodeURIComponent(item.path)}`}
                            alt={item.name}
                            className={styles.gridThumbnailImg}
                            loading="lazy"
                          />
                        ) : item.isVideo ? (
                          <FileVideo size={36} color="#a855f7" />
                        ) : (
                          <FileText size={36} color="#64748b" />
                        )}
                      </div>
                      <span className={styles.gridItemTitle} title={item.name}>
                        {item.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </main>

          {/* PAINEL DIREITO: INSPECTOR / PREVIEW DO ARQUIVO SELECIONADO */}
          {selectedFile && (
            <aside className={styles.previewInspectorPane}>
              <div className={styles.inspectorThumbBox}>
                {selectedFile.isImage ? (
                  <img
                    src={`/api/storage/nextcloud/preview?path=${encodeURIComponent(selectedFile.path)}`}
                    alt={selectedFile.name}
                    className={styles.inspectorImg}
                  />
                ) : selectedFile.isVideo ? (
                  <FileVideo size={48} color="#a855f7" />
                ) : (
                  <FileText size={48} color="#64748b" />
                )}
              </div>

              <div className={styles.inspectorDetails}>
                <span className={styles.inspectorFileName}>{selectedFile.name}</span>
                <div className={styles.inspectorMetaLine}>
                  <span>Tamanho</span>
                  <span>{formatBytes(selectedFile.size)}</span>
                </div>
                <div className={styles.inspectorMetaLine}>
                  <span>Tipo</span>
                  <span>{selectedFile.extension.toUpperCase() || "Arquivo"}</span>
                </div>
                <div className={styles.inspectorMetaLine}>
                  <span>Modificado</span>
                  <span>{formatDateFriendly(selectedFile.lastModified)}</span>
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* =========================================================
            4. MODAL FOOTER
            ========================================================= */}
        <footer className={styles.windowFooter}>
          <div className={styles.footerSelectionInfo}>
            {importError ? (
              <div className={styles.errorRow}>
                <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                <span className={styles.errorText} title={importError}>
                  {importError}
                </span>
                {importErrorLog && (
                  <button
                    type="button"
                    className={`${styles.copyLogBtn} ${hasCopiedLog ? styles.copyLogBtnCopied : ""}`}
                    onClick={() => {
                      navigator.clipboard.writeText(importErrorLog);
                      setHasCopiedLog(true);
                      setTimeout(() => setHasCopiedLog(false), 2500);
                    }}
                    title="Copiar log técnico completo do erro"
                  >
                    {hasCopiedLog ? (
                      <>
                        <Check size={11} />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copiar Log</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : importStatusText ? (
              <span style={{ color: "#38bdf8" }}>{importStatusText}</span>
            ) : selectedFile ? (
              <>
                <span className={styles.selectedBadge}>Selecionado:</span>
                <span>{selectedFile.name}</span>
                <span>({formatBytes(selectedFile.size)})</span>
              </>
            ) : (
              <span>Selecione uma imagem ou vídeo para importar.</span>
            )}
          </div>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isImporting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.importBtn}
              onClick={() => handleImport()}
              disabled={!selectedFile || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Importando…</span>
                </>
              ) : (
                <>
                  <Check size={13} />
                  <span>Importar</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
