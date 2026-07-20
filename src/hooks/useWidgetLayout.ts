import { useState, useEffect } from 'react';
import { WidgetLayout } from '../widgets/shared/types';
import { api } from '../lib/api';
import { auth } from '../lib/auth';

export function useWidgetLayout(userId: string, defaultLayouts: WidgetLayout[]) {
  const [layouts, setLayouts] = useState<WidgetLayout[]>(defaultLayouts);

  useEffect(() => {
    const saved = auth.currentUser?.ui_preferences?.widgetLayouts?.[userId];
    if (Array.isArray(saved)) setLayouts(saved);
  }, [userId]);

  // Always-on layout customization by default for Wix/Squarespace feel
  const isEditing = true;

  const saveLayouts = (newLayouts: WidgetLayout[]) => {
    setLayouts(newLayouts);
    const widgetLayouts = {
      ...(auth.currentUser?.ui_preferences?.widgetLayouts || {}),
      [userId]: newLayouts,
    };
    void api.updateUiPreferences({ widgetLayouts }).catch(() => {});
  };

  return {
    layouts,
    isEditing,
    saveLayouts
  };
}
