'use client';
import { useEffect, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { Button } from './ui/Button/Button';
import { Checkbox } from './ui/Checkbox/Checkbox';
import styles from './NotificationPreferencesPanel.module.css';

const labels: Record<string, string> = { clients: 'Clientes', posts: 'Postagens e copy', artwork: 'Artes e arquivos', comments: 'Comentários e menções', approvals: 'Aprovações e alterações solicitadas', assignments: 'Responsabilidades e atribuições', calendar: 'Calendários, prazos e agendamentos', integrations: 'Integrações e erros relevantes', security: 'Sistema e segurança' };
type Pref = { category: string; inAppEnabled: boolean; browserPushEnabled: boolean };
const decode = (value: string) => { const pad = '='.repeat((4 - value.length % 4) % 4); const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(char => char.charCodeAt(0))); };

export function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [saving, setSaving] = useState(false);
  const [pushState, setPushState] = useState('Não solicitado');
  const { toast } = useNotifications();

  useEffect(() => {
    void fetch('/api/notifications/preferences').then(response => response.json()).then(data => setPrefs(data.items || []));
    if ('Notification' in window) setPushState(Notification.permission === 'granted' ? 'Permitido' : Notification.permission === 'denied' ? 'Bloqueado' : 'Não solicitado');
  }, []);

  const save = async (next: Pref[]) => {
    setPrefs(next); setSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: next }) });
      if (!response.ok) throw new Error();
      toast('Preferências de notificações salvas.', 'success');
    } catch { toast('Erro ao salvar preferências.', 'error'); } finally { setSaving(false); }
  };

  const enablePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setPushState('Não suportado'); return; }
      if (Notification.permission === 'denied') { setPushState('Bloqueado'); return; }
      const permission = await Notification.requestPermission();
      setPushState(permission === 'granted' ? 'Permitido' : permission === 'denied' ? 'Bloqueado' : 'Não solicitado');
      if (permission !== 'granted') return;
      const registration = await navigator.serviceWorker.register('/notification-sw.js');
      const key = await fetch('/api/notifications/push/public-key').then(response => { if (!response.ok) throw new Error(); return response.json(); });
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decode(key.publicKey) });
      const response = await fetch('/api/notifications/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
      if (!response.ok) throw new Error();
      setPushState('Subscription ativa'); toast('Push ativado neste navegador.', 'success');
    } catch { setPushState('Erro recuperável'); toast('Não foi possível ativar o push.', 'error'); }
  };

  const all = (field: 'inAppEnabled' | 'browserPushEnabled', value: boolean) => void save(prefs.map(pref => ({ ...pref, [field]: value })));

  return <section className={styles.root}>
    <div><h4 className={styles.title}><Bell />Preferências de notificações</h4><p className={styles.description}>Escolha como receber atualizações relacionadas ao seu trabalho.</p></div>
    <div className={styles.actions}><Button size="small" variant="glass" onClick={() => all('inAppEnabled', true)}>Ativar dentro do app</Button><Button size="small" variant="glass" onClick={() => all('inAppEnabled', false)}>Pausar dentro do app</Button><Button size="small" variant="glass" onClick={() => all('browserPushEnabled', true)}>Ativar push</Button><Button size="small" variant="primary" onClick={enablePush}>Ativar notificações neste navegador</Button></div>
    <p className={styles.browserState}>Navegador: {pushState}</p>
    <div className={styles.preferences}>{prefs.map(pref => <div key={pref.category} className={styles.preference}><span className={styles.preferenceLabel}>{labels[pref.category] || pref.category}</span><Checkbox label="In-app" checked={Boolean(pref.inAppEnabled)} onChange={event => void save(prefs.map(item => item.category === pref.category ? { ...item, inAppEnabled: event.target.checked } : item))} /><Checkbox label="Push" checked={Boolean(pref.browserPushEnabled)} onChange={event => void save(prefs.map(item => item.category === pref.category ? { ...item, browserPushEnabled: event.target.checked } : item))} /></div>)}</div>
    <Button disabled={pushState !== 'Subscription ativa' || saving} onClick={() => void fetch('/api/notifications/push/test', { method: 'POST' }).then(response => { if (!response.ok) throw new Error(); toast('Push de teste enviado.', 'success'); }).catch(() => toast('Falha no push de teste.', 'error'))} variant="glass" icon={<Send />}>Enviar push de teste</Button>
  </section>;
}
