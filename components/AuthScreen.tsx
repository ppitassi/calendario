"use client";
/** Alterna entre autenticação de conta aprovada, solicitação de novo acesso ou setup inicial. */

import { useState } from "react";
import { UserCheck, Lock, User, AlertCircle, ArrowRight, ShieldCheck, Calendar } from "lucide-react";
import type { SafeUser } from "@/lib/auth";

/** Entrega ao contêiner somente o usuário devolvido por login ou setup bem-sucedido. */
export function AuthScreen({
  onLoginSuccess,
  isFirstSetup = false,
}: {
  onLoginSuccess: (user: SafeUser) => void;
  isFirstSetup?: boolean;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState(isFirstSetup ? "admin" : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState(isFirstSetup ? "Administrador" : "");
  const [role, setRole] = useState<"social_media" | "designer">("social_media");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /** No setup cria a conta mestre; no cadastro cria pendente; no login entra. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isFirstSetup) {
        if (password.length < 8) {
          throw new Error("A senha deve ter no mínimo 8 caracteres.");
        }
        if (password !== confirmPassword) {
          throw new Error("A confirmação da senha não coincide.");
        }

        const res = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, name }),
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          throw new Error(`Erro no servidor (${res.status} ${res.statusText || "Falha interna"}).`);
        }
        if (!res.ok) throw new Error(data?.error || "Falha ao configurar administrador inicial.");

        onLoginSuccess(data.user);
      } else if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, name, role }),
        });
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          throw new Error(
            `Erro de comunicação com o servidor (${res.status} ${res.statusText || "Falha interna"}). Verifique se o backend está ativo.`
          );
        }
        if (!res.ok) throw new Error(data?.error || "Falha ao registrar");

        setSuccessMessage(
          "Solicitação enviada com sucesso! O administrador recebeu uma notificação e precisa aprovar sua conta antes do primeiro acesso."
        );
        setIsRegister(false);
        setPassword("");
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          throw new Error(
            `Erro de comunicação com o servidor (${res.status} ${res.statusText || "Falha interna"}). Verifique os logs do servidor.`
          );
        }
        if (!res.ok) throw new Error(data?.error || "Falha ao autenticar");

        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrapper">
      <div className="authCard">
        <header className="authHeader">
          <div className="authLogo">
            <Calendar size={24} strokeWidth={2.2} />
          </div>
          <h1>Calendário</h1>
          <p className="authSubtitle">
            {isFirstSetup ? "Configuração Inicial do Sistema" : "Presentation Studio & Gestão Editorial"}
          </p>
        </header>

        {isFirstSetup ? (
          <div className="authAlert" style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.3)", color: "#818cf8" }}>
            <ShieldCheck size={18} />
            <span>Nenhum usuário cadastrado. Crie a conta do primeiro administrador para iniciar.</span>
          </div>
        ) : (
          <div className="authTabs">
            <button
              type="button"
              className={!isRegister ? "active" : ""}
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={isRegister ? "active" : ""}
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
            >
              Solicitar Acesso
            </button>
          </div>
        )}

        {error && (
          <div className="authAlert error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="authAlert success">
            <UserCheck size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="authForm">
          {(isFirstSetup || isRegister) && (
            <label className="formField">
              <span>{isFirstSetup ? "Nome do Administrador" : "Seu Nome Completo"}</span>
              <div className="inputBox">
                <User size={16} />
                <input
                  type="text"
                  required
                  placeholder="Ex: Leonardo Pitassi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </label>
          )}

          <label className="formField">
            <span>Usuário</span>
            <div className="inputBox">
              <User size={16} />
              <input
                type="text"
                required
                placeholder="Ex: admin ou seu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
              />
            </div>
          </label>

          <label className="formField">
            <span>Senha</span>
            <div className="inputBox">
              <Lock size={16} />
              <input
                type="password"
                required
                minLength={isFirstSetup ? 8 : isRegister ? 8 : undefined}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>

          {isFirstSetup && (
            <label className="formField">
              <span>Confirmar Senha</span>
              <div className="inputBox">
                <Lock size={16} />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </label>
          )}

          {!isFirstSetup && isRegister && (
            <div className="formField">
              <span>Sua Função na Equipe</span>
              <div className="rolePicker">
                <label className={`roleOption ${role === "social_media" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="role"
                    value="social_media"
                    checked={role === "social_media"}
                    onChange={() => setRole("social_media")}
                  />
                  <div>
                    <strong>Social Media</strong>
                    <small>Cria pautas, briefings e envia p/ designers</small>
                  </div>
                </label>
                <label className={`roleOption ${role === "designer" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="role"
                    value="designer"
                    checked={role === "designer"}
                    onChange={() => setRole("designer")}
                  />
                  <div>
                    <strong>Designer</strong>
                    <small>Cria artes, uploads e envia p/ social media</small>
                  </div>
                </label>
              </div>
              <p className="authHint">
                * Novos cadastros exigem aprovação do administrador antes de entrar.
              </p>
            </div>
          )}

          <button type="submit" disabled={loading} className="primaryButton full submitBtn">
            {loading ? (
              "Processando..."
            ) : isFirstSetup ? (
              <>
                Criar Administrador e Iniciar <ArrowRight size={16} />
              </>
            ) : isRegister ? (
              <>
                Enviar Solicitação <ArrowRight size={16} />
              </>
            ) : (
              <>
                Entrar no Studio <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {!isFirstSetup && !isRegister && (
          <footer className="authFooter">
            <small>
              As credenciais iniciais são definidas no ambiente da instalação.
            </small>
          </footer>
        )}
      </div>
    </div>
  );
}
