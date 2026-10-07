"use client";

import { useState, useEffect, useCallback } from "react";

export type ModifierKey = "Ctrl" | "Alt" | "Shift" | "Meta";

export interface HotkeyConfig {
  id: string;
  label: string;
  description: string;
  category: "calendar" | "general" | "editor";
  modifier: ModifierKey;
  key?: string; // para atalhos com letra/tecla (ex: 'k', 'Enter')
  isClickAction?: boolean; // ex: selecionar múltiplo por clique
}

export const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  {
    id: "multi_select_click",
    label: "Seleção múltipla de datas",
    description: "Tecla mantida pressionada ao clicar nos dias do calendário para adicionar/remover da seleção",
    category: "calendar",
    modifier: "Ctrl",
    isClickAction: true,
  },
  {
    id: "range_select_click",
    label: "Seleção de intervalo contínuo",
    description: "Tecla mantida pressionada ao clicar para selecionar todos os dias entre o primeiro e o segundo",
    category: "calendar",
    modifier: "Shift",
    isClickAction: true,
  },
  {
    id: "new_post_shortcut",
    label: "Nova publicação rápida",
    description: "Atalho de teclado para abrir o menu de criação de publicação no dia focado",
    category: "calendar",
    modifier: "Ctrl",
    key: "n",
    isClickAction: false,
  },
  {
    id: "toggle_select_mode",
    label: "Alternar modo de seleção",
    description: "Atalho para ativar ou desativar o modo de seleção em lote",
    category: "calendar",
    modifier: "Ctrl",
    key: "s",
    isClickAction: false,
  },
  {
    id: "toggle_routine",
    label: "Abrir painel de rotina",
    description: "Atalho para abrir ou fechar a configuração de rotina semanal",
    category: "calendar",
    modifier: "Ctrl",
    key: "r",
    isClickAction: false,
  },
];

const STORAGE_KEY = "cp:user-hotkeys:v1";

export function loadHotkeys(): HotkeyConfig[] {
  if (typeof window === "undefined") return DEFAULT_HOTKEYS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HOTKEYS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Mescla com os defaults para garantir novos atalhos
      const map = new Map<string, HotkeyConfig>();
      DEFAULT_HOTKEYS.forEach((d) => map.set(d.id, { ...d }));
      parsed.forEach((p: HotkeyConfig) => {
        if (p && p.id && map.has(p.id)) {
          map.set(p.id, { ...map.get(p.id)!, ...p });
        }
      });
      return Array.from(map.values());
    }
  } catch {}
  return DEFAULT_HOTKEYS;
}

export function saveHotkeys(configs: HotkeyConfig[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    window.dispatchEvent(new CustomEvent("cp:hotkeys-updated", { detail: configs }));
  } catch {}
}

/** Hook para consumir os atalhos atuais com re-render automático caso sejam alterados nas Settings */
export function useHotkeys() {
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>(() => loadHotkeys());

  useEffect(() => {
    const handleUpdate = () => {
      setHotkeys(loadHotkeys());
    };
    window.addEventListener("cp:hotkeys-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cp:hotkeys-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const updateHotkey = useCallback((id: string, updates: Partial<HotkeyConfig>) => {
    setHotkeys((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      saveHotkeys(next);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    saveHotkeys(DEFAULT_HOTKEYS);
    setHotkeys(DEFAULT_HOTKEYS);
  }, []);

  /** Função auxiliar para checar se o evento de clique/teclado satisfaz um hotkey por id */
  const matchesModifier = useCallback(
    (e: React.MouseEvent | MouseEvent | React.KeyboardEvent | KeyboardEvent, hotkeyId: string): boolean => {
      const config = hotkeys.find((h) => h.id === hotkeyId);
      if (!config) return false;
      switch (config.modifier) {
        case "Ctrl":
          return e.ctrlKey;
        case "Alt":
          return e.altKey;
        case "Shift":
          return e.shiftKey;
        case "Meta":
          return e.metaKey;
        default:
          return e.ctrlKey || e.metaKey;
      }
    },
    [hotkeys]
  );

  return {
    hotkeys,
    updateHotkey,
    resetToDefaults,
    matchesModifier,
  };
}
