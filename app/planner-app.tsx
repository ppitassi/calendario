'use client';

import { useEffect, useState } from 'react';
import { OfflineScreen } from '../src/components/OfflineScreen';
import { ThemeProvider } from '../src/components/ThemeProvider';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { UICopyProvider } from '../src/contexts/UICopyContext';
import { auth, useAuthState } from '../src/lib/auth';
import { PlannerScreen } from '../src/screens/PlannerScreen';
import { api } from '../src/lib/api';

export default function PlannerApp() {
  const [user, loading] = useAuthState(auth);
  const [isServerOffline, setIsServerOffline] = useState(false);

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
    const interval = window.setInterval(checkServer, 5000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  if (loading) return null;

  return (
    <ThemeProvider
      themeConfig={user?.theme_config}
      defaultTheme={user?.ui_preferences?.theme || 'system'}
    >
      <UICopyProvider>
        <NotificationProvider>
          {isServerOffline && <OfflineScreen />}
          <PlannerScreen />
        </NotificationProvider>
      </UICopyProvider>
    </ThemeProvider>
  );
}
