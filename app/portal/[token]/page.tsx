"use client";
/**
 * Portal do Cliente para Validação e Aprovação do Calendário.
 * Acessado por meio de link único com token seguro.
 * Renderiza a apresentação oficial com identidade visual completa,
 * campos para comentar em cada post, simulação discreta de feed ao fim,
 * e barra de aprovação com sequestro de tela para ressalvas.
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { parseMonthKey } from "@/lib/date";
import type { CalendarRecord, ContentItem } from "@/lib/types";
import { ViewerScreen } from "@/components/presentation/ViewerScreen";
import { AlertCircle } from "lucide-react";

export default function ClientPortalPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarRecord | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    if (!token) return;

    async function loadPortal() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/portal/${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Não foi possível carregar a apresentação do calendário.");
        }

        setCalendar(data.calendar);
        setItems(data.items || []);
      } catch (err: any) {
        setError(err.message || "Erro de conexão ao carregar a apresentação.");
      } finally {
        setLoading(false);
      }
    }

    loadPortal();
  }, [token]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
        gap: "12px",
        color: "#64748b",
      }}>
        <div style={{
          width: "36px",
          height: "36px",
          border: "3px solid #e2e8f0",
          borderTopColor: "#ef4444",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: "14px", fontWeight: "600" }}>
          Carregando apresentação do planejamento...
        </span>
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
        padding: "20px",
      }}>
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "460px",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>
            Acesso Indisponível
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px", lineHeight: "1.5" }}>
            {error || "O link fornecido é inválido ou expirou. Solicite um novo link à equipe."}
          </p>
        </div>
      </div>
    );
  }

  const monthDate = parseMonthKey(calendar.month);

  return (
    <ViewerScreen
      calendar={calendar}
      month={monthDate}
      items={items}
      clientMode={true}
      clientToken={token}
    />
  );
}
