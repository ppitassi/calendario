'use client';

import { Component, ReactNode, useEffect, useState } from 'react';
import { OfflineScreen } from '../src/components/OfflineScreen';
import { Button } from '../src/components/ui/Button/Button';
import { ThemeProvider } from '../src/components/ThemeProvider';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { UICopyProvider } from '../src/contexts/UICopyContext';
import { auth, useAuthState } from '../src/lib/auth';
import { PlannerScreen } from '../src/screens/PlannerScreen';
import { api } from '../src/lib/api';
import { AppLoading } from '../src/components/AppStatus';
import { AppNotificationsProvider } from '../src/contexts/AppNotificationsContext';
import { AppFallback } from '../src/components/AppFallback';

const VIEW_STATE_KEY = 'content_planner_view_state';

class PlannerRecoveryBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[planner-interface]', error);
  }

  private returnToDashboard = () => {
    localStorage.removeItem(VIEW_STATE_KEY);
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <AppFallback title="O Planejador de Calendários encontrou um erro" message="Seus posts e clientes continuam salvos. Volte ao Dashboard para restaurar somente a navegação da interface." actions={<><Button onClick={this.returnToDashboard} variant="primary">Voltar ao Dashboard</Button><Button onClick={() => this.setState({ error: null })} variant="ghost">Tentar novamente</Button></>} details={<details><summary>Detalhes técnicos</summary><code>{this.state.error.message}</code></details>} />;
  }
}

export default function PlannerApp() {
  const [user, loading] = useAuthState(auth);
  const [isServerOffline, setIsServerOffline] = useState(false);
  const [pendingBrandSettings, setPendingBrandSettings] = useState<any>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('recover') === '1') {
      localStorage.removeItem(VIEW_STATE_KEY);
      url.searchParams.delete('recover');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    try {
      const pending = localStorage.getItem('pending_agency_settings');
      const parsed = pending ? JSON.parse(pending) : null;
      if (String(parsed?.theme_config?.primary || '').toLowerCase() === '#6366f1') {
        localStorage.removeItem('pending_agency_settings');
        setPendingBrandSettings(null);
      } else {
        setPendingBrandSettings(parsed);
      }
    } catch {
      setPendingBrandSettings(null);
    }
  }, []);

  useEffect(() => {
    if (!user || !pendingBrandSettings) return;
    let cancelled = false;
    void api.updateAgencySettings(pendingBrandSettings)
      .then(() => {
        if (cancelled) return;
        auth.currentUser = {
          ...auth.currentUser,
          agencyName: pendingBrandSettings.name,
          agencySlogan: pendingBrandSettings.slogan,
          agencyLogo: pendingBrandSettings.logo_url,
          agencyLogoDark: pendingBrandSettings.logo_dark_url,
          theme_config: pendingBrandSettings.theme_config,
          planning_month: pendingBrandSettings.planning_month,
          deadline_pre: pendingBrandSettings.deadline_pre,
          deadline_final: pendingBrandSettings.deadline_final
        };
        localStorage.removeItem('pending_agency_settings');
        setPendingBrandSettings(null);
      })
      .catch(() => {
        // A configuração permanece na fila local e será reenviada no próximo acesso.
      });
    return () => { cancelled = true; };
  }, [user, pendingBrandSettings]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      'density-compact',
      user?.ui_preferences?.density === 'compact',
    );
  }, [user?.ui_preferences?.density]);

  useEffect(() => {
    if (!user) return;
    let active = document.visibilityState === 'visible' && document.hasFocus();
    let activeSince = active ? Date.now() : 0;
    let pendingSeconds = 0;

    const accountUntilNow = () => {
      if (active && activeSince) pendingSeconds += Math.max(0, Math.floor((Date.now() - activeSince) / 1000));
      activeSince = active ? Date.now() : 0;
    };
    const updateFocus = () => {
      accountUntilNow();
      active = document.visibilityState === 'visible' && document.hasFocus();
      activeSince = active ? Date.now() : 0;
    };
    const flush = () => {
      accountUntilNow();
      const seconds = pendingSeconds;
      pendingSeconds = 0;
      if (seconds > 0) void api.recordActivity(seconds).catch(() => { pendingSeconds += seconds; });
    };

    document.addEventListener('visibilitychange', updateFocus);
    window.addEventListener('focus', updateFocus);
    window.addEventListener('blur', updateFocus);
    const interval = window.setInterval(flush, 30_000);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', updateFocus);
      window.removeEventListener('focus', updateFocus);
      window.removeEventListener('blur', updateFocus);
      window.clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const checkServer = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        if (mounted) setIsServerOffline(!response.ok);
      } catch {
        if (mounted) setIsServerOffline(true);
      }
    };

    void checkServer();
    const interval = window.setInterval(checkServer, 30_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  if (loading) return <AppLoading label="Validando sessão" />;

  return (
    <ThemeProvider
      themeConfig={pendingBrandSettings?.theme_config || user?.theme_config}
      defaultTheme={user?.ui_preferences?.theme || 'system'}
    >
      <UICopyProvider>
        <NotificationProvider>
          <AppNotificationsProvider>
            {isServerOffline && <OfflineScreen />}
            <PlannerRecoveryBoundary>
              <PlannerScreen />
            </PlannerRecoveryBoundary>
          </AppNotificationsProvider>
        </NotificationProvider>
      </UICopyProvider>
    </ThemeProvider>
  );
}
