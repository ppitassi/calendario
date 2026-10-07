"use client";

import React, { useEffect, useState } from "react";
import { X, Server, PlugZap, Save, FolderSync, CheckCircle2, AlertCircle, Loader2, KeyRound } from "lucide-react";
import styles from "./DeveloperSettingsModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Feedback = { kind: "ok" | "error"; text: string } | null;

export function DeveloperSettingsModal({ isOpen, onClose }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [storageRoot, setStorageRoot] = useState("/");
  const [hasPassword, setHasPassword] = useState(false);
  const [source, setSource] = useState<string>("none");
  const [busy, setBusy] = useState<null | "load" | "test" | "save" | "scan">(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  if (!isOpen) return null;

  const body = () => JSON.stringify({ baseUrl, username, storageRoot, appPassword });
  const post = (url: string, method: string) =>
    fetch(url, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" && url.endsWith("/storage") && !url.includes("settings") ? undefined : body() });

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
      setFeedback({ kind: "ok", text: "Configuração salva." });
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

  const disabled = busy !== null;

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="dev-settings-title">
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.icon}><Server size={18} /></span>
            <div>
              <h2 id="dev-settings-title">Configurações de Desenvolvedor</h2>
              <p>Servidor de arquivos (Nextcloud)</p>
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className={styles.body}>
          <span className={styles.badge}>
            {source === "database" ? "Configuração salva no app" : source === "env" ? "Usando variáveis de ambiente" : "Não configurado"}
          </span>

          <label className={styles.field}>
            <span>URL do servidor</span>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://nuvem.seudominio.com" disabled={disabled} />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span>Usuário</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu-usuario" autoComplete="off" disabled={disabled} />
            </label>
            <label className={styles.field}>
              <span><KeyRound size={12} /> App password</span>
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
            <input value={storageRoot} onChange={(e) => setStorageRoot(e.target.value)} placeholder="/Clientes" disabled={disabled} />
            <small>Caminho relativo à sua pasta pessoal no Nextcloud.</small>
          </label>

          {feedback && (
            <div className={feedback.kind === "ok" ? styles.ok : styles.error} role="status">
              {feedback.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
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
        </footer>
      </div>
    </div>
  );
}
