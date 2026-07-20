import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WidgetConfig, WidgetLayout } from './types';
import { WidgetBase } from './WidgetBase';
import { ClientData } from '../../types';

interface FlexiGridProps {
  widgets: WidgetConfig[];
  layouts: WidgetLayout[];
  isEditing: boolean;
  onLayoutChange: (layouts: WidgetLayout[]) => void;
  onRestoreWidget: (id: string) => void;
  onOpenAdmin?: () => void;
  onSelectClient?: (client: ClientData, role: string, destination: string) => void;
  currentClient?: ClientData | null;
}

export function FlexiGrid({ 
  widgets, 
  layouts, 
  isEditing = true, 
  onLayoutChange, 
  onRestoreWidget,
  onOpenAdmin,
  onSelectClient,
  currentClient
}: FlexiGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState<{ colWidth: number; rowHeight: number; gap: number }>({ colWidth: 0, rowHeight: 120, gap: 24 });
  
  // Real-time customization states
  const [isInteracting, setIsInteracting] = useState(false);
  const [dragPlaceholder, setDragPlaceholder] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) {
          const colWidth = (width - (gridSize.gap * 11)) / 12;
          setGridSize(prev => ({ ...prev, colWidth }));
        }
      }
    };

    updateSize(); // Initial call
    
    // Use ResizeObserver for reliable width updates during layout transitions
    let observer: ResizeObserver | null = null;
    if (containerRef.current) {
      observer = new ResizeObserver(() => {
        updateSize();
      });
      observer.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      if (observer) observer.disconnect();
    };
  }, [gridSize.gap]);

  const resolveCollisions = (changedId: string, currentLayouts: WidgetLayout[]): WidgetLayout[] => {
    let layoutsCopy = currentLayouts.map(l => {
      if (l.id === changedId) {
        // Keep within 12 columns
        const w = Math.min(12, Math.max(1, l.w));
        let x = Math.max(0, l.x);
        if (x + w > 12) {
          x = 12 - w;
        }
        return { ...l, x, w };
      }
      return l;
    });

    const hasCollision = (a: WidgetLayout, b: WidgetLayout) => {
      if (a.id === b.id || a.isHidden || b.isHidden) return false;
      return !(
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y
      );
    };

    let hasOverlaps = true;
    let iterations = 0;
    
    while (hasOverlaps && iterations < 50) {
      hasOverlaps = false;
      for (let i = 0; i < layoutsCopy.length; i++) {
        for (let j = 0; j < layoutsCopy.length; j++) {
          if (i === j) continue;
          const itemA = layoutsCopy[i];
          const itemB = layoutsCopy[j];
          if (hasCollision(itemA, itemB)) {
            hasOverlaps = true;
            // Push the one that wasn't the active user-moved one down
            if (itemB.id === changedId) {
              layoutsCopy[i] = { ...itemA, y: itemB.y + itemB.h };
            } else {
              layoutsCopy[j] = { ...itemB, y: itemA.y + itemA.h };
            }
          }
        }
      }
      iterations++;
    }
    return layoutsCopy;
  };

  const handleWidgetLayoutChange = (id: string, updates: Partial<WidgetLayout>) => {
    const updated = layouts.map(l => l.id === id ? { ...l, ...updates } : l);
    const resolved = resolveCollisions(id, updated);
    onLayoutChange(resolved);
  };

  const handleHide = (id: string) => {
    handleWidgetLayoutChange(id, { isHidden: true });
  };

  const visibleLayouts = layouts.filter(l => !l.isHidden);
  const hiddenLayouts = layouts.filter(l => l.isHidden);

  // Dynamically calculate grid height to allow scrolling when dragging down
  let maxY = 0;
  visibleLayouts.forEach(l => {
    if (l.y + l.h > maxY) maxY = l.y + l.h;
  });
  if (dragPlaceholder && dragPlaceholder.y + dragPlaceholder.h > maxY) {
    maxY = dragPlaceholder.y + dragPlaceholder.h;
  }
  // Base 1200px or dynamically tall enough + 4 rows of padding
  const dynamicMinHeight = Math.max(1200, (maxY + 4) * (gridSize.rowHeight + gridSize.gap));

  return (
    <div className="flex-1 flex flex-col relative">
      <div 
        ref={containerRef} 
        className="flex-1 relative m-8"
        style={{ minHeight: `${dynamicMinHeight}px`, transition: 'min-height 0.3s ease-out' }}
      >
        {/* Visual Snapping Cartesian Grid (Fades in only while dragging or resizing) */}
        <AnimatePresence>
          {isInteracting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 grid grid-cols-12 pointer-events-none z-0" 
              style={{ 
                gap: `${gridSize.gap}px`,
                gridAutoRows: `${gridSize.rowHeight}px`
              }}
            >
              {Array.from({ length: 120 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-full border border-dashed border-[var(--color-primary)]/[0.04] bg-[var(--color-primary)]/[0.001] rounded-[2rem] transition-colors duration-300"
                  style={{ height: `${gridSize.rowHeight}px` }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snapping Previsualisation (Ghost Outline Placeholder) */}
        <AnimatePresence>
          {dragPlaceholder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 0.35,
                left: dragPlaceholder.x * (gridSize.colWidth + gridSize.gap),
                top: dragPlaceholder.y * (gridSize.rowHeight + gridSize.gap),
                width: dragPlaceholder.w * gridSize.colWidth + (dragPlaceholder.w - 1) * gridSize.gap,
                height: dragPlaceholder.h * gridSize.rowHeight + (dragPlaceholder.h - 1) * gridSize.gap
              }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              className="absolute border-3 border-dashed border-[var(--color-primary)] bg-[var(--color-primary)]/10 rounded-[2.5rem] shadow-[0_0_20px_rgba(var(--color-primary),0.3)] pointer-events-none z-30"
            />
          )}
        </AnimatePresence>

        {/* Draggable Widgets */}
        <AnimatePresence>
          {visibleLayouts.map(layout => {
            const config = widgets.find(w => w.id === layout.id);
            if (!config) return null;
            const Component = config.component;

            return (
              <WidgetBase
                key={layout.id}
                layout={layout}
                title={config.title}
                icon={config.icon}
                colorClass={config.colorClass}
                gridSize={gridSize}
                isEditing={isEditing}
                onLayoutChange={handleWidgetLayoutChange}
                onHide={handleHide}
                onInteractionStart={() => setIsInteracting(true)}
                onInteractionEnd={() => setIsInteracting(false)}
                onDragProgress={(id, coords) => setDragPlaceholder(coords ? { id, ...coords } : null)}
              >
                <Component 
                  onOpenAdmin={onOpenAdmin}
                  onSelectClient={onSelectClient}
                  currentClient={currentClient}
                />
              </WidgetBase>
            );
          })}
        </AnimatePresence>
      </div>

      {/* DOCK FOR MINIMIZED WIDGETS */}
      <AnimatePresence>
        {hiddenLayouts.length > 0 && (
          <motion.footer
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110]"
          >
            <div className="glass px-6 py-4 rounded-[2rem] shadow-3xl border border-white/20 flex items-center gap-4 backdrop-blur-3xl">
              <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                <Layout className="w-4 h-4 opacity-40 text-primary" />
                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest">Minimizados</span>
              </div>
              <div className="flex items-center gap-3">
                {hiddenLayouts.map(layout => {
                  const config = widgets.find(w => w.id === layout.id);
                  if (!config) return null;
                  const Icon = config.icon;
                  return (
                    <button
                      key={layout.id}
                      onClick={() => onRestoreWidget(layout.id)}
                      className="group relative p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary/40 transition-all active:scale-90"
                      title={`Restaurar ${config.title}`}
                    >
                      <Icon className="w-4 h-4" />
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-black/80 text-[8px] font-black uppercase text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none backdrop-blur-md">
                        {config.title}
                      </div>
                    </button>
                  );
                })}
                {isEditing && (
                  <button 
                    onClick={() => hiddenLayouts.forEach(l => onRestoreWidget(l.id))}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all ml-2"
                  >
                    Restaurar Tudo
                  </button>
                )}
              </div>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
