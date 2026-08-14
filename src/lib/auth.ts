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
      localStorage.removeItem('content_planner_token');
      sessionStorage.removeItem('content_planner_token');
      // A sessão é restaurada exclusivamente pelo cookie HttpOnly.
      if (!_currentUser) {
        try {
          const result = await api.validateToken();
          if (result.success) {
            auth.currentUser = result.user;
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

export const signInWithEmailAndPassword = async (email: string, pass: string, rememberMe?: boolean) => {
  try {
    const result = await api.login({ email, password: pass, rememberMe });
    if (result.success) {
      localStorage.removeItem('content_planner_token');
      sessionStorage.removeItem('content_planner_token');
      auth.currentUser = result.user;

      const pendingAgencySettings = localStorage.getItem('pending_agency_settings');
      if (pendingAgencySettings) {
        try {
          const pending = JSON.parse(pendingAgencySettings);
          if (String(pending?.theme_config?.primary || '').toLowerCase() === '#6366f1') {
            localStorage.removeItem('pending_agency_settings');
          } else {
            await api.updateAgencySettings(pending);
          auth.currentUser = {
            ...auth.currentUser,
            agencyName: pending.name,
            agencySlogan: pending.slogan,
            agencyLogo: pending.logo_url,
            agencyLogoDark: pending.logo_dark_url,
            theme_config: pending.theme_config,
            planning_month: pending.planning_month,
            deadline_pre: pending.deadline_pre,
            deadline_final: pending.deadline_final
          };
          localStorage.removeItem('pending_agency_settings');
          }
        } catch (syncError) {
          console.error('Não foi possível sincronizar o Brand System pendente:', syncError);
        }
      }
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
