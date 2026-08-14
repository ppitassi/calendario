import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { useUICopy } from "../contexts/UICopyContext";
import styles from './EditableText.module.css';

export function EditableText({ id, defaultText, as: Component = 'span', className }: { id: string, defaultText: string, as?: any, className?: string }) {
  const { isEditMode, copy, updateCopy } = useUICopy();
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState('');
  
  const currentText = copy[id] || defaultText;

  if (isEditMode) {
    if (isEditing) {
      return (<>
        {/* style-architecture-exception: inline editor must inherit the surrounding text metrics instead of control metrics. */}
        <input 
          autoFocus
          className={cn(styles.input, className)}
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
        /></>
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
        className={cn(className, styles.editable)}
        title="Clique para editar texto"
      >
        {currentText}
      </Component>
    );
  }

  return <Component className={className}>{currentText}</Component>;
}
