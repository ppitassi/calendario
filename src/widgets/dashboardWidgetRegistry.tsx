import {Activity,Bot,BriefcaseBusiness,Clock3,Flame,History,Users,Zap} from 'lucide-react';
import {WidgetConfig,WidgetLayout} from './shared/types';
import {MyWorkWidget} from './dashboard/MyWorkWidget';
import {DeadlinesWidget} from './dashboard/DeadlinesWidget';
import {RecentActivityWidget} from './dashboard/RecentActivityWidget';
import {ProductionBIWidget} from './dashboard/ProductionBIWidget';
import {WorkloadBIWidget} from './dashboard/WorkloadBIWidget';
import {ProductivityTrackerWidget} from './dashboard/ProductivityTrackerWidget';
import {CompanionHubWidget} from './dashboard/CompanionHubWidget';
import {CompactClientsWidget} from './dashboard/CompactClientsWidget';

export const dashboardWidgetRegistry:WidgetConfig[]=[
  {id:'my_work',title:'Meu trabalho agora',description:'Ações e postagens que precisam da sua atenção.',icon:BriefcaseBusiness,category:'PRODUCTIVITY',component:MyWorkWidget,placement:'section',allowedSizes:['medium','wide'],defaultSize:'wide',removable:false,allowMultiple:false},
  {id:'deadlines',title:'Prazos e pendências',description:'Atrasos, próximos prazos e alterações solicitadas.',icon:Clock3,category:'PRODUCTIVITY',component:DeadlinesWidget,placement:'section',allowedSizes:['compact','medium'],defaultSize:'compact',removable:false,allowMultiple:false},
  {id:'production_bi',title:'Produção em tempo real',description:'Resumo da esteira de produção da agência.',icon:Activity,category:'PRODUCTION',component:ProductionBIWidget,placement:'section',allowedSizes:['medium','wide'],defaultSize:'wide',requiredCapability:'canViewProductionGallery',removable:false,allowMultiple:false,rolesSuggested:['admin','gerente']},
  {id:'workload',title:'Carga e eficiência',description:'Carga ativa e entregas reais no período.',icon:Zap,category:'MANAGEMENT',component:WorkloadBIWidget,placement:'complementary',allowedSizes:['compact','medium'],defaultSize:'medium',removable:true,allowMultiple:false},
  {id:'productivity',title:'Foco e performance',description:'Indicadores pessoais verificáveis.',icon:Flame,category:'PRODUCTIVITY',component:ProductivityTrackerWidget,placement:'complementary',allowedSizes:['compact','medium'],defaultSize:'compact',removable:true,allowMultiple:false},
  {id:'recent_activity',title:'Atividades recentes',description:'Mudanças relevantes nas tarefas relacionadas.',icon:History,category:'MANAGEMENT',component:RecentActivityWidget,placement:'section',allowedSizes:['medium','wide'],defaultSize:'medium',removable:false,allowMultiple:false},
  {id:'client_grid',title:'Clientes',description:'Clientes sob sua responsabilidade.',icon:Users,category:'MANAGEMENT',component:CompactClientsWidget,placement:'section',allowedSizes:['medium','wide'],defaultSize:'medium',removable:false,allowMultiple:false},
  {id:'companion',title:'LeIA e contexto',description:'Assistência criativa e atalhos contextuais.',icon:Bot,category:'COMMUNICATION',component:CompanionHubWidget,placement:'complementary',allowedSizes:['compact','medium'],defaultSize:'compact',removable:true,allowMultiple:false}
];

export function defaultDashboardLayout(_capabilities:Record<string,boolean>,role:string):WidgetLayout[]{
  const normalizedRole=String(role||'').toLowerCase();
  const managerial=['admin','gerente'].includes(normalizedRole);
  const ids=managerial?['workload','productivity','companion']:normalizedRole==='atendimento'?['workload','companion']:['companion','productivity'];
  return ids.map((id,position)=>{
    const widget=dashboardWidgetRegistry.find(item=>item.id===id)!;
    return {id,position,size:widget.defaultSize,isHidden:false,zIndex:1};
  });
}
