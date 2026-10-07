"use client";
/** Alterna entre autenticação de conta aprovada, solicitação de novo acesso, redefinição de senha ou setup inicial. */

import { useState } from "react";
import {
  UserCheck,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Calendar,
  Key,
} from "lucide-react";
import type { SafeUser } from "@/lib/auth";

/** Entrega ao contêiner somente o usuário devolvido por login ou setup bem-sucedido. */
export function AuthScreen({
  onLoginSuccess,
  isFirstSetup = false,
  initialError = null,
}: {
  onLoginSuccess: (user: SafeUser) => void;
  isFirstSetup?: boolean;
  initialError?: string | null;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [username, setUsername] = useState(isFirstSetup ? "admin" : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState(isFirstSetup ? "Administrador" : "");
  const [role, setRole] = useState<"social_media" | "designer">("social_media");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /** No setup cria a conta mestre; no cadastro cria pendente; no esqueci a senha solicita redefinição; no login entra. */
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
          data = await res.clone().json();
        } catch {
          const raw = await res.text().catch(() => "");
          throw new Error(raw && raw.length < 200 ? raw : `Erro no servidor (${res.status}). Verifique a conexão com o banco de dados.`);
        }
        if (!res.ok) throw new Error(data?.error || "Falha ao configurar administrador inicial.");

        onLoginSuccess(data.user);
      } else if (isForgotPassword) {
        // Fluxo de esqueci minha senha: envia a nova senha e solicita aprovação ao administrador
        if (password.length < 8) {
          throw new Error("A nova senha deve ter no mínimo 8 caracteres.");
        }
        if (password !== confirmPassword) {
          throw new Error("A confirmação da nova senha não coincide.");
        }

        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        let data: any = null;
        try {
          data = await res.clone().json();
        } catch {
          const raw = await res.text().catch(() => "");
          throw new Error(raw && raw.length < 200 ? raw : `Erro no servidor (${res.status}).`);
        }

        if (!res.ok) throw new Error(data?.error || "Falha ao solicitar troca de senha.");

        setSuccessMessage(
          data?.message ||
            "Solicitação enviada com sucesso! O administrador recebeu o pedido e precisa autorizar seu acesso antes que você possa entrar."
        );
        setIsForgotPassword(false);
        setPassword("");
        setConfirmPassword("");
      } else if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, name, role }),
        });
        let data: any = null;
        try {
          data = await res.clone().json();
        } catch {
          const raw = await res.text().catch(() => "");
          throw new Error(raw && raw.length < 200 ? raw : `Erro no servidor (${res.status}). Verifique se o banco de dados está ativo.`);
        }
        if (!res.ok) throw new Error(data?.error || "Falha ao registrar");

        if (data?.user) {
          // Se for o primeiro usuário do banco, ele já se tornou Administrador automaticamente!
          onLoginSuccess(data.user);
          return;
        }

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
          data = await res.clone().json();
        } catch {
          const raw = await res.text().catch(() => "");
          throw new Error(raw && raw.length < 200 ? raw : `Erro de conexão (${res.status}). Verifique as variáveis do banco PostgreSQL na Vercel.`);
        }
        if (!res.ok) {
          if (data?.needsSetup) {
            setIsRegister(true);
          }
          throw new Error(data?.error || "Falha ao autenticar");
        }

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
            {isForgotPassword ? <Key size={22} strokeWidth={2.2} /> : <Calendar size={24} strokeWidth={2.2} />}
          </div>
          <h1>{isForgotPassword ? "Recuperar Acesso" : "Calendário"}</h1>
          <p className="authSubtitle">
            {isFirstSetup
              ? "Configuração Inicial do Sistema"
              : isForgotPassword
              ? "Defina uma nova senha. O administrador liberará seu acesso."
              : "Presentation Studio & Gestão Editorial"}
          </p>
        </header>

        {isFirstSetup ? (
          <div
            className="authAlert"
            style={{
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              color: "#818cf8",
            }}
          >
            <ShieldCheck size={18} />
            <span>Nenhum usuário cadastrado. Crie a conta do primeiro administrador para iniciar.</span>
          </div>
        ) : isForgotPassword ? (
          <div
            className="authAlert"
            style={{
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#d97706",
            }}
          >
            <Key size={16} />
            <span>Informe seu usuário e a nova senha desejada. O administrador receberá sua solicitação para autorizar seu acesso.</span>
          </div>
        ) : (
          <div className="authTabs">
            <button
              type="button"
              className={!isRegister ? "active" : ""}
              onClick={() => {
                setIsRegister(false);
                setIsForgotPassword(false);
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
                setIsForgotPassword(false);
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
          {(isFirstSetup || isRegister) && !isForgotPassword && (
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
            <span>{isForgotPassword ? "Seu Nome de Usuário" : "Usuário"}</span>
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
            <span>{isForgotPassword ? "Nova Senha" : "Senha"}</span>
            <div className="inputBox">
              <Lock size={16} />
              <input
                type="password"
                required
                minLength={isFirstSetup || isRegister || isForgotPassword ? 8 : undefined}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>

          {/* Opção Esqueci minha senha no formulário de login padrão */}
          {!isFirstSetup && !isRegister && !isForgotPassword && (
            <div className="forgotPasswordRow">
              <button
                type="button"
                className="forgotPasswordLink"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError(null);
                  setSuccessMessage(null);
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          {(isFirstSetup || isForgotPassword) && (
            <label className="formField">
              <span>Confirmar {isForgotPassword ? "Nova Senha" : "Senha"}</span>
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

          {!isFirstSetup && isRegister && !isForgotPassword && (
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
            ) : isForgotPassword ? (
              <>
                Solicitar Nova Senha ao Administrador <ArrowRight size={16} />
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

          {isForgotPassword && (
            <button
              type="button"
              className="backToLoginBtn"
              onClick={() => {
                setIsForgotPassword(false);
                setError(null);
                setPassword("");
                setConfirmPassword("");
              }}
            >
              <ArrowLeft size={14} /> Voltar para o Login
            </button>
          )}
        </form>

        {!isFirstSetup && !isRegister && !isForgotPassword && (
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
