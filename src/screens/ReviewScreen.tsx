import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "../lib/api";
import { ApprovalToken, PostData, ClientData, ROLE_LABELS, UserRole } from "../types";
import { ViewerScreen } from "./ViewerScreen";
import { CheckCircle2, Send, MessageSquare, AlertOctagon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNotifications } from "../contexts/NotificationContext";
import { auth, useAuthState } from "../lib/auth";
import { ReviewFloatingBar } from "./review/ReviewFloatingBar";
import type { PresentationViewModel } from "../../lib/presentation-model";
import { Textarea } from "../components/ui/Textarea/Textarea";
import { Button } from "../components/ui/Button/Button";
import { Modal } from "../components/ui/Modal/Modal";
import styles from "./ReviewScreen.module.css";

type ReviewPayload = {
  tokenData: ApprovalToken;
  client: ClientData;
  posts: PostData[];
  owners?: Array<{ displayName?: string; role?: UserRole }>;
};

function normalizePostDate(value: unknown) {
  const stringValue = String(value || "");
  return stringValue.includes("T") ? stringValue.split("T")[0] : stringValue;
}

export function ReviewScreen({ review, token, isExport = false, presentationModel }: { review: ReviewPayload; token: string; isExport?: boolean; presentationModel?: PresentationViewModel }) {
  const router = useRouter();
  const [user] = useAuthState(auth);
  const { toast } = useNotifications();
  const { tokenData, client, owners = [] } = review;
  const [approved, setApproved] = useState(tokenData.status === "approved");

  const posts = useMemo(
    () =>
      review.posts.reduce<Record<string, PostData>>((result, post, index) => {
        const date = normalizePostDate(post.date);
        if (date) result[`${date}#${post.id || index}`] = { ...post, date };
        return result;
      }, {}),
    [review.posts],
  );

  const designerName = useMemo(() => {
    const priorityOwner = owners.find((owner) => owner.role === "designer" || owner.role === "estagiario") || owners[0];
    if (!priorityOwner) return "";
    const roleLabel = priorityOwner.role ? ROLE_LABELS[priorityOwner.role] || priorityOwner.role : "";
    return [priorityOwner.displayName, roleLabel && `(${roleLabel})`].filter(Boolean).join(" ");
  }, [owners]);

  const [modalNote, setModalNote] = useState("");
  const [hijackModal, setHijackModal] = useState<{
    isOpen: boolean;
    action: "approve_with_caveats" | "request_changes";
    title: string;
    subtitle: string;
    placeholder: string;
  } | null>(null);

  const handleApprove = async () => {
    if (!token) return;
    try {
      await api.submitPublicReviewAction(token, "approve");
      setApproved(true);
    } catch (e) {
      console.error(e);
      toast("Erro ao aprovar calendário.", "error");
    }
  };

  const handleModalSubmit = async () => {
    if (!token || !hijackModal || !modalNote.trim()) return;
    try {
      if (hijackModal.action === "approve_with_caveats") {
        await api.submitPublicReviewAction(token, "approve", modalNote);
        setApproved(true);
      } else {
        await api.submitPublicReviewAction(token, "request_changes", modalNote);
        toast("Solicitação de ajustes enviada com sucesso.", "success");
      }
      setHijackModal(null);
      setModalNote("");
    } catch (e) {
      console.error(e);
      toast("Erro ao enviar ação.", "error");
    }
  };

  const handleSendWhatsApp = async () => {
    try {
      await api.sendReviewWhatsApp(token);
      toast("Link de revisão enviado no grupo do WhatsApp!", "success");
    } catch (err: any) {
      console.error(err);
      toast(err.response?.data?.error || "Erro ao enviar no WhatsApp.", "error");
    }
  };

  const viewerRole = user?.role || "cliente";

  const handleOpenModal = (action: "approve_with_caveats" | "request_changes") => {
    setModalNote("");
    if (action === "approve_with_caveats") {
      setHijackModal({
        isOpen: true,
        action: "approve_with_caveats",
        title: "Aprovar com Ressalvas",
        subtitle: "Descreva as ressalvas ou observações antes de aprovar.",
        placeholder: "Escreva as notas ou ressalvas que a equipe deve levar em conta ao publicar...",
      });
    } else {
      setHijackModal({
        isOpen: true,
        action: "request_changes",
        title: "Solicitar Ajustes",
        subtitle: "Por favor, explique o motivo da reprovação/ajustes detalhadamente.",
        placeholder: "Escreva as alterações que você gostaria que fossem feitas...",
      });
    }
  };

  return (
    <div className={styles.root}>
      <ViewerScreen
        posts={posts}
        client={client}
        userRole=""
        currentDate={new Date(tokenData.month + "-01T12:00:00")}
        onExit={() => {}}
        username={designerName}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
        reviewToken={token}
        isExport={isExport}
        presentationModel={presentationModel}
      />

      <AnimatePresence>
        {!approved && !isExport && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className={styles.floatingBar}>
            <ReviewFloatingBar
              viewerRole={viewerRole}
              approved={approved}
              onApprove={handleApprove}
              onSendWhatsApp={handleSendWhatsApp}
              onOpenModal={handleOpenModal}
              onReturnToEditor={() => router.push("/")}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {approved && !isExport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.approvedOverlay}>
            <motion.div initial={{ scale: 0.5, y: 20 }} animate={{ scale: 1, y: 0 }} className={styles.approvedContent}>
              <div className={styles.approvedIcon}>
                <CheckCircle2 />
              </div>
              <div>
                <h2>Calendário Aprovado!</h2>
                <p>Tudo pronto! Nossa equipe foi notificada e já estamos preparando suas publicações.</p>
              </div>
              <p className={styles.closeHint}>Você já pode fechar esta aba.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {hijackModal ? (
        <Modal open onClose={() => setHijackModal(null)} title={hijackModal.title} className="w-full max-w-xl">
              <div className={styles.modalIntro}>
                <div className={styles.modalIcon} data-action={hijackModal.action}>
                  {hijackModal.action === "approve_with_caveats" ? <AlertOctagon /> : <MessageSquare />}
                </div>
                <div>
                  <p>{hijackModal.subtitle}</p>
                </div>
              </div>

              <div className={styles.noteField}>
                <Textarea
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder={hijackModal.placeholder}
                  rows={5}
                  className="w-full"
                />
              </div>

              <div className={styles.modalActions}>
                <Button onClick={() => setHijackModal(null)} className="flex-1" variant="ghost">
                  Voltar
                </Button>
                <Button
                  onClick={handleModalSubmit}
                  disabled={!modalNote.trim()}
                  className="flex-1"
                  variant={hijackModal.action === "approve_with_caveats" ? "primary" : "danger"}
                  icon={<Send />}
                >
                  Enviar
                </Button>
              </div>
        </Modal>
      ) : null}
    </div>
  );
}
