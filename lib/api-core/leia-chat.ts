import { NextRequest, NextResponse } from "next/server";
import { rows } from "../db";
import { ApiContext } from "../api-types";
import { err, ok } from "../api-response";
import { body, rateLimited } from "./context";
import { completeWithLeia } from "../leia";

async function clientExists(clientId: string) {
  const result = await rows("SELECT id FROM clients WHERE id = ? LIMIT 1", [clientId]);
  return Boolean(result[0]);
}

type GeneratedPostFields = {
  date?: string;
  title: string;
  head: string;
  subhead: string;
  caption: string;
  objective: string;
  cta: string;
  hashtags: string;
  funnelStage: "topo" | "meio" | "fundo";
  source: "leia" | "rules";
};

export function ruleGeneratedFields(
  post: any,
  index = 0,
  total = 1,
): GeneratedPostFields {
  const text = [
    post.title,
    post.centralIdea,
    post.head,
    post.subhead,
    post.caption,
    post.subtitle,
    post.cta,
    post.hashtags,
    post.theme,
    post.script,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = text.toLowerCase();
  const conversion =
    /compr|contrat|or[çc]amento|agend|inscrev|cadastre|link|saiba mais|fale conosco|lead|venda|promo[çc][aã]o/.test(
      lower,
    );
  const nurture =
    /como|passo|dica|guia|erro|motivo|estrateg|por que|funciona|aprenda|entenda|conhe[çc]a/.test(
      lower,
    );
  const stage: "topo" | "meio" | "fundo" = conversion
    ? "fundo"
    : nurture
      ? "meio"
      : index < Math.ceil(total * 0.4)
        ? "topo"
        : index < Math.ceil(total * 0.8)
          ? "meio"
          : "fundo";
  const postNumber = Number(post.postNumber || index + 1);
  const generatedTitle = `Post ${postNumber} — ${(
    post.title ||
    post.head ||
    post.centralIdea ||
    "Conteúdo"
  )
    .slice(0, 45)
    .trim()}`;
  return {
    date: post.date,
    title: generatedTitle,
    head: String(post.head || "").slice(0, 78),
    subhead: String(post.subhead || post.centralIdea || "")
      .trim()
      .slice(0, 180),
    caption: String(post.caption || post.subtitle || "")
      .trim()
      .slice(0, 5000),
    objective:
      stage === "topo"
        ? "Atrair novos visitantes e gerar consciência de marca."
        : stage === "meio"
          ? "Nutrir potenciais clientes com conteúdo educativo e demonstrar autoridade."
          : "Estimular a conversão direta e chamada para ação comercial.",
    cta:
      stage === "topo"
        ? "Siga nosso perfil para acompanhar mais conteúdos como este!"
        : stage === "meio"
          ? "Comente a sua opinião ou compartilhe este post com quem precisa saber disso."
          : "Clique no link da bio e fale com a nossa equipe hoje mesmo!",
    hashtags: "#marketing #socialmedia #estrategia #conteudo #agencia",
    funnelStage: stage,
    source: "rules",
  };
}

export function extractGeneratedJson(raw: string): any[] | null {
  if (!raw) return null;
  const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.results)) return parsed.results;
    if (Array.isArray(parsed?.posts)) return parsed.posts;
  } catch {}
  return null;
}

export async function handleLeiaChatApi(
  method: string,
  route: string,
  req: NextRequest,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  if (route === "/leia/chat" && method === "POST") {
    const data = await body(req);
    const message = String(data.message || "")
      .trim()
      .slice(0, 8000);
    if (!message) return err("Mensagem obrigatória.", 400);
    if (await rateLimited(`leia:${ctx.userUid}`, 30, 60_000))
      return err(
        "A LeIA recebeu muitas solicitações. Aguarde um instante.",
        429,
      );

    let clientContext: Record<string, unknown> | null = null;
    const clientId = String(data.clientId || "");
    if (clientId) {
      if (!(await clientExists(clientId)))
        return err("Cliente não encontrado.", 404);
      clientContext =
        (
          await rows(
            "SELECT name, segment, voiceTone, targetAudience, contentColumns, brandNotes, postFrequency, networks, visualInfo FROM clients WHERE id = ? LIMIT 1",
            [clientId],
          )
        )[0] || null;
    }

    const history = Array.isArray(data.history)
      ? data.history.slice(-20)
      : [];
    try {
      const response = await completeWithLeia({
        messages: [
          {
            role: "system",
            content: `Você é a LeIA, assistente interna de uma agência de social media e marketing digital. Seu nome é um trocadilho com a colaboradora Leia, conhecida por resolver tudo. Responda em português do Brasil, de forma prática, estratégica e profissional. Ajude com ideias, calendários, legendas, briefings, funil, campanhas e revisão de conteúdo. Use o contexto do cliente sem inventar dados. Contexto: ${JSON.stringify(clientContext || {})}`,
          },
          ...history
            .map((item: any) => ({
              role:
                item?.sender === "leia"
                  ? ("assistant" as const)
                  : ("user" as const),
              content: String(item?.text || "").slice(0, 8000),
            }))
            .filter((item: any) => item.content),
          { role: "user", content: message },
        ],
        temperature: 0.6,
        maxCompletionTokens: 2048,
      });
      return ok({ response });
    } catch (error: any) {
      if (error?.message === "LEIA_NOT_CONFIGURED")
        return err("LeIA não configurada.", 503);
      return err("A LeIA não conseguiu responder agora.", 502);
    }
  }

  if (route === "/generate-objective" && method === "POST") {
    const data = await body(req);
    const clientId = String(data.clientId || "");
    if (!clientId || !(await clientExists(clientId)))
      return err("Cliente não encontrado.", 404);
    const incoming = Array.isArray(data.posts)
      ? data.posts
      : [data.post || data];
    const posts = incoming.slice(0, 100).map((post: any) => ({
      date: String(post.date || ""),
      type: String(post.type || ""),
      channel: String(post.channel || ""),
      title: String(post.title || ""),
      centralIdea: String(post.centralIdea || ""),
      caption: String(post.caption || post.subtitle || ""),
      subhead: String(post.subhead || ""),
      cta: String(post.cta || ""),
      hashtags: String(post.hashtags || ""),
      head: String(post.head || post.artHeadline || ""),
      objective: String(post.objective || ""),
      funnelStage: String(post.funnelStage || ""),
      theme: String(post.theme || ""),
      script: String(post.script || ""),
      postNumber: Number(post.postNumber) || 0,
    }));
    if (!posts.length) return err("Nenhuma postagem informada.", 400);
    const fallbacks = posts.map((post: any, index: number) =>
      ruleGeneratedFields(post, index, posts.length),
    );
    if (!process.env.GROQ_API_KEY)
      return ok({ results: fallbacks, source: "rules" });
    const clients = await rows(
      "SELECT name, segment, voiceTone, targetAudience, contentColumns, brandNotes FROM clients WHERE id = ? LIMIT 1",
      [clientId],
    );
    const client = clients[0] || {};
    const generationInputs = posts.map((post: any) => ({
      ...post,
      missingFields: [
        ...[
          "title",
          "subhead",
          "caption",
          "objective",
          "cta",
          "hashtags",
        ].filter((field) => !String(post[field] || "").trim()),
        "funnelStage",
      ],
    }));
    const prompt = `Você é estrategista de conteúdo. Leia todos os campos existentes de cada postagem e gere exatamente um objeto por postagem, em JSON válido, sem markdown, no formato {"results":[{"date":"YYYY-MM-DD","title":"...","head":"...","subhead":"...","caption":"...","objective":"...","cta":"...","hashtags":"...","funnelStage":"topo|meio|fundo"}]}.
Regras: use os campos preenchidos como contexto e devolva-os sem alterações; crie conteúdo somente para os campos em missingFields; title é o título interno e deve ser exatamente "Post N — explicação extremamente breve do assunto", usando postNumber como N; title nunca é a head; nunca crie, complete ou altere head — devolva a head original exatamente como recebida ou uma string vazia se ela estiver vazia; objetivo deve ter uma frase; sempre reclassifique funnelStage usando todos os campos preenchidos da postagem como contexto, mesmo que funnelStage já tenha valor; no lote distribua de forma estratégica entre topo, meio e fundo e não repita títulos. Não use, não gere e não mencione briefing para a arte, visualBriefing ou artText. Preserve a ordem e a date recebida.
Cliente: ${JSON.stringify(client)}
Postagens: ${JSON.stringify(generationInputs)}`;
    try {
      const content = await completeWithLeia({
        temperature: 0.4,
        maxCompletionTokens: 4096,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "generated_post_fields",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["results"],
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "date",
                      "title",
                      "head",
                      "subhead",
                      "caption",
                      "objective",
                      "cta",
                      "hashtags",
                      "funnelStage",
                    ],
                    properties: {
                      date: { type: "string" },
                      title: { type: "string" },
                      head: { type: "string" },
                      subhead: { type: "string" },
                      caption: { type: "string" },
                      objective: { type: "string" },
                      cta: { type: "string" },
                      hashtags: { type: "string" },
                      funnelStage: {
                        type: "string",
                        enum: ["topo", "meio", "fundo"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Você é a LeIA, estrategista de conteúdo para redes sociais. Responda somente no JSON solicitado, em português do Brasil.",
          },
          { role: "user", content: prompt },
        ],
      });
      const generated = extractGeneratedJson(content);
      if (!generated || generated.length !== posts.length)
        return ok({ results: fallbacks, source: "rules" });
      const results = generated.map((item: any, index: number) => {
        const fallback = fallbacks[index];
        const original = posts[index];
        const stage = ["topo", "meio", "fundo"].includes(item?.funnelStage)
          ? item.funnelStage
          : fallback.funnelStage;
        return {
          date: original.date,
          title: String(
            String(original.title || "").trim()
              ? original.title
              : item?.title || fallback.title,
          )
            .trim()
            .slice(0, 120),
          head: String(original.head || "").slice(0, 78),
          subhead: String(original.subhead || item?.subhead || "")
            .trim()
            .slice(0, 180),
          caption: String(original.caption || item?.caption || "")
            .trim()
            .slice(0, 5000),
          objective: String(
            original.objective || item?.objective || fallback.objective,
          )
            .trim()
            .slice(0, 240),
          cta: String(original.cta || item?.cta || "")
            .trim()
            .slice(0, 180),
          hashtags: String(original.hashtags || item?.hashtags || "")
            .trim()
            .slice(0, 500),
          funnelStage: stage,
          source: "leia",
        };
      });
      return ok({ results, source: "leia" });
    } catch {
      return ok({ results: fallbacks, source: "rules" });
    }
  }

  return null;
}
