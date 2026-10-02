"use client";
/**
 * Error boundary global do App Router para capturar exceções não tratadas
 * e impedir que a aplicação apresente uma tela branca ("white screen of death").
 */

import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro capturado pelo Error Boundary:", error);
  }, [error]);

  const handleResetStorageAndReload = () => {
    try {
      localStorage.removeItem("cp:active-screen");
      localStorage.removeItem("cp:active-calendar-id");
    } catch {}
    window.location.href = "/";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.08)",
          padding: "32px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "#fef2f2",
            color: "#ef4444",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 16px",
          }}
        >
          <AlertCircle size={28} />
        </div>

        <h1
          style={{
            fontSize: "20px",
            fontWeight: 800,
            color: "#0f172a",
            margin: "0 0 8px",
          }}
        >
          Ocorreu uma falha inesperada
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "#64748b",
            lineHeight: 1.5,
            margin: "0 0 24px",
          }}
        >
          {error?.message || "Não foi possível carregar esta tela. Tente recarregar ou retornar à página inicial."}
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={15} />
            <span>Tentar Novamente</span>
          </button>

          <button
            type="button"
            onClick={handleResetStorageAndReload}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              background: "#f1f5f9",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 700,
              border: "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          >
            <Home size={15} />
            <span>Voltar ao Início</span>
          </button>
        </div>
      </div>
    </div>
  );
}
