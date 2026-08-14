import React from 'react';
import { GripVertical, Minus, MoveDown, MoveUp } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';
import { IconButton } from '../../components/ui/IconButton/IconButton';
import { cn } from '../../lib/utils';
import styles from '../dashboard/Dashboard.module.css';
import { WidgetConfig, WidgetLayout, WidgetSize } from './types';

export function WidgetBase({
  layout,
  config,
  isEditing,
  onRemove,
  onSize,
  onMove,
  children,
  dragProps
}: {
  layout: WidgetLayout;
  config: WidgetConfig;
  isEditing: boolean;
  onRemove: () => void;
  onSize: (size: WidgetSize) => void;
  onMove: (direction: -1 | 1) => void;
  children: React.ReactNode;
  dragProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  const Icon = config.icon;

  return (
    <section className={cn(styles.widget, 'glass-card min-w-0', isEditing && styles.widgetEditing)}>
      <header className={styles.widgetHeader}>
        <span className={styles.widgetIcon}><Icon aria-hidden="true" /></span>
        <div className={styles.widgetTitle}>
          <h3>{config.title}</h3>
          {isEditing && <p>{config.description}</p>}
        </div>
        {isEditing && (
          <div className={styles.widgetActions}>
            <IconButton className={styles.mobileOrder} onClick={() => onMove(-1)} label={`Mover ${config.title} para cima`}><MoveUp /></IconButton>
            <IconButton className={styles.mobileOrder} onClick={() => onMove(1)} label={`Mover ${config.title} para baixo`}><MoveDown /></IconButton>
            {config.removable !== false && (
              <IconButton onClick={onRemove} title="Remover da dashboard" label={`Remover ${config.title}`} variant="danger"><Minus /></IconButton>
            )}
            <IconButton {...dragProps} label={`Mover widget ${config.title}`} title="Arrastar widget" className={styles.dragHandle}><GripVertical /></IconButton>
          </div>
        )}
      </header>
      {isEditing && (
        <div className={styles.widgetSizes}>
          {config.allowedSizes?.map(size => (
            <Button key={size} onClick={() => onSize(size)} size="small" variant={layout.size === size ? 'primary' : 'ghost'}>
              {size === 'compact' ? 'Compacto' : size === 'medium' ? 'Médio' : 'Largo'}
            </Button>
          ))}
        </div>
      )}
      <div className={styles.widgetContent}>{children}</div>
    </section>
  );
}
