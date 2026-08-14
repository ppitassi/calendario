import { PostData } from "../../types";

export type GalleryPost = PostData & { clientId?: string };

export const statusKey = (status?: string) =>
  String(status || "pending")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const statusLabel = (status?: string, stage?: string) => {
  if (stage)
    return (
      (
        {
          briefing: "Planejados",
          copy: "Copy",
          aguardando_design: "Aguardando design",
          design: "Criação",
          revisao_interna: "Revisão",
          aguardando_aprovacao: "Aprovação",
          alteracoes_solicitadas: "Alterações solicitadas",
          aprovado: "Concluído",
          agendado: "Agendado",
          publicado: "Publicado",
          arquivado: "Arquivado",
          cancelado: "Cancelado",
        } as Record<string, string>
      )[stage] || stage
    );
  const value = statusKey(status);
  if (["approved", "aprovado", "concluido"].includes(value)) return "Concluído";
  if (["waiting", "aguardando aprovacao"].includes(value)) return "Aprovação";
  if (
    ["review", "revisao", "ajuste solicitado", "changes_requested"].includes(
      value,
    )
  )
    return "Revisão";
  if (["producing", "em producao", "criacao"].includes(value)) return "Criação";
  return "Planejados";
};

export const elapsed = (value?: string) => {
  if (!value) return "Sem atividade";
  const h = Math.floor((Date.now() - new Date(value).getTime()) / 3600000);
  return h < 1
    ? "Agora"
    : h < 24
      ? "Há " + h + " h"
      : "Há " + Math.floor(h / 24) + " d";
};

export const extractImages = (post: GalleryPost) => {
  return [
    ...(post.feedImages || []),
    post.storyImage,
    post.coverImage,
    post.linkedinCover,
  ].filter(Boolean) as string[];
};
