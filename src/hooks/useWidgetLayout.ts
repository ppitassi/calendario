import { useEffect, useMemo, useState } from 'react';
import { WidgetLayout } from '../widgets/shared/types';
import { api } from '../lib/api';
import { auth } from '../lib/auth';

const normalize = (input: WidgetLayout[], defaults: WidgetLayout[]) => {
  const valid = new Map(defaults.map(x => [x.id, x]));
  const seen = new Set<string>();
  const out: WidgetLayout[] = [];
  input.forEach((raw, index) => {
    const base = valid.get(raw.id);
    if (!base || seen.has(raw.id)) return;
    seen.add(raw.id);
    const legacyWidth = raw.w || base.w || 6;
    const size = raw.size || (legacyWidth <= 4 ? 'compact' : legacyWidth >= 8 ? 'wide' : 'medium');
    out.push({
      ...base,
      ...raw,
      position: raw.position ?? index,
      size: ['compact', 'medium', 'wide'].includes(size) ? size : 'medium',
      isHidden: Boolean(raw.isHidden)
    });
  });
  defaults.forEach(base => {
    if (!seen.has(base.id)) out.push({ ...base, position: out.length, size: base.size || 'medium' });
  });
  return out.sort((a, b) => (a.position || 0) - (b.position || 0)).map((x, i) => ({ ...x, position: i }));
};

export function useWidgetLayout(userId: string, defaultLayouts: WidgetLayout[]) {
  const defaults = useMemo(() => normalize(defaultLayouts, defaultLayouts), [defaultLayouts]);
  const [layouts, setLayouts] = useState<WidgetLayout[]>(defaults);
  const [draft, setDraft] = useState<WidgetLayout[]>(defaults);
  const [version, setVersion] = useState(1);

  useEffect(() => {
    let active = true;
    api.getDashboardLayout()
      .then(res => {
        if (!active) return;
        const saved = res.layoutJson;
        const next = normalize(Array.isArray(saved) ? saved : auth.currentUser?.ui_preferences?.widgetLayouts?.[userId] || defaults, defaults);
        setLayouts(next);
        setDraft(next);
        if (res.layoutVersion) setVersion(res.layoutVersion);
      })
      .catch(() => {
        if (!active) return;
        const saved = auth.currentUser?.ui_preferences?.widgetLayouts?.[userId];
        const next = normalize(Array.isArray(saved) ? saved : defaults, defaults);
        setLayouts(next);
        setDraft(next);
      });
    return () => { active = false; };
  }, [userId, defaults]);

  const begin = () => setDraft(layouts.map(x => ({ ...x })));
  const cancel = () => setDraft(layouts.map(x => ({ ...x })));

  const save = async () => {
    const next = normalize(draft, defaults);
    const result = await api.saveDashboardLayout(next, version);
    if (result.layoutVersion) setVersion(result.layoutVersion);
    setLayouts(next);
    setDraft(next);
  };

  const reset = () => setDraft(defaults.map(x => ({ ...x })));

  return { layouts, draft, setDraft, begin, cancel, save, reset, version };
}



