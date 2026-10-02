"use client";
/**
 * Decide, no navegador, qual tela ocupa a rota inicial.
 * Se o banco de dados for novo/vazio, direciona para o primeiro acesso.
 */

import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { AppShell } from "@/components/AppShell";
import type { SafeUser } from "@/lib/auth";

/** Coordena a descoberta da sessão e alterna entre carregamento, setup, acesso e Studio. */
export default function Home() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** Consulta a sessão atual e detecta se o sistema precisa de setup inicial. */
  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
        setNeedsSetup(false);
        setDbError(null);
      } else {
        setCurrentUser(null);
        setNeedsSetup(Boolean(data.needsSetup));
        if (data.dbError) {
          setDbError(data.dbError);
        }
      }
    } catch (err: any) {
      console.error("Auth check failed:", err);
      setCurrentUser(null);
      setDbError(err?.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  /** Encerra a sessão no servidor e volta para o formulário de acesso. */
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="fullScreenLoader">
        <div className="loaderSpinner" />
        <p>Carregando Calendário...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        isFirstSetup={needsSetup}
        initialError={dbError}
        onLoginSuccess={(user: SafeUser) => {
          setCurrentUser(user);
          setNeedsSetup(false);
          setDbError(null);
        }}
      />
    );
  }

  return <AppShell currentUser={currentUser} onLogout={handleLogout} />;
}
