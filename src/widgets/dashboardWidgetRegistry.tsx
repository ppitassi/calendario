import {Activity,Bot,BriefcaseBusiness,Clock3,Flame,History,Users,Zap} from 'lucide-react';import {WidgetConfig,WidgetLayout} from './shared/types';import {MyWorkWidget} from './dashboard/MyWorkWidget';import {DeadlinesWidget} from './dashboard/DeadlinesWidget';import {RecentActivityWidget} from './dashboard/RecentActivityWidget';import {ProductionBIWidget} from './dashboard/ProductionBIWidget';import {WorkloadBIWidget} from './dashboard/WorkloadBIWidget';import {ProductivityTrackerWidget} from './dashboard/ProductivityTrackerWidget';import {CompanionHubWidget} from './dashboard/CompanionHubWidget';import {CompactClientsWidget} from './dashboard/CompactClientsWidget';
export const dashboardWidgetRegistry:WidgetConfig[]=[
{id:'my_work',title:'Meu trabalho agora',description:'Ações e postagens que precisam da sua atenção.',icon:BriefcaseBusiness,category:'PRODUCTIVITY',colorClass:'bg-primary/10 text-primary',component:MyWorkWidget,allowedSizes:['medium','wide'],defaultSize:'wide',removable:false,allowMultiple:false},
{id:'deadlines',title:'Prazos e pendências',description:'Atrasos, próximos prazos e alterações solicitadas.',icon:Clock3,category:'PRODUCTIVITY',colorClass:'bg-amber-500/10 text-amber-500',component:DeadlinesWidget,allowedSizes:['compact','medium'],defaultSize:'compact',removable:true,allowMultiple:false},
{id:'production_bi',title:'Produção em tempo real',description:'Resumo da esteira de produção da agência.',icon:Activity,category:'PRODUCTION',colorClass:'bg-primary/10 text-primary',component:ProductionBIWidget,allowedSizes:['medium','wide'],defaultSize:'wide',requiredCapability:'canViewProductionGallery',removable:true,allowMultiple:false,rolesSuggested:['admin','gerente']},
{id:'workload',title:'Carga e eficiência',description:'Carga ativa e entregas reais no período.',icon:Zap,category:'MANAGEMENT',colorClass:'bg-indigo-500/10 text-indigo-500',component:WorkloadBIWidget,allowedSizes:['compact','medium'],defaultSize:'medium',removable:true,allowMultiple:false},
{id:'productivity',title:'Foco e performance',description:'Indicadores pessoais verificáveis.',icon:Flame,category:'PRODUCTIVITY',colorClass:'bg-orange-500/10 text-orange-500',component:ProductivityTrackerWidget,allowedSizes:['compact','medium'],defaultSize:'compact',removable:true,allowMultiple:false},
{id:'recent_activity',title:'Atividades recentes',description:'Mudanças relevantes nas tarefas relacionadas.',icon:History,category:'MANAGEMENT',colorClass:'bg-cyan-500/10 text-cyan-500',component:RecentActivityWidget,allowedSizes:['medium','wide'],defaultSize:'medium',removable:true,allowMultiple:false},
{id:'client_grid',title:'Clientes',description:'Clientes sob sua responsabilidade.',icon:Users,category:'MANAGEMENT',colorClass:'bg-emerald-500/10 text-emerald-500',component:CompactClientsWidget,allowedSizes:['medium','wide'],defaultSize:'medium',removable:true,allowMultiple:false},
{id:'companion',title:'LeIA e contexto',description:'Assistência criativa e atalhos contextuais.',icon:Bot,category:'COMMUNICATION',colorClass:'bg-amber-500/10 text-amber-500',component:CompanionHubWidget,allowedSizes:['compact','medium'],defaultSize:'compact',removable:true,allowMultiple:false},
];
export function defaultDashboardLayout(capabilities:Record<string,boolean>,role:string):WidgetLayout[]{
  const normalizedRole = String(role || '').toLowerCase();
  const managerial = ['admin','gerente'].includes(normalizedRole);
  const isSocialMedia = ['socialmedia','social_media'].includes(normalizedRole);
  const isDesigner = ['designer','estagiario'].includes(normalizedRole);
  const isAtendimento = normalizedRole === 'atendimento';

  const ids = managerial 
    ? ['my_work','production_bi','deadlines','workload','recent_activity','productivity','client_grid','companion']
    : isAtendimento 
      ? ['deadlines','my_work','client_grid','recent_activity','workload','companion']
      : isSocialMedia
        ? ['my_work','deadlines','recent_activity','client_grid','companion','productivity']
        : isDesigner
          ? ['my_work','deadlines','recent_activity','client_grid','productivity','companion']
          : ['my_work','deadlines','recent_activity','client_grid','companion','productivity'];

  return ids.filter(id=>{
    const w=dashboardWidgetRegistry.find(x=>x.id===id);
    return w && (!w.requiredCapability || Boolean(capabilities[w.requiredCapability]));
  }).map((id,position)=>{
    const w=dashboardWidgetRegistry.find(x=>x.id===id)!;
    return {id,position,size:w.defaultSize,isHidden:false,zIndex:1};
  });
}
