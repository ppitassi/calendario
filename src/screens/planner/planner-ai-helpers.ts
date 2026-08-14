import { PostData } from "../../types";

export const hasContent = (value: unknown) => String(value ?? "").trim().length > 0;

export const mergeGeneratedFields = (post: PostData, generated: any, postNumber: number): PostData => {
  const resolvedHead = hasContent(post.head) ? post.head : hasContent(post.artHeadline) ? post.artHeadline! : "";
  const generatedCaption = hasContent(generated?.caption) ? String(generated.caption) : "";
  const resolvedCaption = hasContent(post.subtitle) ? post.subtitle : hasContent(post.caption) ? post.caption! : generatedCaption;
  const topicSource = post.centralIdea || post.theme || post.subhead || post.subtitle || post.caption || generated?.subhead || generated?.caption || "Conteúdo estratégico";
  const briefTopic = String(topicSource).replace(/\s+/g, " ").trim().replace(/[.!?].*$/, "").slice(0, 64) || "Conteúdo estratégico";
  const generatedTitle = hasContent(generated?.title) ? String(generated.title) : `Post ${postNumber} — ${briefTopic}`;

  return {
    ...post,
    title: hasContent(post.title) ? post.title : generatedTitle,
    head: hasContent(post.head) ? post.head : resolvedHead,
    artHeadline: hasContent(post.artHeadline) ? post.artHeadline : resolvedHead,
    subhead: hasContent(post.subhead) ? post.subhead : generated?.subhead || "",
    subtitle: hasContent(post.subtitle) ? post.subtitle : resolvedCaption,
    caption: hasContent(post.caption) ? post.caption : resolvedCaption,
    objective: hasContent(post.objective) ? post.objective : generated?.objective || "",
    cta: hasContent(post.cta) ? post.cta : generated?.cta || "",
    hashtags: hasContent(post.hashtags) ? post.hashtags : generated?.hashtags || "",
    funnelStage: ["topo", "meio", "fundo"].includes(generated?.funnelStage) ? generated.funnelStage : post.funnelStage || "topo",
  };
};

export const postNumberInCurrentMonth = (posts: Record<string, PostData>, date: string) =>
  [...new Set([...Object.keys(posts), date])]
    .filter((postDate) => postDate.slice(0, 7) === date.slice(0, 7))
    .sort()
    .indexOf(date) + 1;
