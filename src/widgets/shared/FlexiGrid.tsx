import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { WidgetConfig, WidgetLayout, WidgetSize } from './types';
import { WidgetBase } from './WidgetBase';
import { cn } from '../../lib/utils';
import styles from '../dashboard/Dashboard.module.css';

type PointerSession = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  started: boolean;
  original: WidgetLayout[];
  lastTarget: string | null;
};

export function FlexiGrid({
  widgets,
  layouts,
  isEditing,
  onLayoutChange,
  onOpenAdmin,
  onSelectClient,
  currentClient,
  dashboardData,
  onOpenProduction,
  onOpenPost
}: {
  widgets: WidgetConfig[];
  layouts: WidgetLayout[];
  isEditing: boolean;
  onLayoutChange: (layouts: WidgetLayout[]) => void;
  onOpenAdmin?: () => void;
  onSelectClient?: any;
  currentClient?: any;
  dashboardData?: any;
  onOpenProduction?: any;
  onOpenPost?: any;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [keyboardMoving, setKeyboardMoving] = useState<string | null>(null);
  const live = useRef<HTMLDivElement>(null);
  const pointerSession = useRef<PointerSession | null>(null);
  const keyboardOriginal = useRef<WidgetLayout[] | null>(null);
  const layoutsRef = useRef(layouts);
  layoutsRef.current = layouts;

  const visible = useMemo(
    () => layouts
      .filter(item => !item.isHidden && widgets.some(widget => widget.id === item.id))
      .sort((a, b) => (a.position || 0) - (b.position || 0)),
    [layouts, widgets]
  );

  const commitOrder = (orderedVisible: WidgetLayout[]) => {
    const hidden = layoutsRef.current.filter(item => item.isHidden);
    onLayoutChange([...orderedVisible, ...hidden].map((item, index) => ({ ...item, position: index })));
  };

  const reorderToIndex = (id: string, targetIndex: number) => {
    const ordered = layoutsRef.current
      .filter(item => !item.isHidden && widgets.some(widget => widget.id === item.id))
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    const from = ordered.findIndex(item => item.id === id);
    const to = Math.max(0, Math.min(ordered.length - 1, targetIndex));
    if (from < 0 || from === to) return false;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    commitOrder(ordered);
    if (live.current) live.current.textContent = `Widget ${widgets.find(widget => widget.id === id)?.title || id} movido para a posição ${to + 1}.`;
    return true;
  };

  const moveBy = (id: string, direction: -1 | 1) => {
    const ordered = layoutsRef.current
      .filter(item => !item.isHidden && widgets.some(widget => widget.id === item.id))
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    const index = ordered.findIndex(item => item.id === id);
    reorderToIndex(id, index + direction);
  };

  const clearPointerSession = (restore = false) => {
    const session = pointerSession.current;
    if (restore && session?.started) onLayoutChange(session.original.map(item => ({ ...item })));
    pointerSession.current = null;
    setDragged(null);
  };

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = pointerSession.current;
      if (!session || event.pointerId !== session.pointerId) return;
      const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
      if (!session.started) {
        if (distance < 8) return;
        session.started = true;
        setDragged(session.id);
      }
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-widget-id]');
      const targetId = target?.dataset.widgetId;
      if (!targetId || targetId === session.id || targetId === session.lastTarget) return;
      session.lastTarget = targetId;
      const ordered = layoutsRef.current
        .filter(item => !item.isHidden && widgets.some(widget => widget.id === item.id))
        .sort((a, b) => (a.position || 0) - (b.position || 0));
      reorderToIndex(session.id, ordered.findIndex(item => item.id === targetId));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pointerSession.current?.pointerId === event.pointerId) clearPointerSession(false);
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (pointerSession.current?.pointerId === event.pointerId) clearPointerSession(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pointerSession.current?.started) {
        event.preventDefault();
        clearPointerSession(true);
      }
    };
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [widgets]);

  const keyboardHandler = (id: string) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (keyboardMoving === id) {
        setKeyboardMoving(null);
        keyboardOriginal.current = null;
        if (live.current) live.current.textContent = 'Nova posição confirmada.';
      } else {
        keyboardOriginal.current = layoutsRef.current.map(item => ({ ...item }));
        setKeyboardMoving(id);
        if (live.current) live.current.textContent = 'Modo de movimentação iniciado. Use as setas e confirme com Enter ou Espaço.';
      }
      return;
    }
    if (event.key === 'Escape' && keyboardMoving === id) {
      event.preventDefault();
      if (keyboardOriginal.current) onLayoutChange(keyboardOriginal.current.map(item => ({ ...item })));
      keyboardOriginal.current = null;
      setKeyboardMoving(null);
      if (live.current) live.current.textContent = 'Movimentação cancelada; posição anterior restaurada.';
      return;
    }
    if (keyboardMoving !== id) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveBy(id, -1);
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveBy(id, 1);
    }
  };

  return (
    <>
      <div ref={live} className="sr-only" aria-live="polite" />
      <div className={styles.grid}>
        {visible.map(layout => {
          const config = widgets.find(widget => widget.id === layout.id)!;
          const Component = config.component;
          return (
            <motion.div
              layout
              key={layout.id}
              data-widget-id={layout.id}
              data-size={layout.size || config.defaultSize || 'medium'}
              className={cn(dragged === layout.id && 'opacity-55')}
            >
              <WidgetBase
                layout={layout}
                config={config}
                isEditing={isEditing}
                onMove={direction => moveBy(layout.id, direction)}
                onRemove={() => onLayoutChange(layouts.map(item => item.id === layout.id ? { ...item, isHidden: true } : item))}
                onSize={(size: WidgetSize) => onLayoutChange(layouts.map(item => item.id === layout.id ? { ...item, size } : item))}
                dragProps={{
                  'aria-pressed': keyboardMoving === layout.id,
                  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
                    if (!isEditing || event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    pointerSession.current = {
                      id: layout.id,
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startY: event.clientY,
                      started: false,
                      original: layoutsRef.current.map(item => ({ ...item })),
                      lastTarget: null
                    };
                  },
                  onKeyDown: keyboardHandler(layout.id)
                }}
              >
                <Component
                  onOpenAdmin={onOpenAdmin}
                  onSelectClient={onSelectClient}
                  currentClient={currentClient}
                  dashboardData={dashboardData}
                  onOpenProduction={onOpenProduction}
                  onOpenDetails={onOpenProduction}
                  onOpenPost={onOpenPost}
                />
              </WidgetBase>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
