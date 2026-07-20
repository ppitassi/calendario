import React, { useRef, useState } from 'react';
import { motion, useDragControls, PanInfo } from 'motion/react';
import { LucideIcon, Minus, Move } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WidgetLayout } from './types';

interface WidgetBaseProps {
  layout: WidgetLayout;
  title: string;
  icon: LucideIcon;
  colorClass: string;
  children: React.ReactNode;
  onLayoutChange: (id: string, updates: Partial<WidgetLayout>) => void;
  onHide: (id: string) => void;
  gridSize: { colWidth: number; rowHeight: number; gap: number };
  isEditing?: boolean;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onDragProgress?: (id: string, coords: { x: number; y: number; w: number; h: number } | null) => void;
}

export const WidgetBase: React.FC<WidgetBaseProps> = ({
  layout,
  title,
  icon: Icon,
  colorClass,
  children,
  onLayoutChange,
  onHide,
  gridSize,
  isEditing = true, // Default to true for always-on Wix/Squarespace editing
  onInteractionStart,
  onInteractionEnd,
  onDragProgress
}) => {
  const dragControls = useDragControls();
  
  // Interaction states for dynamic visual highlights in the agency's primary color
  const [activeHandle, setActiveHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [initialLayout, setInitialLayout] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const resizePreviewRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Calculate pixel dimensions based on grid units
  const width = layout.w * gridSize.colWidth + (layout.w - 1) * gridSize.gap;
  const height = layout.h * gridSize.rowHeight + (layout.h - 1) * gridSize.gap;
  const left = layout.x * (gridSize.colWidth + gridSize.gap);
  const top = layout.y * (gridSize.rowHeight + gridSize.gap);

  // Drag handlers
  const handleDragStart = () => {
    setIsDragging(true);
    onInteractionStart?.();
    onDragProgress?.(layout.id, { x: layout.x, y: layout.y, w: layout.w, h: layout.h });
  };

  const handleDrag = (_: any, info: PanInfo) => {
    let snapX = Math.round((left + info.offset.x) / (gridSize.colWidth + gridSize.gap));
    let snapY = Math.round((top + info.offset.y) / (gridSize.rowHeight + gridSize.gap));
    snapX = Math.max(0, Math.min(12 - layout.w, snapX));
    snapY = Math.max(0, snapY);
    onDragProgress?.(layout.id, { x: snapX, y: snapY, w: layout.w, h: layout.h });
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false);
    onInteractionEnd?.();
    onDragProgress?.(layout.id, null);

    const newX = Math.round((left + info.offset.x) / (gridSize.colWidth + gridSize.gap));
    const newY = Math.round((top + info.offset.y) / (gridSize.rowHeight + gridSize.gap));
    
    onLayoutChange(layout.id, { 
      x: Math.max(0, Math.min(12 - layout.w, newX)), 
      y: Math.max(0, newY) 
    });
  };

  const handleResizeStart = (corner: 'tl' | 'tr' | 'bl' | 'br') => {
    setActiveHandle(corner);
    const initialCoords = {
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h
    };
    setInitialLayout(initialCoords);
    resizePreviewRef.current = initialCoords;
    onInteractionStart?.();
    onDragProgress?.(layout.id, initialCoords);
  };

  const handleResizePan = (_: any, info: PanInfo) => {
    if (!initialLayout || !activeHandle) return;

    const startX = initialLayout.x;
    const startY = initialLayout.y;
    const startW = initialLayout.w;
    const startH = initialLayout.h;

    let nextX = startX;
    let nextY = startY;
    let nextW = startW;
    let nextH = startH;

    const deltaX = Math.round(info.offset.x / (gridSize.colWidth + gridSize.gap));
    const deltaY = Math.round(info.offset.y / (gridSize.rowHeight + gridSize.gap));

    if (activeHandle === 'br') {
      nextW = Math.max(1, startW + deltaX);
      nextH = Math.max(1, startH + deltaY);
    } else if (activeHandle === 'bl') {
      const targetX = Math.max(0, startX + deltaX);
      nextW = Math.max(1, (startX + startW) - targetX);
      nextX = (startX + startW) - nextW;
      nextH = Math.max(1, startH + deltaY);
    } else if (activeHandle === 'tr') {
      nextW = Math.max(1, startW + deltaX);
      const targetY = Math.max(0, startY + deltaY);
      nextH = Math.max(1, (startY + startH) - targetY);
      nextY = (startY + startH) - nextH;
    } else if (activeHandle === 'tl') {
      const targetX = Math.max(0, startX + deltaX);
      nextW = Math.max(1, (startX + startW) - targetX);
      nextX = (startX + startW) - nextW;

      const targetY = Math.max(0, startY + deltaY);
      nextH = Math.max(1, (startY + startH) - targetY);
      nextY = (startY + startH) - nextH;
    }

    // Report dynamic snapping preview
    const nextLayout = { x: nextX, y: nextY, w: nextW, h: nextH };
    resizePreviewRef.current = nextLayout;
    onDragProgress?.(layout.id, nextLayout);
  };

  const handleResizeEnd = () => {
    if (resizePreviewRef.current && activeHandle) {
      onLayoutChange(layout.id, {
        x: resizePreviewRef.current.x,
        y: resizePreviewRef.current.y,
        w: resizePreviewRef.current.w,
        h: resizePreviewRef.current.h
      });
    }
    resizePreviewRef.current = null;
    setActiveHandle(null);
    setInitialLayout(null);
    onInteractionEnd?.();
    onDragProgress?.(layout.id, null);
  };

  const isInteracting = isDragging || activeHandle !== null;

  return (
    <motion.div
      layout
      initial={false}
      animate={{ 
        x: left, 
        y: top, 
        width, 
        height,
        zIndex: isInteracting ? 50 : layout.zIndex,
        boxShadow: isInteracting ? '0 0 35px var(--color-primary)' : '0 10px 30px -10px rgba(0,0,0,0.1)',
        borderColor: isInteracting ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)'
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag={isEditing}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className={cn(
        "absolute glass rounded-[2.5rem] border flex flex-col backdrop-blur-3xl overflow-hidden group transition-colors duration-300 select-none",
        layout.isHidden && "hidden"
      )}
    >
      {/* Header / Drag Handle */}
      <div 
        className={cn(
          "flex items-center justify-between p-6 border-b border-white/5 select-none",
          isEditing ? "cursor-grab active:cursor-grabbing hover:bg-white/[0.02]" : "cursor-default"
        )}
        onPointerDown={(e) => isEditing && dragControls.start(e)}
      >
        <div className="flex items-center gap-4">
          <div className={cn("p-3 rounded-2xl", colorClass)}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider opacity-80">{title}</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {isEditing && (
            <button 
              onClick={() => onHide(layout.id)}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-500 transition-all"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}
          {isEditing ? <Move className="w-4 h-4 opacity-40 text-primary animate-pulse" /> : <div className="w-4" />}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 no-scrollbar">
        {children}
      </div>

      {/* 4-Corner Resizers (Visible only when hovered or during interaction in edit mode) */}
      {isEditing && (
        <>
          {/* Dashboard Premium Outline */}
          <div className={cn(
            "absolute inset-0 rounded-[2.5rem] border-2 border-dashed pointer-events-none z-40 transition-all duration-300",
            isInteracting 
              ? "border-[var(--color-primary)] shadow-[0_0_20px_rgba(var(--color-primary),0.25)]" 
              : "border-[var(--color-primary)]/20 group-hover:border-[var(--color-primary)]/50"
          )} />

          {/* Top-Left Resize Zone */}
          <motion.div
            onPanStart={() => handleResizeStart('tl')}
            onPan={handleResizePan}
            onPanEnd={handleResizeEnd}
            className="absolute top-0 left-0 w-8 h-8 cursor-nwse-resize z-50"
          />

          {/* Top-Right Resize Zone */}
          <motion.div
            onPanStart={() => handleResizeStart('tr')}
            onPan={handleResizePan}
            onPanEnd={handleResizeEnd}
            className="absolute top-0 right-0 w-8 h-8 cursor-nesw-resize z-50"
          />

          {/* Bottom-Left Resize Zone */}
          <motion.div
            onPanStart={() => handleResizeStart('bl')}
            onPan={handleResizePan}
            onPanEnd={handleResizeEnd}
            className="absolute bottom-0 left-0 w-8 h-8 cursor-nesw-resize z-50"
          />

          {/* Bottom-Right Resize Zone */}
          <motion.div
            onPanStart={() => handleResizeStart('br')}
            onPan={handleResizePan}
            onPanEnd={handleResizeEnd}
            className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-50"
          />
        </>
      )}
    </motion.div>
  );
};
