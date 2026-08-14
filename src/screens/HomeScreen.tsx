import React,{useEffect,useMemo,useState} from 'react';
import {Check,Plus,RotateCcw,Settings2} from 'lucide-react';
import {MainLayout} from '../components/MainLayout';
import {FlexiGrid} from '../widgets/shared/FlexiGrid';
import {ClientData,ROLE_PERMISSIONS,UserRole} from '../types';
import {auth} from '../lib/auth';
import {api} from '../lib/api';
import {dashboardWidgetRegistry,defaultDashboardLayout} from '../widgets/dashboardWidgetRegistry';
import {useWidgetLayout} from '../hooks/useWidgetLayout';
import {ClientSetupModal} from '../modals/ClientSetupModal';
import {DashboardMainContent} from '../widgets/dashboard/DashboardMainContent';
import {synchronizeClientUrl,recentClientIdsFrom} from '../lib/client-selection';
import {ViewAsDropdown} from '../components/ViewAsDropdown';
import {Button} from '../components/ui/Button/Button';
import {Modal} from '../components/ui/Modal/Modal';
import styles from '../widgets/dashboard/Dashboard.module.css';

interface Props{onSelectClient:(client:ClientData,role:string,destination:string)=>void;onOpenAdmin:()=>void;onNavigate:(screen:string)=>void;currentClient:ClientData|null;onOpenProduction?:(filters?:{status?:string;members?:string[]})=>void;simulatedRole:string|null;onSimulatedRoleChange:(role:string|null)=>void;roleOptions:Array<{id:string;label:string}>}

export function HomeScreen({onSelectClient,onOpenAdmin,onNavigate,currentClient,onOpenProduction,simulatedRole,onSimulatedRoleChange,roleOptions}:Props){
  const role=auth.currentUser?.role||'designer';
  const effectiveRole=(simulatedRole||role) as UserRole;
  const capabilities=simulatedRole?ROLE_PERMISSIONS[effectiveRole]:(auth.currentUser?.permissions||ROLE_PERMISSIONS[effectiveRole]||{});
  const defaults=useMemo(()=>defaultDashboardLayout(capabilities as any,effectiveRole),[effectiveRole,JSON.stringify(capabilities)]);
  const{layouts,draft,setDraft,begin,cancel,save,reset}=useWidgetLayout(auth.currentUser?.uid||'default',defaults);
  const[editing,setEditing]=useState(false);
  const[catalog,setCatalog]=useState(false);
  const[saving,setSaving]=useState(false);
  const[dashboardData,setDashboardData]=useState<any>(null);
  const[clients,setClients]=useState<ClientData[]>([]);
  const[,setClientsLoading]=useState(true);
  const[,setClientsError]=useState(false);
  const[recentClientIds,setRecentClientIds]=useState<string[]>(()=>recentClientIdsFrom(auth.currentUser?.ui_preferences?.recentClientIds));
  const[loadError,setLoadError]=useState(false);
  const[setupClient,setSetupClient]=useState<ClientData|null>(null);
  const[,setRefreshTrigger]=useState(0);
  const canViewProduction=Boolean((capabilities as any).canViewProductionGallery)&&dashboardData?.capabilities?.canViewProductionGallery!==false;
  const complementaryWidgets=useMemo(()=>dashboardWidgetRegistry.filter(widget=>widget.placement==='complementary'&&(!widget.requiredCapability||Boolean((capabilities as any)[widget.requiredCapability]))),[capabilities]);
  const active=editing?draft:layouts;

  useEffect(()=>{
    let active=true;
    void Promise.allSettled([api.getDashboardData(),api.getClients(),api.getUiPreferences()]).then(([dashboardResult,clientsResult,preferencesResult])=>{
      if(!active)return;
      if(dashboardResult.status==='fulfilled')setDashboardData(dashboardResult.value);else setLoadError(true);
      if(clientsResult.status==='fulfilled'){
        setClients(clientsResult.value);
        const accessibleIds=new Set(clientsResult.value.map(client=>client.id));
        const rawRecent=preferencesResult.status==='fulfilled'?preferencesResult.value?.recentClientIds:auth.currentUser?.ui_preferences?.recentClientIds;
        setRecentClientIds(recentClientIdsFrom(rawRecent,accessibleIds));
      }else setClientsError(true);
      setClientsLoading(false);
    });
    return()=>{active=false};
  },[]);

  const selectClient=async(client:ClientData,destination='editor')=>{
    const accessibleIds=new Set(clients.map(item=>item.id));
    const nextRecent=[client.id,...recentClientIds.filter(id=>id!==client.id&&accessibleIds.has(id))].slice(0,6);
    setRecentClientIds(nextRecent);
    synchronizeClientUrl(client.id);
    onSelectClient(client,role,destination);
  };

  const openPost=async(clientId:string,postId:string)=>{
    try{const client=await api.getClient(clientId);if(!client)return;window.history.pushState({},'',`/?clientId=${encodeURIComponent(clientId)}&postId=${encodeURIComponent(postId)}`);onSelectClient(client,role,'editor')}catch{}
  };
  const saveEdit=async()=>{setSaving(true);try{await save();setEditing(false)}finally{setSaving(false)}};
  const add=(id:string)=>{const existing=draft.find(item=>item.id===id);if(existing)setDraft(draft.map(item=>item.id===id?{...item,isHidden:false,position:draft.length}:item));else{const widget=complementaryWidgets.find(item=>item.id===id)!;setDraft([...draft,{id,position:draft.length,size:widget.defaultSize,isHidden:false,zIndex:1}])}};
  const handleSaveClientSetup=async(event:React.FormEvent)=>{event.preventDefault();if(!setupClient)return null;const id=await api.saveClient(setupClient);setSetupClient(null);setRefreshTrigger(value=>value+1);return id};

  return <MainLayout activeScreen="home" onNavigate={onNavigate} currentClient={currentClient} onClientChange={client=>client?selectClient(client):undefined} headerContext={<ViewAsDropdown userRole={role} value={simulatedRole} onChange={onSimulatedRoleChange} options={[{id:'',label:'Minha visão'},...roleOptions]}/> }>
    <main className="mx-auto w-full max-w-[1800px] px-4 pb-12 pt-5 sm:px-6 xl:px-10">
      {loadError&&<div className={styles.loadError}>Alguns dados não puderam ser carregados. <Button onClick={()=>location.reload()} size="small" variant="ghost">Tentar novamente</Button></div>}
      <div className={styles.pageShell}>
        <DashboardMainContent dashboardData={dashboardData} canViewProduction={canViewProduction} effectiveRole={effectiveRole} onOpenPost={openPost} onOpenProduction={onOpenProduction} onSelectClient={client=>void selectClient(client)}/>
        <aside className={styles.widgetRail} aria-label="Widgets complementares">
          <div className={styles.widgetRailHeader}>
            <div><span className={styles.eyebrow}>Personalização</span><h2>Seus widgets</h2></div>
            {!editing?<Button variant="glass" size="small" icon={<Settings2/>} onClick={()=>{begin();setEditing(true)}}>Personalizar</Button>:null}
          </div>
          {editing&&<div className={styles.editToolbar}>
            <Button variant="glass" size="small" icon={<Plus/>} onClick={()=>setCatalog(true)}>Adicionar</Button>
            <Button variant="glass" size="small" icon={<RotateCcw/>} onClick={()=>{if(confirm('Restaurar os widgets padrão para suas capacidades atuais?'))reset()}}>Restaurar</Button>
            <Button variant="ghost" size="small" onClick={()=>{cancel();setEditing(false)}}>Cancelar</Button>
            <Button variant="primary" size="small" loading={saving} icon={<Check/>} onClick={saveEdit}>Salvar</Button>
          </div>}
          <FlexiGrid widgets={complementaryWidgets} layouts={active} isEditing={editing} onLayoutChange={setDraft} onOpenAdmin={onOpenAdmin} onSelectClient={onSelectClient} currentClient={currentClient} dashboardData={dashboardData} onOpenProduction={onOpenProduction} onOpenPost={openPost}/>
        </aside>
      </div>
    </main>
    <Modal open={catalog} onClose={()=>setCatalog(false)} title="Adicionar widget" className="w-full max-w-xl">
      <p className={styles.catalogIntro}>Módulos complementares disponíveis para você.</p>
      <div className={styles.catalogGrid}>{complementaryWidgets.map(widget=>{const added=draft.some(item=>item.id===widget.id&&!item.isHidden);return /* style-architecture-button-exception: widget cards are feature-specific catalog selections. */ <button key={widget.id} disabled={added} onClick={()=>add(widget.id)} className={styles.catalogItem}><widget.icon/><strong>{widget.title}</strong><span>{widget.description}</span><em>{added?'Já adicionado':'Adicionar'}</em></button>})}</div>
    </Modal>
    <ClientSetupModal setupClient={setupClient} setSetupClient={setSetupClient} handleSaveClientSetup={handleSaveClientSetup} onOpenAdvanced={id=>onSelectClient({id} as ClientData,role,'client_setup')}/>
  </MainLayout>;
}
