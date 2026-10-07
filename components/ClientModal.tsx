"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Client } from "../lib/types";
import styles from "./ClientsControl.module.css";

export interface ClientModalProps {
  isOpen: boolean;
  editingClient: Client | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ClientModal({
  isOpen,
  editingClient,
  onClose,
  onSaved,
}: ClientModalProps) {
  const [newName, setNewName] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [newTone, setNewTone] = useState("");
  const [newAudience, setNewAudience] = useState("");
  const [newStrategy, setNewStrategy] = useState("");
  const [newAccent, setNewAccent] = useState("#e3002f");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newHasMultipleProfiles, setNewHasMultipleProfiles] = useState(false);
  const [newHasPreCalendar, setNewHasPreCalendar] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (editingClient) {
      setNewName(editingClient.name);
      setNewSegment(editingClient.segment || "");
      setNewTone(editingClient.tone || "");
      setNewAudience(editingClient.audience || "");
      setNewStrategy(editingClient.strategy || "");
      setNewAccent(editingClient.accent || "#e3002f");
      setNewLogoUrl(editingClient.logo_url || "");
      setNewHasMultipleProfiles(Boolean(editingClient.has_multiple_profiles));
      setNewHasPreCalendar(Boolean(editingClient.has_pre_calendar));
    } else {
      setNewName("");
      setNewSegment("");
      setNewTone("");
      setNewAudience("");
      setNewStrategy("");
      setNewAccent("#e3002f");
      setNewLogoUrl("");
      setNewHasMultipleProfiles(false);
      setNewHasPreCalendar(false);
    }
  }, [editingClient, isOpen]);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao realizar upload");
      setNewLogoUrl(data.url);
    } catch (err: any) {
      alert(err.message || "Erro no upload da logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    try {
      const isEdit = !!editingClient;
      const url = isEdit ? `/api/clients/${editingClient.id}` : "/api/clients";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          segment: newSegment.trim(),
          tone: newTone.trim(),
          audience: newAudience.trim(),
          strategy: newStrategy.trim(),
          accent: newAccent,
          logo_url: newLogoUrl,
          has_multiple_profiles: newHasMultipleProfiles,
          has_pre_calendar: newHasPreCalendar,
        }),
      });

      if (res.ok) {
        onClose();
        await onSaved();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao criar cliente");
      }
    } catch {
      alert("Falha de conexão ao criar cliente");
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{editingClient ? "Editar Cliente" : "Novo Cliente"}</h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSaveClient}>
          <div className={styles.modalBody}>
            <div className={styles.formField}>
              <label>Nome do Cliente / Marca *</label>
              <input
                type="text"
                required
                placeholder="Ex: Agência Terceiro Andar"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.formField}>
              <label>Segmento / Nicho</label>
              <input
                type="text"
                placeholder="Ex: Publicidade e Branding"
                value={newSegment}
                onChange={(e) => setNewSegment(e.target.value)}
              />
            </div>

            <div className={styles.formField}>
              <label>Tom de Voz da Marca</label>
              <input
                type="text"
                placeholder="Ex: Profissional, acolhedor e estratégico"
                value={newTone}
                onChange={(e) => setNewTone(e.target.value)}
              />
            </div>

            <div className={styles.formField}>
              <label>Público-Alvo</label>
              <input
                type="text"
                placeholder="Ex: Empreendedores e gestores de tecnologia"
                value={newAudience}
                onChange={(e) => setNewAudience(e.target.value)}
              />
            </div>

            <div className={styles.formField}>
              <label>Diretriz Estratégica / Observações</label>
              <textarea
                rows={2}
                placeholder="Ex: Posicionar a marca com autoridade e linguagem humanizada"
                value={newStrategy}
                onChange={(e) => setNewStrategy(e.target.value)}
              />
            </div>

            <div className={styles.formField}>
              <label>Cor de Destaque da Marca</label>
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  value={newAccent}
                  onChange={(e) => setNewAccent(e.target.value)}
                />
                <input
                  type="text"
                  value={newAccent}
                  onChange={(e) => setNewAccent(e.target.value)}
                  style={{ width: "120px" }}
                />
              </div>
            </div>

            <div className={styles.formField}>
              <label>Logo do Cliente (SVG)</label>
              {newLogoUrl && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <img src={newLogoUrl} alt="Logo preview" style={{ height: 40, objectFit: "contain" }} />
                </div>
              )}
              <input
                type="file"
                accept=".svg, image/svg+xml"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleLogoUpload(e.target.files[0]);
                  }
                }}
              />
              {uploadingLogo && <span style={{ fontSize: "0.8rem", color: "#666" }}>Fazendo upload...</span>}
            </div>

            <div className={styles.formField} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                type="checkbox"
                id="hasMultipleProfiles"
                checked={newHasMultipleProfiles}
                onChange={(e) => setNewHasMultipleProfiles(e.target.checked)}
                style={{ width: "auto" }}
              />
              <label htmlFor="hasMultipleProfiles" style={{ margin: 0 }}>
                Cliente gerencia mais de um perfil de instagram
              </label>
            </div>

            <div className={styles.formField} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                type="checkbox"
                id="hasPreCalendar"
                checked={newHasPreCalendar}
                onChange={(e) => setNewHasPreCalendar(e.target.checked)}
                style={{ width: "auto" }}
              />
              <label htmlFor="hasPreCalendar" style={{ margin: 0 }}>
                Cliente possui pré-calendário (aprovação de copywriting antes das artes)
              </label>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={onClose}
              disabled={creating || uploadingLogo}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.modalSubmitBtn}
              disabled={creating || uploadingLogo}
            >
              {creating ? "Salvando..." : "Salvar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
