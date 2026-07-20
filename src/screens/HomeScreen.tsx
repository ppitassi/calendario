import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/MainLayout';
import { FlexiGrid } from '../widgets/shared/FlexiGrid';
import { WidgetConfig, WidgetLayout } from '../widgets/shared/types';
import { 
  Sun, 
  TrendingUp, 
  BarChart3, 
  Users, 
  Plus, 
  Settings,
  Calendar,
  Zap,
  Flame,
  LayoutTemplate,
  Activity,
  Clock,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { ClientData } from '../types';
import { api } from '../lib/api';

// Real Widgets
import { CompanionHubWidget } from '../widgets/dashboard/CompanionHubWidget';
import { ProductionBIWidget } from '../widgets/dashboard/ProductionBIWidget';
import { ClientGridWidget } from '../widgets/dashboard/ClientGridWidget';
import { WorkloadBIWidget } from '../widgets/dashboard/WorkloadBIWidget';
import { ProductivityTrackerWidget } from '../widgets/dashboard/ProductivityTrackerWidget';
import { ClientSetupModal } from '../modals/ClientSetupModal';
import { auth } from '../lib/auth';
import { useWidgetLayout } from '../hooks/useWidgetLayout';
import { cn } from '../lib/utils';

function DashboardCard({
  title,
  icon: Icon,
  colorClass,
  className,
  children,
}: {
  title: string;
  icon: React.ElementType;
  colorClass: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(
      'relative min-w-0 overflow-hidden rounded-[28px] border border-black/[0.07] bg-white shadow-[0_14px_45px_-28px_rgba(15,23,42,0.38)] dark:border-white/[0.09] dark:bg-zinc-900/75',
      className,
    )}>
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <header className="flex h-[72px] items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', colorClass)}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-black tracking-[-0.01em]">{title}</h3>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] opacity-35">Visão geral</p>
          </div>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
      </header>
      <div className="h-[calc(100%-72px)] min-h-0 px-6 pb-6">{children}</div>
    </section>
  );
}

interface HomeScreenProps {
  onSelectClient: (client: ClientData, role: string, destination: string) => void;
  onOpenAdmin: () => void;
  onNavigate: (screen: string) => void;
  currentClient: ClientData | null;
}

export function HomeScreen({ onSelectClient, onOpenAdmin, onNavigate, currentClient }: HomeScreenProps) {
  const defaultLayouts: WidgetLayout[] = [
    { id: 'companion', x: 0, y: 0, w: 4, h: 4, isHidden: false, zIndex: 1 },
    { id: 'production_bi', x: 4, y: 0, w: 8, h: 4, isHidden: false, zIndex: 1 },
    { id: 'workload', x: 0, y: 4, w: 5, h: 4, isHidden: false, zIndex: 1 },
    { id: 'productivity', x: 5, y: 4, w: 3, h: 4, isHidden: false, zIndex: 1 },
    { id: 'client_grid', x: 8, y: 4, w: 4, h: 4, isHidden: false, zIndex: 1 },
  ];

  const { 
    layouts, 
    saveLayouts
  } = useWidgetLayout(auth.currentUser?.uid || 'default', defaultLayouts);

  const [isEditing, setIsEditing] = useState(false);
  const [setupClient, setSetupClient] = useState<ClientData | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSaveClientSetup = async (e: React.FormEvent): Promise<string | null> => {
    e.preventDefault();
    if (!setupClient) return null;
    try {
      const savedId = await api.saveClient(setupClient);
      setSetupClient(null);
      setRefreshTrigger(prev => prev + 1);
      return savedId;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const widgets: WidgetConfig[] = [
    {
      id: 'companion',
      title: 'Companion Hub',
      icon: Sun,
      category: 'COMMUNICATION',
      colorClass: 'bg-amber-500/20 text-amber-500',
      component: CompanionHubWidget,
      defaultLayout: { w: 4, h: 4 }
    },
    {
      id: 'production_bi',
      title: 'Produção em Tempo Real',
      icon: Activity,
      category: 'PRODUCTION',
      colorClass: 'bg-primary/20 text-primary',
      component: ProductionBIWidget,
      defaultLayout: { w: 8, h: 4 }
    },
    {
      id: 'workload',
      title: 'Carga & Eficiência',
      icon: Zap,
      category: 'MANAGEMENT',
      colorClass: 'bg-indigo-500/20 text-indigo-500',
      component: WorkloadBIWidget,
      defaultLayout: { w: 5, h: 4 }
    },
    {
      id: 'productivity',
      title: 'Seu Foco & Performance',
      icon: Flame,
      category: 'PRODUCTIVITY',
      colorClass: 'bg-orange-500/20 text-orange-500',
      component: ProductivityTrackerWidget,
      defaultLayout: { w: 3, h: 4 }
    },
    {
      id: 'client_grid',
      title: 'Carteira de Clientes',
      icon: Users,
      category: 'MANAGEMENT',
      colorClass: 'bg-emerald-500/20 text-emerald-500',
      component: () => <ClientGridWidget 
        onSelectClient={onSelectClient} 
        refreshTrigger={refreshTrigger}
        onNewClient={() => setSetupClient({ 
          id: Math.random().toString(16).slice(2, 8), 
          name: '', 
          socialLinks: {}, 
          owners: [auth.currentUser?.uid || ''] 
        } as ClientData)}
      />,
      defaultLayout: { w: 4, h: 4 }
    }
  ];

  const handleRestoreWidget = (id: string) => {
    const nextLayouts = layouts.map(l => l.id === id ? { ...l, isHidden: false } : l);
    saveLayouts(nextLayouts);
  };

  const formatActiveMonth = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthIndex = parseInt(month, 10) - 1;
    return `${months[monthIndex] || month}/${year}`;
  };

  return (
    <MainLayout 
      activeScreen="home" 
      onNavigate={onNavigate}
      currentClient={currentClient}
    >
      <div className="flex-1 flex flex-col bg-[radial-gradient(circle_at_75%_0%,color-mix(in_srgb,var(--color-primary)_7%,transparent),transparent_32%)]">
        <div className="mx-auto flex w-full max-w-[1800px] justify-end px-6 pb-4 pt-6 xl:px-10">
          <div className="flex flex-wrap items-center gap-2">
             {auth.currentUser?.planning_month && (
               <div className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-2xl text-xs font-bold border border-black/5 dark:border-white/10 text-zinc-700 dark:text-zinc-300">
                 <Calendar className="w-4 h-4 text-primary" />
                 <span>Ciclo: {formatActiveMonth(auth.currentUser.planning_month)}</span>
               </div>
             )}
             {auth.currentUser?.deadline_pre && (
               <div className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-2xl text-xs font-bold border border-black/5 dark:border-white/10 text-zinc-700 dark:text-zinc-300">
                 <Clock className="w-4 h-4 text-amber-500" />
                 <span>Pré: Dia {auth.currentUser.deadline_pre}</span>
               </div>
             )}
             {auth.currentUser?.deadline_final && (
               <div className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-2xl text-xs font-bold border border-black/5 dark:border-white/10 text-zinc-700 dark:text-zinc-300">
                 <Clock className="w-4 h-4 text-red-500 animate-pulse" />
                 <span>Prazo Final: Dia {auth.currentUser.deadline_final}</span>
               </div>
             )}
           </div>
        </div>

        {isEditing ? (
          <FlexiGrid
            widgets={widgets}
            layouts={layouts}
            isEditing
            onLayoutChange={saveLayouts}
            onRestoreWidget={handleRestoreWidget}
            onOpenAdmin={onOpenAdmin}
            onSelectClient={onSelectClient}
            currentClient={currentClient}
          />
        ) : (
          <div className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-5 px-6 pb-12 xl:grid-cols-12 xl:px-10">
            <DashboardCard title="LeIA & contexto" icon={Sun} colorClass="bg-amber-500/12 text-amber-500" className="h-[410px] xl:col-span-5">
              <CompanionHubWidget currentClient={currentClient} />
            </DashboardCard>

            <DashboardCard title="Produção em tempo real" icon={Activity} colorClass="bg-primary/10 text-primary" className="h-[410px] xl:col-span-7">
              <ProductionBIWidget />
            </DashboardCard>

            <DashboardCard title="Carga & eficiência" icon={Zap} colorClass="bg-indigo-500/10 text-indigo-500" className="h-[450px] xl:col-span-5">
              <WorkloadBIWidget />
            </DashboardCard>

            <DashboardCard title="Seu foco & performance" icon={Flame} colorClass="bg-orange-500/10 text-orange-500" className="h-[450px] xl:col-span-3">
              <ProductivityTrackerWidget onOpenAdmin={onOpenAdmin} />
            </DashboardCard>

            <DashboardCard title="Carteira de clientes" icon={Users} colorClass="bg-emerald-500/10 text-emerald-500" className="h-[450px] xl:col-span-4">
              <ClientGridWidget
                onSelectClient={onSelectClient}
                refreshTrigger={refreshTrigger}
                onNewClient={() => setSetupClient({
                  id: Math.random().toString(16).slice(2, 8),
                  name: '',
                  socialLinks: {},
                  owners: [auth.currentUser?.uid || ''],
                } as ClientData)}
              />
            </DashboardCard>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-[1800px] justify-end px-6 pb-10 xl:px-10">
          <button
            type="button"
            onClick={() => setIsEditing(value => !value)}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all',
              isEditing
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'border border-black/[0.07] bg-white hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-white/5',
            )}
          >
            {isEditing ? <Check className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
            {isEditing ? 'Concluir' : 'Organizar'}
          </button>
        </div>
      </div>

      <ClientSetupModal 
        setupClient={setupClient}
        setSetupClient={setSetupClient}
        handleSaveClientSetup={handleSaveClientSetup}
        onOpenAdvanced={(id) => onSelectClient({ id } as ClientData, auth.currentUser?.role || 'designer', 'client_setup')}
      />
    </MainLayout>
  );
}
