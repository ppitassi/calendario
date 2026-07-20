import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface UICopyContextType {
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  copy: Record<string, string>;
  updateCopy: (id: string, text: string) => void;
}

export const UICopyContext = createContext<UICopyContextType>({
  isEditMode: false,
  setIsEditMode: () => {},
  copy: {},
  updateCopy: () => {}
});

export const useUICopy = () => useContext(UICopyContext);

export function UICopyProvider({ children }: { children: React.ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [copy, setCopy] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadCopy = async () => {
      try {
        const data = await api.getSettings('ui_copy');
        if (data) setCopy(data);
      } catch (e) {
        console.error("Failed to load UI copy settings", e);
      }
    };
    loadCopy();
  }, []);

  const updateCopy = async (id: string, text: string) => {
    const newCopy = { ...copy, [id]: text };
    setCopy(newCopy);
    try {
       await api.saveSettings('ui_copy', newCopy);
    } catch (e) {
       console.error("Failed to save UI copy settings", e);
    }
  };

  return (
    <UICopyContext.Provider value={{ isEditMode, setIsEditMode, copy, updateCopy }}>
      {children}
    </UICopyContext.Provider>
  );
}
