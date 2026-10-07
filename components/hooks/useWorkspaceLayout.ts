"use client";
/**
 * Hook para determinar o modo de layout responsivo do Editor V2.
 * Mede o contêiner disponível via ResizeObserver.
 * - Social Media: se container >= 1440px -> 'split', senão -> 'focus'
 * - Designer: se container >= 1120px -> 'split', senão -> 'drawer'
 */

import { useState, useEffect, type RefObject } from "react";

export interface WorkspaceLayoutPolicy {
  containerWidth: number;
  canSplitSocial: boolean;   // containerWidth >= 1440
  canSplitDesigner: boolean; // containerWidth >= 1120
  isCompactHeight: boolean;  // windowHeight < 800
}

export function useWorkspaceLayout(containerRef: RefObject<HTMLElement | null>): WorkspaceLayoutPolicy {
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth;
    }
    return 1920;
  });

  const [isCompactHeight, setIsCompactHeight] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerHeight < 800;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        setIsCompactHeight(window.innerHeight < 800);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          if (cr.width > 0) {
            setContainerWidth(Math.round(cr.width));
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      setContainerWidth(el.getBoundingClientRect().width);
    }
  }, [containerRef]);

  return {
    containerWidth,
    canSplitSocial: containerWidth >= 1440,
    canSplitDesigner: containerWidth >= 1120,
    isCompactHeight,
  };
}
