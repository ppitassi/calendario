import React from 'react';
import { api } from './api';

// --- Auth Management (MySQL Session) ---
let _currentUser: any = null;
const authListeners = new Set<Function>();

export const auth: any = { 
  get currentUser() { return _currentUser; },
  set currentUser(v) { 
    _currentUser = v; 
    if (!v) {
      localStorage.removeItem('content_planner_token');
      sessionStorage.removeItem('content_planner_token');
    }
    authListeners.forEach((fn: any) => fn(v));
  }
};

export const useAuthState = (authObj: any) => {
  const [user, setUser] = React.useState(authObj.currentUser);
  const [loading, setLoading] = React.useState(!authObj.currentUser);

  React.useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('content_planner_token') || sessionStorage.getItem('content_planner_token');
      
      // Restore from the HttpOnly cookie first; the legacy token is optional.
      if (!_currentUser) {
        try {
          const result = await api.validateToken(token || undefined);
          if (result.success) {
            auth.currentUser = { ...result.user, session_token: token || result.user?.session_token };
          } else {
            localStorage.removeItem('content_planner_token');
            sessionStorage.removeItem('content_planner_token');
            auth.currentUser = null;
          }
        } catch (e) {
          localStorage.removeItem('content_planner_token');
          sessionStorage.removeItem('content_planner_token');
          auth.currentUser = null;
        }
      }
      
      setUser(auth.currentUser);
      setLoading(false);
    };

    if (!_currentUser) {
      initAuth();
    } else {
      setLoading(false);
    }

    const fn = (u: any) => {
      setUser(u);
      setLoading(false);
    };
    authListeners.add(fn);
    return () => { authListeners.delete(fn); };
  }, [authObj]);

  return [user, loading, null];
};

export const signInWithEmailAndPassword = async (authObj: any, email: string, pass: string, rememberMe?: boolean) => {
  try {
    const result = await api.login({ email, password: pass, rememberMe });
    if (result.success) {
      const token = result.user?.session_token || result.session_token;
      if (rememberMe !== false) {
        localStorage.setItem('content_planner_token', token);
        sessionStorage.removeItem('content_planner_token');
      } else {
        sessionStorage.setItem('content_planner_token', token);
        localStorage.removeItem('content_planner_token');
      }
      auth.currentUser = { ...result.user, session_token: token };
      return { user: auth.currentUser };
    }
    throw new Error('Erro ao autenticar');
  } catch (e: any) {
    throw new Error(e.response?.data?.error || 'Credenciais inválidas.');
  }
};

export const signOut = async (..._args: any[]) => {
  try { await api.logout(); } catch {}
  auth.currentUser = null;
};
