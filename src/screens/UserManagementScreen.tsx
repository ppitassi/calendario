import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  Smartphone,
  Mail,
  Lock,
  Camera,
  User as UserIcon,
  Check,
  X as XIcon,
  Search,
  Eye,
  Lock as LockIcon,
  Settings,
  AlertTriangle,
  Clock,
  Calendar
} from 'lucide-react';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { UserProfile, UserRole, ROLE_LABELS, ClientData, ROLE_PERMISSIONS } from '../types';
import { cn } from '../lib/utils';
import { MainLayout } from '../components/MainLayout';
import { useNotifications } from '../contexts/NotificationContext';

interface UserManagementScreenProps {
  onExit: () => void;
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function UserManagementScreen({ onExit, currentClient, onNavigate }: UserManagementScreenProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'cycle'>('users');
  const [editingUser, setEditingUser] = useState<Partial<UserProfile>>({ role: 'designer' });
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast, confirm } = useNotifications();

  const [customRoles, setCustomRoles] = useState<Record<string, Record<string, boolean>>>({});
  const [cycleData, setCycleData] = useState({
    planning_month: '',
    deadline_pre: '',
    deadline_final: '',
  });

  const currentUserRole = auth.currentUser?.role || 'designer';
  const showAdminTabs = currentUserRole === 'admin' || currentUserRole === 'gerente';

  useEffect(() => {
    loadUsers();
    if (showAdminTabs) {
      loadCustomRoles();
      loadAgencySettings();
    }
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadCustomRoles = async () => {
    try {
      const data = await api.getCustomRoles();
      const rolesMap: Record<string, Record<string, boolean>> = {};
      
      // Initialize with default permissions from ROLE_PERMISSIONS
      Object.keys(ROLE_LABELS).forEach(role => {
        rolesMap[role] = { ...ROLE_PERMISSIONS[role as UserRole] };
      });
      
      // Override with DB data
      data.forEach((r: any) => {
        if (rolesMap[r.id]) {
          rolesMap[r.id] = { ...rolesMap[r.id], ...r.permissions };
        }
      });
      
      setCustomRoles(rolesMap);
    } catch (e) {
      console.error("Erro ao carregar permissões:", e);
    }
  };

  const loadAgencySettings = async () => {
    try {
      const tenantId = auth.currentUser?.tenant_id || 'default_agency';
      const data = await api.getAgencySettings(tenantId);
      if (data) {
        setCycleData({
          planning_month: data.planning_month || '',
          deadline_pre: data.deadline_pre !== null && data.deadline_pre !== undefined ? String(data.deadline_pre) : '',
          deadline_final: data.deadline_final !== null && data.deadline_final !== undefined ? String(data.deadline_final) : '',
        });
      }
    } catch (e) {
      console.error("Erro ao carregar configurações da agência:", e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser.email || !editingUser.displayName || isSaving) return;
    setIsSaving(true);
    try {
      await api.saveUser({ ...editingUser, uid: editingUser.uid || Math.random().toString(36).substring(7) } as UserProfile);
      await loadUsers();
      setEditingUser({ role: 'designer' });
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleDelete = async (uid: string) => {
    const isConfirmed = await confirm(
      'Remover Colaborador',
      'Deseja realmente remover este colaborador da equipe?',
      { confirmText: 'Remover', type: 'danger' }
    );
    if (!isConfirmed) return;
    try {
      await api.deleteUser(uid);
      await loadUsers();
      toast('Colaborador removido com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      toast('Erro ao remover colaborador.', 'error');
    }
  };

  const handleTogglePermission = (role: string, permKey: string) => {
    setCustomRoles(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permKey]: !prev[role][permKey]
      }
    }));
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    try {
      for (const [roleId, perms] of Object.entries(customRoles)) {
        await api.saveCustomRole({
          id: roleId,
          label: ROLE_LABELS[roleId as UserRole] || roleId,
          permissions: perms
        });
      }
      toast('Permissões de acesso salvas com sucesso!', 'success');
      await loadCustomRoles();
    } catch (e) {
      console.error(e);
      toast('Erro ao salvar permissões de acesso.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCycleSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateAgencySettings({
        planning_month: cycleData.planning_month,
        deadline_pre: cycleData.deadline_pre || undefined,
        deadline_final: cycleData.deadline_final || undefined,
      });
      toast('Configurações de ciclo atualizadas com sucesso!', 'success');
      if (auth.currentUser) {
        auth.currentUser = {
          ...auth.currentUser,
          planning_month: cycleData.planning_month,
          deadline_pre: cycleData.deadline_pre,
          deadline_final: cycleData.deadline_final
        };
      }
    } catch (e) {
      console.error(e);
      toast('Erro ao salvar ciclo.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const PERMISSION_KEYS = [
    { id: 'canCreatePosts', label: 'Criar Posts/Cards' },
    { id: 'canEditAssignedPosts', label: 'Editar Posts Designados' },
    { id: 'canEditCalendar', label: 'Alterar Datas & Prazos' },
    { id: 'canReviewAndSend', label: 'Revisar & Enviar p/ Cliente' },
    { id: 'canConfigClients', label: 'Configurar Clientes' },
    { id: 'canManageRoles', label: 'Gerenciar Equipe/Permissões' },
    { id: 'canViewPresentation', label: 'Visualizar Modo Apresentação' },
    { id: 'canComment', label: 'Adicionar Comentários' },
  ];

  return (
    <MainLayout activeScreen="admin_roles" onNavigate={onNavigate} currentClient={currentClient}>
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-8 pt-12">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <button onClick={onExit} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-3xl font-display font-black tracking-tight">Gestão de Equipe</h1>
              <span className="text-[10px] font-black uppercase opacity-40 tracking-widest mt-1">Agency OS: Colaboradores & Permissões</span>
            </div>
          </div>

          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-white/5">
             <button 
               onClick={() => setActiveTab('users')}
               className={cn("px-6 py-2.5 rounded-xl text-xs font-bold uppercase transition-all", activeTab === 'users' ? "bg-primary text-white shadow-lg" : "opacity-40 hover:opacity-100")}
             >
               Membros
             </button>
             {showAdminTabs && (
               <>
                 <button 
                   onClick={() => setActiveTab('permissions')}
                   className={cn("px-6 py-2.5 rounded-xl text-xs font-bold uppercase transition-all", activeTab === 'permissions' ? "bg-primary text-white shadow-lg" : "opacity-40 hover:opacity-100")}
                 >
                   Matriz de Permissões
                 </button>
                 <button 
                   onClick={() => setActiveTab('cycle')}
                   className={cn("px-6 py-2.5 rounded-xl text-xs font-bold uppercase transition-all", activeTab === 'cycle' ? "bg-primary text-white shadow-lg" : "opacity-40 hover:opacity-100")}
                 >
                   Ciclo & Prazos
                 </button>
               </>
             )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'users' ? (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-12 gap-8"
            >
              {/* Form Sidebar */}
              <div className="col-span-4 glass rounded-[2.5rem] p-8 border border-white/10 flex flex-col gap-8 h-fit">
                 <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-dashed border-primary/40 flex items-center justify-center overflow-hidden">
                       {editingUser.photoURL ? <img src={editingUser.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-8 h-8 opacity-20" />}
                    </div>
                    <span className="text-[9px] font-black uppercase opacity-20 tracking-widest">Foto do Colaborador</span>
                 </div>

                 <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase opacity-40 ml-1">Nome Completo</label>
                       <input 
                         type="text" required
                         value={editingUser.displayName || ''}
                         onChange={e => setEditingUser(prev => ({ ...prev, displayName: e.target.value }))}
                         className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase opacity-40 ml-1">Email Profissional</label>
                       <input 
                         type="email" required
                         value={editingUser.email || ''}
                         onChange={e => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                         className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase opacity-40 ml-1">Cargo</label>
                       <select 
                         value={editingUser.role || 'designer'}
                         onChange={e => setEditingUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
                         className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all appearance-none cursor-pointer"
                       >
                         {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                       </select>
                    </div>

                    <button className="w-full py-5 bg-primary text-white rounded-[1.8rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                       Salvar Colaborador
                    </button>
                 </form>
              </div>

              {/* User List */}
              <div className="col-span-8 space-y-4">
                 <div className="relative mb-8">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                    <input 
                      type="text" 
                      placeholder="Pesquisar por nome, email ou cargo..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-[2rem] pl-16 pr-8 py-5 text-sm font-bold outline-none focus:bg-white/10 transition-all"
                    />
                 </div>

                 {users.filter(u => {
                   const search = searchTerm.toLowerCase();
                   return u.displayName?.toLowerCase().includes(search) || 
                          u.email?.toLowerCase().includes(search) || 
                          u.role?.toLowerCase().includes(search);
                 }).map((u, i) => (
                   <div key={u.uid} className="glass rounded-3xl p-5 flex items-center justify-between border border-white/5 hover:border-primary/30 transition-all group">
                      <div className="flex items-center gap-5">
                         <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white text-xl font-black shadow-lg">
                            {u.displayName?.substring(0, 2).toUpperCase()}
                         </div>
                         <div className="flex flex-col">
                            <h4 className="font-bold text-lg">{u.displayName}</h4>
                            <div className="flex items-center gap-3 mt-1">
                               <span className="text-[9px] font-black uppercase bg-white/5 px-3 py-1 rounded-full opacity-40">{u.role}</span>
                               <span className="text-xs opacity-20">{u.email}</span>
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingUser(u)} className="p-3 rounded-xl bg-white/5 hover:bg-primary/20 hover:text-primary transition-all"><Settings className="w-4 h-4" /></button>
                         <button onClick={() => handleDelete(u.uid)} className="p-3 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                   </div>
                 ))}
              </div>
            </motion.div>
          ) : activeTab === 'permissions' ? (
             <motion.div 
               key="permissions"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="glass rounded-[3.5rem] p-12 border border-white/10 shadow-2xl"
             >
                <div className="flex items-center justify-between mb-8">
                   <div className="flex flex-col">
                      <h3 className="text-xl font-bold">Matriz de Controle de Acesso</h3>
                      <p className="text-xs opacity-40 mt-1">Defina quais funções cada cargo tem autorização para executar.</p>
                   </div>
                   <button 
                      onClick={handleSavePermissions}
                      disabled={isSaving}
                      className="px-8 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                   >
                      {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                   </button>
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="border-b border-white/5">
                            <th className="pb-6 text-xs font-black uppercase opacity-20">Permissão / Funcionalidade</th>
                            {Object.keys(ROLE_LABELS).map(role => (
                              <th key={role} className="pb-6 text-center text-[10px] font-black uppercase opacity-20">{ROLE_LABELS[role as UserRole]}</th>
                            ))}
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                         {PERMISSION_KEYS.map(perm => (
                           <tr key={perm.id} className="group hover:bg-white/2">
                              <td className="py-6 flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <LockIcon className="w-4 h-4" />
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="font-bold text-sm">{perm.label}</span>
                                    <span className="text-[9px] font-black uppercase opacity-20 tracking-tighter">Sistêmico</span>
                                 </div>
                              </td>
                              {Object.keys(ROLE_LABELS).map(role => {
                                 const isChecked = !!customRoles[role]?.[perm.id];
                                 return (
                                   <td key={role} className="py-6 text-center">
                                      <div className="flex items-center justify-center">
                                         <label className="relative flex items-center justify-center cursor-pointer">
                                            <input 
                                               type="checkbox"
                                               checked={isChecked}
                                               onChange={() => handleTogglePermission(role, perm.id)}
                                               className="sr-only peer"
                                            />
                                            <div className="w-6 h-6 rounded-lg bg-black/10 dark:bg-white/5 border border-white/10 peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-all">
                                               {isChecked && <Check className="w-4 h-4 text-white" />}
                                            </div>
                                         </label>
                                      </div>
                                   </td>
                                 );
                              })}
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </motion.div>
          ) : (
             <motion.div 
               key="cycle"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="glass rounded-[3.5rem] p-12 border border-white/10 shadow-2xl max-w-xl mx-auto w-full"
             >
                <div className="flex flex-col mb-8">
                   <h3 className="text-xl font-bold">Ciclo & Prazos da Agência</h3>
                   <p className="text-xs opacity-40 mt-1">Configure o mês de referência de planejamento e prazos internos.</p>
                </div>

                <form onSubmit={handleSaveCycleSettings} className="space-y-8">
                   <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                         <Calendar className="w-4 h-4" /> Mês de Planejamento Ativo
                      </label>
                      <input
                         type="month"
                         required
                         value={cycleData.planning_month}
                         onChange={(e) => setCycleData(p => ({ ...p, planning_month: e.target.value }))}
                         className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-lg font-display font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                      />
                      <p className="text-[10px] opacity-40 font-bold uppercase tracking-tighter">O ciclo de posts atual em produção (Ex: Maio de 2026).</p>
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                         <label className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Pré-Aprovação (Dia)
                         </label>
                         <input
                            type="number"
                            min="1"
                            max="31"
                            required
                            value={cycleData.deadline_pre}
                            onChange={(e) => setCycleData(p => ({ ...p, deadline_pre: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                            placeholder="Ex: 10"
                         />
                         <p className="text-[10px] opacity-40 font-bold uppercase tracking-tighter">Prazo interno limite para a pré-aprovação.</p>
                      </div>

                      <div className="space-y-3">
                         <label className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Prazo Final (Dia)
                         </label>
                         <input
                            type="number"
                            min="1"
                            max="31"
                            required
                            value={cycleData.deadline_final}
                            onChange={(e) => setCycleData(p => ({ ...p, deadline_final: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                            placeholder="Ex: 20"
                         />
                         <p className="text-[10px] opacity-40 font-bold uppercase tracking-tighter">Prazo limite final para publicação do ciclo.</p>
                      </div>
                   </div>

                   <button 
                      type="submit"
                      disabled={isSaving}
                      className="w-full py-5 bg-primary text-white rounded-[1.8rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                   >
                      {isSaving ? 'Salvando...' : 'Salvar Prazos & Ciclo'}
                   </button>
                </form>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}
