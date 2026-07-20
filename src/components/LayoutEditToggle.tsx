import React from 'react';
import { PenTool } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, useAuthState } from '../lib/auth';
import { useUICopy } from "../contexts/UICopyContext";

export function LayoutEditToggle() {
  const { isEditMode, setIsEditMode } = useUICopy();
  const [user] = useAuthState(auth);
  
  if (!user || user.uid !== 'admin_local') return null;

  return (
    <button
      onClick={() => setIsEditMode(!isEditMode)}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase  transition-all",
        isEditMode ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/30" : "bg-black/5 dark:bg-white/10 opacity-50 hover:opacity-100"
      )}
      title="Ativar Modo de Edição do Layout"
    >
      <PenTool className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{isEditMode ? 'Editando Layout' : 'Editar Layout'}</span>
    </button>
  );
}
