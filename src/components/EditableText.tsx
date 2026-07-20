import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { useUICopy } from "../contexts/UICopyContext";

export function EditableText({ id, defaultText, as: Component = 'span', className }: { id: string, defaultText: string, as?: any, className?: string }) {
  const { isEditMode, copy, updateCopy } = useUICopy();
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState('');
  
  const currentText = copy[id] || defaultText;

  if (isEditMode) {
    if (isEditing) {
      return (
        <input 
          autoFocus
          className={cn("bg-transparent outline-none border-b-2 border-[var(--color-primary)] w-full font-inherit text-inherit", className)}
          value={tempText}
          onChange={(e) => setTempText(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            if (tempText !== currentText) {
              updateCopy(id, tempText);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLElement).blur();
            }
          }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        />
      );
    }

    return (
      <Component 
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setTempText(currentText);
          setIsEditing(true);
        }}
        className={cn(className, "cursor-pointer border-b-2 border-dashed border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors inline-block")}
        title="Clique para editar texto"
      >
        {currentText}
      </Component>
    );
  }

  return <Component className={className}>{currentText}</Component>;
}
