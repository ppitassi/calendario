import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  themeConfig?: any;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  themeConfig: any;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  isDark: false,
  themeConfig: null
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  themeConfig = null,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => setTheme(defaultTheme), [defaultTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = systemDark ? 'dark' : 'light';

      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme, systemDark]);

  // Injeção de variáveis de marca
  useEffect(() => {
    const root = window.document.documentElement;
    root.style.removeProperty('--tenant-primary');
    root.style.removeProperty('--background-override');
    root.style.removeProperty('--surface-override');
    root.style.removeProperty('--glass-bg');
    if (themeConfig) {
      try {
        const config = typeof themeConfig === 'string' ? JSON.parse(themeConfig) : themeConfig;

        // Detecta o modo atual (claro ou escuro) usando o estado do tema
        const isDark = theme === 'dark' || (theme === 'system' && systemDark);
        const modeConfig = isDark ? config.dark : config.light;

        // Determina a cor primária final (Prioridade para a Global que é a editável)
        const finalPrimary = config.primary || config.primaryColor || modeConfig?.primary;

        if (finalPrimary) {
          root.style.setProperty('--tenant-primary', finalPrimary);
        }

        if (modeConfig) {
          // Overrides de fundo e superfície
          if (modeConfig.background) root.style.setProperty('--background-override', modeConfig.background);
          if (modeConfig.surface) root.style.setProperty('--surface-override', modeConfig.surface);
          if (modeConfig.glass) root.style.setProperty('--glass-bg', modeConfig.glass);
        }
      } catch (e) {
        console.error("Erro ao aplicar tema da agência", e);
      }
    }
  }, [themeConfig, theme, systemDark]);

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      setTheme(theme);
      void api.updateUiPreferences({ theme }).catch(() => {});
    },
    isDark,
    themeConfig
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

