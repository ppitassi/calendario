import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Lock,
  Eye,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, signInWithEmailAndPassword } from '../lib/auth';
import { BackgroundEffects } from "../components/BackgroundEffects";

import { AgencySetupScreen } from './AgencySetupScreen';

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
      console.log(`🚀 Iniciando autenticação para: ${username}`);
      await signInWithEmailAndPassword(auth, username, password, rememberMe);
      onLogin(); 
    } catch (err: any) {
      console.error("❌ Erro de Autenticação:", err);
      const errorMessage = err.message || "Erro desconhecido ao autenticar";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center flex-col relative z-10 w-full px-4 tracking-wide">
      <BackgroundEffects />
      {isConfigOpen && (
        <AgencySetupScreen 
          onClose={() => setIsConfigOpen(false)} 
          onSave={() => window.location.reload()}
        />
      )}
      <div className="glass p-10 md:p-14 rounded-[3rem] w-full max-w-md shadow-2xl flex flex-col items-center border border-white/20">
        <button 
          onClick={() => {
            const newCount = configClicks + 1;
            setConfigClicks(newCount);
            if (newCount >= 5) {
               setIsConfigOpen(true);
               setConfigClicks(0);
            }
          }}
          className="w-16 h-16 rounded-3xl bg-[var(--color-primary)] flex items-center justify-center text-white mb-8 shadow-xl shadow-[var(--color-primary)]/20 hover:scale-110 active:scale-95 transition-all"
        >
          <Lock className="w-8 h-8" />
        </button>
        

        <h1 className="text-3xl font-display font-bold  mb-2 text-center leading-tight">Content Planner</h1>
        <p className="text-sm opacity-60 mb-8 text-center text-balance">
          Insira suas credenciais de administrador.
        </p>
        
        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold px-4 py-3 rounded-xl mb-6 flex items-start gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div className="w-full space-y-4">
          <div className="relative">
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuário"
              className="w-full bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all font-medium tracking-wide"
            />
          </div>

          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all font-medium tracking-wide"
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 opacity-40 hover:opacity-100 transition-opacity"
            >
              <Eye className={cn("w-5 h-5", showPassword ? "text-[var(--color-primary)] opacity-100" : "")} />
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-black/10 accent-[var(--color-primary)]"
              />
              <span className="text-xs font-semibold opacity-40 group-hover:opacity-100 transition-opacity">Continuar Logado</span>
            </label>
          </div>
        </div>
        
        <button 
          onClick={handleAuth}
          disabled={isLoading}
          className="w-full mt-8 bg-[var(--color-primary)] text-white font-bold uppercase text-sm py-5 rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[var(--color-primary)]/30 disabled:opacity-50"
        >
          {isLoading ? 'Aguarde...' : 'Autenticar'}
        </button>
      </div>
    </div>
  );
}
