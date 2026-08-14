import React from 'react';
import {ArrowRight,BriefcaseBusiness,CalendarClock,CheckCircle2,History,Users} from 'lucide-react';
import {auth} from '../../lib/auth';
import {MyWorkWidget} from './MyWorkWidget';
import {DeadlinesWidget} from './DeadlinesWidget';
import {RecentActivityWidget} from './RecentActivityWidget';
import {ProductionBIWidget} from './ProductionBIWidget';
import {CompactClientsWidget} from './CompactClientsWidget';
import {UserRole} from '../../types';
import {Button} from '../../components/ui/Button/Button';
import styles from './Dashboard.module.css';

interface Props{dashboardData:any;canViewProduction:boolean;effectiveRole:UserRole;onOpenPost:(clientId:string,postId:string)=>void;onOpenProduction?:(filters?:any)=>void;onSelectClient:(client:any)=>void}
const META={work:{icon:BriefcaseBusiness,title:'Meu trabalho'},deadlines:{icon:CalendarClock,title:'Prazos e pendências'},clients:{icon:Users,title:'Clientes que precisam de atenção'},activity:{icon:History,title:'Atividades recentes'}} as const;
function SectionHeader({type,title:customTitle,action}:{type:keyof typeof META;title?:string;action?:React.ReactNode}){const{icon:Icon,title}=META[type];return <header className={styles.sectionHeader}><div className={styles.sectionIdentity}><Icon/><h2>{customTitle||title}</h2></div>{action}</header>}

export function DashboardMainContent({dashboardData,canViewProduction,effectiveRole,onOpenPost,onOpenProduction,onSelectClient}:Props){
  const work=dashboardData?.modules?.myWork||[];
  const deadlines=dashboardData?.modules?.deadlines||{};
  const overdue=Number(deadlines.overdue||0);
  const firstName=auth.currentUser?.displayName?.trim().split(/\s+/)[0]||'Criativo';
  const role=String(effectiveRole).toLowerCase();
  const workTitle=['designer','estagiario'].includes(role)?'Artes prioritárias':role==='atendimento'?'Aprovações e publicações':role==='socialmedia'?'Planejamentos e copy':'Meu trabalho';
  const summary=work.length?`Você possui ${work.length} ${work.length===1?'postagem':'postagens'} aguardando sua ação${overdue?` e ${overdue} ${overdue===1?'atrasada':'atrasadas'}`:' e nenhuma atrasada'}.`:'Seu trabalho está em dia. Não há ações pendentes agora.';
  const noCritical=!overdue&&!Number(deadlines.today)&&!Number(deadlines.changesRequested);
  return <div className={styles.mainContent}>
    <section className={styles.functionalHeader}>
      <div><span className={styles.eyebrow}>{canViewProduction?'Resumo operacional':'Visão pessoal'}</span><h1>Olá, {firstName}</h1><p>{summary}</p></div>
      <div className={styles.contextActions}>
        {work[0]&&<Button variant="primary" onClick={()=>onOpenPost(work[0].clientId,String(work[0].id))}>Continuar trabalho <ArrowRight/></Button>}
        <Button variant="glass" onClick={()=>onOpenProduction?.({status:overdue?'overdue':undefined})}>Ver prazos</Button>
        {canViewProduction&&<Button variant="glass" onClick={()=>onOpenProduction?.()}>Abrir esteira</Button>}
      </div>
    </section>
    <section className={styles.nativeSection}>
      <SectionHeader type="work" title={workTitle} action={<Button onClick={()=>onOpenProduction?.()} size="small" variant="ghost">Ver todos</Button>}/>
      <MyWorkWidget dashboardData={dashboardData} onOpenPost={onOpenPost} onOpenProduction={onOpenProduction}/>
    </section>
    <section className={styles.nativeSection}>
      <SectionHeader type="deadlines"/>
      <DeadlinesWidget dashboardData={dashboardData} onOpenProduction={onOpenProduction}/>
      {noCritical&&<p className={styles.compactEmpty}><CheckCircle2/>Você não possui prazos críticos neste período.</p>}
    </section>
    {canViewProduction&&<section className={`${styles.nativeSection} ${styles.productionSection}`}>
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Visão gerencial</span><h2>Produção em tempo real</h2></div><Button onClick={()=>onOpenProduction?.()} size="small" variant="ghost">Abrir esteira</Button></div>
      <ProductionBIWidget dashboardData={dashboardData} onOpenDetails={onOpenProduction}/>
    </section>}
    <div className={styles.nativeColumns}>
      <section className={styles.nativeSection}><SectionHeader type="clients"/><CompactClientsWidget dashboardData={dashboardData} onSelectClient={onSelectClient}/></section>
      <section className={styles.nativeSection}><SectionHeader type="activity"/><RecentActivityWidget dashboardData={dashboardData} onOpenPost={onOpenPost}/></section>
    </div>
  </div>;
}
