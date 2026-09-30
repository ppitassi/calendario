"use client";
/**
 * Decide, no navegador, qual tela ocupa a rota inicial.
 *
 * Enquanto `/api/auth/me` confirma o cookie de sessão, mostra o carregamento;
 * sem usuário exibe o acesso e, com usuário aprovado, monta o aplicativo.
 */


import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { AppShell } from "@/components/AppShell";
import type { SafeUser } from "@/lib/auth";

/** Coordena a descoberta da sessão e alterna entre carregamento, acesso e Studio. */
export default function Home() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Consulta a sessão atual e garante que uma falha de rede resulte na tela de acesso. */
  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  // A sessão é consultada uma única vez ao montar a página; o login atualiza o estado diretamente.
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

  // UI: ocupa a janela inteira para impedir interação enquanto a identidade é desconhecida.
  if (loading) {
    return (
      <div className="fullScreenLoader">
        <div className="loaderSpinner" />
        <p>Conectando ao banco de dados SQLite...</p>
      </div>
    );
  }

  // UI: a autenticação fica isolada do restante do aplicativo e só devolve um usuário seguro.
  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={(user: SafeUser) => setCurrentUser(user)}
      />
    );
  }

  // UI: somente usuários aprovados alcançam o contêiner autenticado.
  return <AppShell currentUser={currentUser} onLogout={handleLogout} />;
}
