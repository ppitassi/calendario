"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Server,
  PlugZap,
  Save,
  FolderSync,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Keyboard,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useHotkeys, type ModifierKey } from "@/lib/hotkeys";
import styles from "./DeveloperSettingsModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "storage" | "hotkeys";
}

type Feedback = { kind: "ok" | "error"; text: string } | null;

export function DeveloperSettingsModal({ isOpen, onClose, initialTab = "hotkeys" }: Props) {
  const [activeTab, setActiveTab] = useState<"storage" | "hotkeys">(initialTab);
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [storageRoot, setStorageRoot] = useState("/");
  const [hasPassword, setHasPassword] = useState(false);
  const [source, setSource] = useState<string>("none");
  const [busy, setBusy] = useState<null | "load" | "test" | "save" | "scan">(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Hook de atalhos e hotkeys
  const { hotkeys, updateHotkey, resetToDefaults } = useHotkeys();
  const [hotkeySavedNotice, setHotkeySavedNotice] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setFeedback(null);
    setAppPassword("");
    setBusy("load");
    fetch("/api/settings/storage")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setBaseUrl(d.settings.baseUrl);
          setUsername(d.settings.username);
          setStorageRoot(d.settings.storageRoot || "/");
          setHasPassword(Boolean(d.settings.hasPassword));
          setSource(d.settings.source);
        } else if (d.error) setFeedback({ kind: "error", text: d.error });
      })
      .catch(() => setFeedback({ kind: "error", text: "Falha ao carregar configurações." }))
      .finally(() => setBusy(null));
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const body = () => JSON.stringify({ baseUrl, username, storageRoot, appPassword });
  const post = (url: string, method: string) =>
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" && url.endsWith("/storage") && !url.includes("settings") ? undefined : body(),
    });

  const test = async () => {
    setBusy("test");
    setFeedback(null);
    try {
      const d = await (await post("/api/settings/storage", "POST")).json();
      setFeedback({ kind: d.ok ? "ok" : "error", text: d.message || d.error });
    } catch {
      setFeedback({ kind: "error", text: "Falha de rede ao testar." });
    }
    setBusy(null);
  };

  const save = async () => {
    setBusy("save");
    setFeedback(null);
    try {
      const res = await post("/api/settings/storage", "PUT");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao salvar.");
      setHasPassword(Boolean(d.settings?.hasPassword));
      setSource(d.settings?.source || "database");
      setAppPassword("");
      setFeedback({ kind: "ok", text: "Configuração de armazenamento salva." });
    } catch (e: any) {
      setFeedback({ kind: "error", text: e.message });
    }
    setBusy(null);
  };

  const scan = async () => {
    setBusy("scan");
    setFeedback(null);
    try {
      const res = await fetch("/api/storage", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro no scan.");
      setFeedback({ kind: "ok", text: "Árvore de diretórios indexada." });
    } catch (e: any) {
      setFeedback({ kind: "error", text: e.message });
    }
    setBusy(null);
  };

  const handleModifierChange = (id: string, newMod: ModifierKey) => {
    updateHotkey(id, { modifier: newMod });
    setHotkeySavedNotice(true);
    setTimeout(() => setHotkeySavedNotice(false), 2200);
  };

  const handleKeyChange = (id: string, newKey: string) => {
    updateHotkey(id, { key: newKey.toLowerCase().trim() });
    setHotkeySavedNotice(true);
    setTimeout(() => setHotkeySavedNotice(false), 2200);
  };

  const disabled = busy !== null;

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.icon}>
              {activeTab === "hotkeys" ? <Keyboard size={18} /> : <Server size={18} />}
            </span>
            <div>
              <h2 id="settings-title">Configurações & Preferências</h2>
              <p>{activeTab === "hotkeys" ? "Editor de atalhos e seleção do calendário" : "Servidor de arquivos (Nextcloud)"}</p>
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* Abas Superiores */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "hotkeys" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("hotkeys")}
          >
            <Keyboard size={14} />
            <span>Atalhos & Hotkeys</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "storage" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("storage")}
          >
            <Server size={14} />
            <span>Servidor de Armazenamento</span>
          </button>
        </div>

        {/* ABA 1: HOTKEYS / ATALHOS */}
        {activeTab === "hotkeys" && (
          <div className={styles.body}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className={styles.badge}>Atalhos Interativos</span>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={resetToDefaults}
                title="Restaurar teclas de atalho padrão"
              >
                <RotateCcw size={12} />
                <span>Restaurar padrões</span>
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted, #64748b)", lineHeight: 1.4 }}>
              Configure as teclas modificadoras e atalhos usados para planejar e interagir com as datas no calendário:
            </p>

            <div className={styles.hotkeysList}>
              {hotkeys.map((hk) => (
                <div key={hk.id} className={styles.hotkeyCard}>
                  <div className={styles.hotkeyInfo}>
                    <span className={styles.hotkeyLabel}>{hk.label}</span>
                    <span className={styles.hotkeyDesc}>{hk.description}</span>
                  </div>

                  <div className={styles.hotkeyControls}>
                    {/* Seletor de modificador (Ctrl, Shift, Alt, Cmd) */}
                    <select
                      className={styles.hotkeySelect}
                      value={hk.modifier}
                      onChange={(e) => handleModifierChange(hk.id, e.target.value as ModifierKey)}
                      aria-label={`Modificador para ${hk.label}`}
                    >
                      <option value="Ctrl">Ctrl (ou Cmd no Mac)</option>
                      <option value="Shift">Shift</option>
                      <option value="Alt">Alt / Option</option>
                      <option value="Meta">Cmd / Win</option>
                    </select>

                    {hk.isClickAction ? (
                      <span className={styles.hotkeyActionBadge}>+ Clique no dia</span>
                    ) : (
                      <div className={styles.hotkeyKeyWrap}>
                        <span>+</span>
                        <input
                          type="text"
                          maxLength={1}
                          className={styles.hotkeyKeyInput}
                          value={hk.key || ""}
                          onChange={(e) => handleKeyChange(hk.id, e.target.value)}
                          aria-label={`Tecla para ${hk.label}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {hotkeySavedNotice && (
              <div className={styles.ok} role="status">
                <CheckCircle2 size={15} />
                <span>Atalho atualizado com sucesso! Pronto para usar.</span>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: NEXTCLOUD / STORAGE */}
        {activeTab === "storage" && (
          <div className={styles.body}>
            <span className={styles.badge}>
              {source === "database"
                ? "Configuração salva no app"
                : source === "env"
                ? "Usando variáveis de ambiente"
                : "Não configurado"}
            </span>

            <label className={styles.field}>
              <span>URL do servidor</span>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://nuvem.seudominio.com"
                disabled={disabled}
              />
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                <span>Usuário</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu-usuario"
                  autoComplete="off"
                  disabled={disabled}
                />
              </label>
              <label className={styles.field}>
                <span>
                  <KeyRound size={12} /> App password
                </span>
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder={hasPassword ? "•••••••• (salvo — deixe em branco para manter)" : "Gerado em Segurança → Dispositivos"}
                  autoComplete="new-password"
                  disabled={disabled}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Pasta raiz dos clientes</span>
              <input
                value={storageRoot}
                onChange={(e) => setStorageRoot(e.target.value)}
                placeholder="/Clientes"
                disabled={disabled}
              />
              <small>Caminho relativo à sua pasta pessoal no Nextcloud.</small>
            </label>

            {feedback && (
              <div className={feedback.kind === "ok" ? styles.ok : styles.error} role="status">
                {feedback.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{feedback.text}</span>
              </div>
            )}
          </div>
        )}

        <footer className={styles.footer}>
          {activeTab === "storage" ? (
            <>
              <button type="button" className={styles.secondary} onClick={scan} disabled={disabled}>
                {busy === "scan" ? <Loader2 size={15} className={styles.spin} /> : <FolderSync size={15} />} Indexar pastas
              </button>
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={test} disabled={disabled}>
                  {busy === "test" ? <Loader2 size={15} className={styles.spin} /> : <PlugZap size={15} />} Testar conexão
                </button>
                <button type="button" className={styles.primary} onClick={save} disabled={disabled}>
                  {busy === "save" ? <Loader2 size={15} className={styles.spin} /> : <Save size={15} />} Salvar
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
              <button type="button" className={styles.primary} onClick={onClose}>
                <span>Concluir</span>
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

