import { useState } from 'react';
import { 
  Lock,
  Eye,
  AlertCircle
} from 'lucide-react';
import { signInWithEmailAndPassword } from '../lib/auth';
import { BackgroundEffects } from "../components/BackgroundEffects";
import { Button } from "../components/ui/Button/Button";
import { Checkbox } from "../components/ui/Checkbox/Checkbox";
import { IconButton } from "../components/ui/IconButton/IconButton";
import { Input } from "../components/ui/Input/Input";

import { AgencySetupScreen } from './AgencySetupScreen';
import styles from './LoginScreen.module.css';

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Super Admin Config
  const [configClicks, setConfigClicks] = useState(0);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const handleAuth = async () => {
    if(!username || !password) {
      setError("Preencha usuário e senha");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(username, password, rememberMe);
      onLogin(); 
    } catch (err: any) {
      const errorMessage = err?.message || "Não foi possível autenticar. Verifique os dados e tente novamente.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <BackgroundEffects />
      {isConfigOpen && (
        <AgencySetupScreen 
          presentation="modal"
          onClose={() => setIsConfigOpen(false)} 
          onSave={() => window.location.reload()}
        />
      )}
      <div className={styles.card}>
        <IconButton
          label="Configuração da agência"
          onClick={() => {
            const newCount = configClicks + 1;
            setConfigClicks(newCount);
            if (newCount >= 5) {
               setIsConfigOpen(true);
               setConfigClicks(0);
            }
          }}
          className="mb-8"
          variant="primary"
          size="large"
        >
          <Lock />
        </IconButton>
        

        <h1>Content Planner</h1>
        <p className={styles.subtitle}>
          Insira suas credenciais de administrador.
        </p>
        
        {error && (
          <div id="login-error" role="alert" aria-live="assertive" className={styles.error}>
            <AlertCircle />
            <p>{error}</p>
          </div>
        )}

        <form className="w-full space-y-4" onSubmit={(event) => { event.preventDefault(); void handleAuth(); }}>
          <div className="relative">
            <label className="sr-only" htmlFor="login-username">Usuário</label>
            <Input
              id="login-username"
              name="username"
              type="text" 
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuário"
              className="w-full"
            />
          </div>

          <div className="relative">
            <label className="sr-only" htmlFor="login-password">Senha</label>
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"} 
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
            />
            <IconButton
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <Eye data-active={showPassword || undefined} />
            </IconButton>
          </div>

          <div className="flex items-center justify-between px-1">
            <Checkbox
                label="Continuar logado"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            variant="primary"
            loading={isLoading}
            className="w-full mt-8"
          >
            {isLoading ? 'Autenticando…' : 'Autenticar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
