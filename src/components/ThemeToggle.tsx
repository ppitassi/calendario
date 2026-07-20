import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import { cn } from '../lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex bg-black/5 dark:bg-white/10 rounded-full p-1 backdrop-blur-md border border-black/10 dark:border-white/10">
      <button 
        onClick={() => setTheme('light')} 
        className={cn("p-2 rounded-full transition-all duration-300", theme === 'light' ? "bg-primary text-white shadow-lg shadow-primary/20" : "opacity-50 hover:opacity-100")}
        aria-label="Modo Claro"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button 
        onClick={() => setTheme('dark')} 
        className={cn("p-2 rounded-full transition-all duration-300", theme === 'dark' ? "bg-primary text-white shadow-lg shadow-primary/20" : "opacity-50 hover:opacity-100")}
        aria-label="Modo Escuro"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}
