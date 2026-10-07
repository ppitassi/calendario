"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import styles from "./CreateDemandDrawer.module.css";
import type {
  ClientAssignmentContext,
  DeliveryDefinition,
  Priority,
} from "@/lib/task-types";

interface ClientOption {
  id: string;
  name: string;
  primaryColor?: string;
}

interface TeamMemberOption {
  id: string;
  name: string;
  role: string;
}

interface CreateDemandDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clients: ClientOption[];
  preselectedClientId?: string;
  teamMembers?: TeamMemberOption[];
  onSuccess?: (createdItem: any) => void;
}

const DELIVERY_TYPE_OPTIONS = [
  { value: "feed_story", label: "Feed / Story" },
  { value: "reel", label: "Reel / Vídeo" },
  { value: "banner", label: "Banner" },
  { value: "encarte", label: "Encarte" },
  { value: "impresso", label: "Impresso" },
  { value: "capa", label: "Capa" },
  { value: "criativo_avulso", label: "Criativo Avulso" },
];

export function CreateDemandDrawer({
  isOpen,
  onClose,
  clients,
  preselectedClientId,
  teamMembers = [],
  onSuccess,
}: CreateDemandDrawerProps) {
  const [clientId, setClientId] = useState(preselectedClientId || "");
  const [clientContext, setClientContext] = useState<ClientAssignmentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [executorId, setExecutorId] = useState(""); // "" = Herdar do cliente
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [mode, setMode] = useState<"single" | "compound">("single");

  // Repeater de entregas
  const [deliveries, setDeliveries] = useState<DeliveryDefinition[]>([
    {
      type: "feed_story",
      quantity: 1,
      title: "",
      assigneeId: "",
      dueDate: "",
      description: "",
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza cliente pré-selecionado
  useEffect(() => {
    if (preselectedClientId) {
      setClientId(preselectedClientId);
    } else if (!clientId && clients.length > 0) {
      setClientId(clients[0].id);
    }
  }, [preselectedClientId, clients]);

  // Busca contexto estrutural do cliente quando clientId muda
  useEffect(() => {
    if (!clientId) {
      setClientContext(null);
      return;
    }

    let isMounted = true;
    setLoadingContext(true);

    fetch(`/api/demands?action=client_context&clientId=${clientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.context) {
          setClientContext(data.context);
        }
      })
      .catch((err) => console.error("Erro ao carregar contexto do cliente:", err))
      .finally(() => {
        if (isMounted) setLoadingContext(false);
      });

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  if (!isOpen) return null;

  const handleAddDelivery = () => {
    setDeliveries((prev) => [
      ...prev,
      {
        type: "feed_story",
        quantity: 1,
        title: "",
        assigneeId: "",
        dueDate: "",
        description: "",
      },
    ]);
  };

  const handleRemoveDelivery = (index: number) => {
    if (deliveries.length <= 1) return;
    setDeliveries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateDelivery = (
    index: number,
    field: keyof DeliveryDefinition,
    val: any
  ) => {
    setDeliveries((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Por favor, selecione um cliente.");
      return;
    }
    if (!title.trim()) {
      setError("Por favor, informe o título da demanda.");
      return;
    }

    setSubmitting(true);

    try {
      const activeDeliveries =
        mode === "single"
          ? [
              {
                type: deliveries[0]?.type || "feed_story",
                quantity: Math.max(1, Number(deliveries[0]?.quantity || 1)),
                title: deliveries[0]?.title || undefined,
                assigneeId: deliveries[0]?.assigneeId || null,
                dueDate: deliveries[0]?.dueDate || null,
                description: deliveries[0]?.description || undefined,
              },
            ]
          : deliveries.map((d) => ({
              type: d.type,
              quantity: Math.max(1, Number(d.quantity || 1)),
              title: d.title?.trim() || undefined,
              assigneeId: d.assigneeId || null,
              dueDate: d.dueDate || null,
              description: d.description?.trim() || undefined,
            }));

      const payload = {
        clientId,
        title: title.trim(),
        description: description.trim() || undefined,
        executorId: executorId || null,
        priority,
        dueDate: dueDate || null,
        deliveries: activeDeliveries,
      };

      const res = await fetch("/api/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao criar demanda.");
      }

      if (onSuccess) {
        onSuccess(data.workUnit);
      }

      // Reset
      setTitle("");
      setDescription("");
      setExecutorId("");
      setDueDate("");
      setDeliveries([
        {
          type: "feed_story",
          quantity: 1,
          title: "",
          assigneeId: "",
          dueDate: "",
          description: "",
        },
      ]);
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao criar demanda.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIcon}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className={styles.title}>Nova Demanda</h2>
              <p className={styles.subtitle}>
                Criação global de Work Unit e entregas canônicas
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <form onSubmit={handleSubmit} className={styles.body}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          {/* 1. Seleção de Cliente */}
          <div className={styles.formField}>
            <label className={styles.label}>Cliente *</label>
            <select
              className={styles.select}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecione o cliente...
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {clientContext?.owner && (
              <div className={styles.clientOwnerBadge}>
                <UserCheck size={13} />
                <span>
                  Responsável pelo cliente: <strong>{clientContext.owner.name}</strong>
                </span>
              </div>
            )}
          </div>

          {/* 2. Título da Demanda */}
          <div className={styles.formField}>
            <label className={styles.label}>Título da Demanda *</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Ex: Campanha Black Friday, Banner Promoção, Story Extra..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* 3. Descrição / Briefing */}
          <div className={styles.formField}>
            <label className={styles.label}>
              Descrição / Briefing Geral <span className={styles.labelHint}>(opcional)</span>
            </label>
            <textarea
              className={styles.textarea}
              placeholder="Descreva o objetivo da demanda, orientações e especificações..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 4. Responsável e Prioridade */}
          <div className={styles.twoCol}>
            <div className={styles.formField}>
              <label className={styles.label}>Responsável Geral</label>
              <select
                className={styles.select}
                value={executorId}
                onChange={(e) => setExecutorId(e.target.value)}
              >
                <option value="">
                  {clientContext?.owner
                    ? `Padrão do cliente (${clientContext.owner.name})`
                    : "Herdar do cliente (automático)"}
                </option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Prioridade</label>
              <select
                className={styles.select}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          {/* 5. Prazo Geral */}
          <div className={styles.formField}>
            <label className={styles.label}>
              Prazo da Demanda <span className={styles.labelHint}>(opcional)</span>
            </label>
            <input
              type="date"
              className={styles.input}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* 6. Modo: Simples vs Composta */}
          <div className={styles.formField}>
            <label className={styles.label}>Tipo de Demanda</label>
            <div className={styles.modeSwitcher}>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === "single" ? styles.active : ""}`}
                onClick={() => setMode("single")}
              >
                Entrega Única
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === "compound" ? styles.active : ""}`}
                onClick={() => setMode("compound")}
              >
                Demanda Composta (Várias Entregas)
              </button>
            </div>
          </div>

          {/* 7. Dynamic Task Builder / Entregas */}
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              {mode === "single" ? "Definição da Entrega" : "Entregas da Demanda"}
            </h3>
            {mode === "compound" && (
              <button
                type="button"
                className={styles.addDeliveryBtn}
                onClick={handleAddDelivery}
              >
                <Plus size={14} /> Adicionar Entrega
              </button>
            )}
          </div>

          <div className={styles.deliveryList}>
            {(mode === "single" ? [deliveries[0]] : deliveries).map((del, idx) => (
              <div key={idx} className={styles.deliveryCard}>
                <div className={styles.deliveryHeaderRow}>
                  <span className={styles.deliveryIndexBadge}>
                    Entrega {String(idx + 1).padStart(2, "0")}
                  </span>
                  {mode === "compound" && deliveries.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => handleRemoveDelivery(idx)}
                      title="Remover esta entrega"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className={styles.deliveryFieldsRow}>
                  <div className={styles.formField}>
                    <label className={styles.label}>Formato</label>
                    <select
                      className={styles.select}
                      value={del.type}
                      onChange={(e) =>
                        handleUpdateDelivery(idx, "type", e.target.value)
                      }
                    >
                      {DELIVERY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.label}>Quantidade</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className={styles.input}
                      value={del.quantity}
                      onChange={(e) =>
                        handleUpdateDelivery(
                          idx,
                          "quantity",
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                  </div>
                </div>

                <div className={styles.deliveryMetaRow}>
                  <div className={styles.formField}>
                    <label className={styles.label}>Responsável</label>
                    <select
                      className={styles.select}
                      value={del.assigneeId || ""}
                      onChange={(e) =>
                        handleUpdateDelivery(idx, "assigneeId", e.target.value || null)
                      }
                    >
                      <option value="">Herdar da demanda</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.label}>Prazo Específico</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={del.dueDate || ""}
                      onChange={(e) =>
                        handleUpdateDelivery(idx, "dueDate", e.target.value || null)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Submit */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              <CheckCircle2 size={16} />
              <span>{submitting ? "Criando Demanda..." : "Criar Demanda"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
