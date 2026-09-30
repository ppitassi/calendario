"use client";
/** Alterna entre autenticação de conta aprovada e solicitação de um novo acesso. */


import { useState } from "react";
import { UserCheck, Lock, User, AlertCircle, ArrowRight } from "lucide-react";
import type { SafeUser } from "@/lib/auth";

/** Entrega ao contêiner somente o usuário devolvido por um login bem-sucedido. */
export function AuthScreen({ onLoginSuccess }: { onLoginSuccess: (user: SafeUser) => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"social_media" | "designer">("social_media");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /** No cadastro cria uma solicitação pendente; no login devolve o usuário ao AppShell. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isRegister) {
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
      {/* UI: painel central que alterna entre login e solicitação de acesso. */}
      <div className="authCard">
        {/* UI: identifica o produto antes dos dois fluxos de autenticação. */}
        <header className="authHeader">
          <div className="authLogo">CP</div>
          <h1>Content Planner</h1>
          <p className="authSubtitle">Presentation Studio & Gestão Editorial</p>
        </header>

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

        {/* UI: nome e função só aparecem no cadastro; usuário e senha servem aos dois fluxos. */}
        <form onSubmit={handleSubmit} className="authForm">
          {isRegister && (
            <label className="formField">
              <span>Seu Nome Completo</span>
              <div className="inputBox">
                <User size={16} />
                <input
                  type="text"
                  required
                  placeholder="Ex: Ana Silva"
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
                  minLength={isRegister ? 12 : undefined}
                  placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>

          {isRegister && (
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

        {!isRegister && (
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
