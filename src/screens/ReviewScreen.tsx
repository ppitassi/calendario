import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '../lib/api';
import { ApprovalToken, PostData, ClientData, ROLE_LABELS, UserRole } from '../types';
import { ViewerScreen } from './ViewerScreen';
import { CheckCircle2, Send, X as CloseIcon, MessageSquare, AlertOctagon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
import { auth, useAuthState } from '../lib/auth';

type ReviewPayload = {
  tokenData: ApprovalToken;
  client: ClientData;
  posts: PostData[];
  owners?: Array<{ displayName?: string; role?: UserRole }>;
};

function normalizePostDate(value: unknown) {
  const stringValue = String(value || '');
  return stringValue.includes('T') ? stringValue.split('T')[0] : stringValue;
}

export function ReviewScreen({ review, token, isExport = false }: { review: ReviewPayload; token: string; isExport?: boolean }) {
  const router = useRouter();
  const [user] = useAuthState(auth);
  const { toast } = useNotifications();
  const { tokenData, client, owners = [] } = review;
  const [approved, setApproved] = useState(tokenData.status === 'approved');

  const posts = useMemo(() => review.posts.reduce<Record<string, PostData>>((result, post) => {
    const date = normalizePostDate(post.date);
    if (date) result[date] = { ...post, date };
    return result;
  }, {}), [review.posts]);

  const designerName = useMemo(() => {
    const priorityOwner = owners.find(owner => owner.role === 'designer' || owner.role === 'estagiario') || owners[0];
    if (!priorityOwner) return '';
    const roleLabel = priorityOwner.role ? ROLE_LABELS[priorityOwner.role] || priorityOwner.role : '';
    return [priorityOwner.displayName, roleLabel && `(${roleLabel})`].filter(Boolean).join(' ');
  }, [owners]);

  const [modalNote, setModalNote] = useState('');
  const [hijackModal, setHijackModal] = useState<{
    isOpen: boolean;
    action: 'approve_with_caveats' | 'request_changes';
    title: string;
    subtitle: string;
    placeholder: string;
  } | null>(null);

  const handleApprove = async () => {
    if (!token) return;
    try {
      await api.submitPublicReviewAction(token, 'approve');
      setApproved(true);
    } catch (e) {
      console.error(e);
      toast('Erro ao aprovar calendário.', 'error');
    }
  };

  const handleModalSubmit = async () => {
    if (!token || !hijackModal || !modalNote.trim()) return;
    try {
      if (hijackModal.action === 'approve_with_caveats') {
        await api.submitPublicReviewAction(token, 'approve', modalNote);
        setApproved(true);
      } else {
        await api.submitPublicReviewAction(token, 'request_changes', modalNote);
        toast('Solicitação de ajustes enviada com sucesso.', 'success');
      }
      setHijackModal(null);
      setModalNote('');
    } catch (e) {
      console.error(e);
      toast('Erro ao enviar ação.', 'error');
    }
  };

  const handleSendWhatsApp = async () => {
    try {
      await api.sendReviewWhatsApp(token);
      toast('Link de revisão enviado no grupo do WhatsApp!', 'success');
    } catch (err: any) {
      console.error(err);
      toast(err.response?.data?.error || 'Erro ao enviar no WhatsApp.', 'error');
    }
  };

  // Determinar a role do visualizador atual a partir do auth.currentUser
  const viewerRole = user?.role || 'cliente';

  const renderFloatingBar = () => {
    if (approved) return null;

    if (viewerRole === 'cliente') {
      return (
        <div className="glass p-6 rounded-[2rem] shadow-3xl border border-white/20 bg-white/90 dark:bg-zinc-900/90 flex flex-col md:flex-row items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold">Revisão do Cliente</h4>
              <p className="text-xs opacity-60">Aprove ou solicite ajustes para este mês.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => {
                setModalNote('');
                setHijackModal({
                  isOpen: true,
                  action: 'request_changes',
                  title: 'Solicitar Ajustes',
                  subtitle: 'Por favor, explique o motivo da reprovação/ajustes detalhadamente.',
                  placeholder: 'Escreva as alterações que você gostaria que fossem feitas...'
                });
              }}
              className="w-full md:w-auto px-6 py-3 rounded-xl text-zinc-500 hover:text-[var(--color-primary)] font-bold text-xs uppercase transition-all"
            >
              Reprovar com Ressalvas
            </button>
            
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button
                onClick={handleApprove}
                className="w-full md:w-auto px-8 py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-bold text-xs uppercase shadow-lg shadow-[var(--color-primary)]/20 hover:scale-[1.03] active:scale-[0.97] transition-all"
              >
                Aprovar Calendário
              </button>
              <button
                onClick={() => {
                  setModalNote('');
                  setHijackModal({
                    isOpen: true,
                    action: 'approve_with_caveats',
                    title: 'Aprovar com Ressalvas',
                    subtitle: 'Descreva as ressalvas ou observações antes de aprovar.',
                    placeholder: 'Escreva as notas ou ressalvas que a equipe deve levar em conta ao publicar...'
                  });
                }}
                className="w-full md:w-auto text-center text-[10px] text-[var(--color-primary)] hover:underline font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Aprovar com Ressalvas
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (viewerRole === 'atendimento') {
      return (
        <div className="glass p-6 rounded-[2rem] shadow-3xl border border-white/20 bg-white/90 dark:bg-zinc-900/90 flex flex-col md:flex-row items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold">Painel de Atendimento</h4>
              <p className="text-xs opacity-60">Dispare o link do calendário no grupo do WhatsApp do cliente.</p>
            </div>
          </div>
          <button
            onClick={handleSendWhatsApp}
            className="w-full md:w-auto px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            Enviar no Grupo do WhatsApp
          </button>
        </div>
      );
    }

    if (viewerRole === 'admin' || viewerRole === 'gerente') {
      return (
        <div className="glass p-6 rounded-[2rem] shadow-3xl border border-white/20 bg-white/90 dark:bg-zinc-900/90 flex flex-col md:flex-row items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold">Painel de Gestão</h4>
              <p className="text-xs opacity-60">Finalize o calendário aprovando-o definitivamente.</p>
            </div>
          </div>
          <button
            onClick={handleApprove}
            className="w-full md:w-auto px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Liberar para Publicação
          </button>
        </div>
      );
    }

    // Designer, Estagiário, Analista ou outros cargos
    return (
      <div className="glass p-6 rounded-[2rem] shadow-3xl border border-white/20 bg-white/90 dark:bg-zinc-900/90 flex flex-col md:flex-row items-center justify-between gap-6 w-full">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-500/10 flex items-center justify-center text-zinc-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-display font-bold">Modo de Apresentação</h4>
            <p className="text-xs opacity-60">Visualizando calendário de posts na perspectiva do cliente.</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
          className="w-full md:w-auto px-8 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Voltar para Edição
        </button>
      </div>
    );
  };

  return (
    <div className="relative">
      <ViewerScreen
        posts={posts}
        client={client}
        userRole="" // Vazio para esconder controles de equipe (voltar, meses) do cliente final
        currentDate={new Date(tokenData.month + '-01T12:00:00')}
        onExit={() => { }} // Sem botão de saída na visão pública
        username={designerName}
        onPrevMonth={() => {}} 
        onNextMonth={() => {}} 
        reviewToken={token}
        isExport={isExport}
      />

      {/* Floating Approval Bar */}
      <AnimatePresence>
        {!approved && !isExport && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-2xl"
          >
            {renderFloatingBar()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Overlay */}
      <AnimatePresence>
        {approved && !isExport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] bg-[var(--color-primary)] flex flex-col items-center justify-center text-white p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.5, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="w-32 h-32 rounded-[3rem] bg-white/20 backdrop-blur-xl flex items-center justify-center mx-auto border border-white/30">
                <CheckCircle2 className="w-16 h-16" />
              </div>
              <div>
                <h2 className="text-5xl font-display font-black mb-4">Calendário Aprovado!</h2>
                <p className="text-xl opacity-80 max-w-md mx-auto">Tudo pronto! Nossa equipe foi notificada e já estamos preparando suas publicações.</p>
              </div>
              <p className="text-sm opacity-60 pt-12">Você já pode fechar esta aba.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-Screen elegant screen hijacking modal overlay */}
      <AnimatePresence>
        {hijackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-zinc-950/95 backdrop-blur-2xl flex items-center justify-center p-6 text-white"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-zinc-900/80 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl relative"
            >
              <button
                onClick={() => setHijackModal(null)}
                className="absolute top-6 right-6 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <CloseIcon className="w-5 h-5 text-zinc-400" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${hijackModal.action === 'approve_with_caveats' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                  {hijackModal.action === 'approve_with_caveats' ? <AlertOctagon className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold">{hijackModal.title}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{hijackModal.subtitle}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <textarea
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder={hijackModal.placeholder}
                  rows={5}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium text-sm text-zinc-100"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setHijackModal(null)}
                  className="flex-1 py-3.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all text-xs font-bold uppercase tracking-wider"
                >
                  Voltar
                </button>
                <button
                  onClick={handleModalSubmit}
                  disabled={!modalNote.trim()}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 ${hijackModal.action === 'approve_with_caveats' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                >
                  Enviar <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
