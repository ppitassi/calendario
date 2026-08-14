import { getDbPool, parseJson } from './db';

type DbRow = Record<string, any>;

export type ReviewDataError = {
  error: string;
  status: number;
};



function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = new Date(year, monthNumber, 1);
  return {
    start: `${month}-01`,
    end: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`,
  };
}

function expiresAtMillis(value: any) {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeTokenData(tokenData: DbRow) {
  return {
    id: tokenData.id,
    clientId: tokenData.clientId,
    month: tokenData.month,
    status: tokenData.status,
    createdAt: Number(tokenData.createdAt) || null,
    expiresAt: expiresAtMillis(tokenData.expiresAt) || null,
    clientNote: tokenData.clientNote || null,
  };
}

export function isReviewDataError(value: unknown): value is ReviewDataError {
  return Boolean(value && typeof value === 'object' && 'error' in value);
}

export async function validateReviewToken(token: string) {
  if (!token) return { error: 'Token de revisão inválido.', status: 404 } as ReviewDataError;

  const db = getDbPool();
  const [tokenResult] = await db.query('SELECT * FROM approval_tokens WHERE id = ?', [token]);
  const tokenData = (tokenResult as DbRow[])[0];

  if (!tokenData) return { error: 'Token de revisão inválido.', status: 404 } as ReviewDataError;

  const expiry = expiresAtMillis(tokenData.expiresAt);
  if (['revoked','deleted','cancelled'].includes(String(tokenData.status || '').toLowerCase())) {
    return { error: 'Token de revisão revogado.', status: 410 } as ReviewDataError;
  }
  if (!expiry || expiry < Date.now()) {
    return { error: 'Token de revisão expirado.', status: 410 } as ReviewDataError;
  }

  return tokenData;
}

export async function validateReviewPost(token: string, postId: string | number) {
  const tokenData = await validateReviewToken(token);
  if (isReviewDataError(tokenData)) return tokenData;

  const range = monthRange(tokenData.month);
  const db = getDbPool();
  const [postResult] = await db.query(
    'SELECT id FROM posts WHERE id = ? AND clientId = ? AND date >= ? AND date < ?',
    [postId, tokenData.clientId, range.start, range.end],
  );

  if (!(postResult as DbRow[])[0]) {
    return { error: 'Post não pertence a esta revisão.', status: 404 } as ReviewDataError;
  }

  return tokenData;
}

async function buildReviewData(clientId: string, month: string, tokenData: DbRow | null = null) {
  const db = getDbPool();
  const [clientResult] = await db.query(
    `SELECT id, name, logoUrl, hasPreCalendar, owners, socialLinks, instagramStats, config,
            segment, voiceTone, targetAudience, contentColumns, brandNotes, postFrequency,
            networks, visualInfo
       FROM clients
      WHERE id = ?`,
    [clientId],
  );
  const client = (clientResult as DbRow[])[0];

  if (!client) {
    return { error: 'Cliente associado não encontrado.', status: 404 } as ReviewDataError;
  }

  const ownerIds = parseJson(client.owners, []).filter((id: unknown) => typeof id === 'string');
  let owners: DbRow[] = [];
  if (ownerIds.length) {
    const [ownerResult] = await db.query(
      'SELECT displayName, role FROM users WHERE uid IN (?)',
      [ownerIds],
    );
    owners = ownerResult as DbRow[];
  }

  const range = monthRange(month);
  const [postResult] = await db.query(
    `SELECT id, clientId, DATE_FORMAT(date, '%Y-%m-%d') AS date, type, head, subhead,
            subtitle, objective, channel, title, centralIdea, caption, artHeadline, artText, videoUrl,
            cta, hashtags, visualBriefing, theme, script, feedImages, funnelStage, status, deadline
       FROM posts
      WHERE clientId = ? AND date >= ? AND date < ?
      ORDER BY date ASC`,
    [clientId, range.start, range.end],
  );
  const postRows = postResult as DbRow[];
  const postIds = postRows.map((post) => post.id).filter(Boolean);
  let comments: DbRow[] = [];

  if (postIds.length) {
    const [commentResult] = await db.query(
      `SELECT id, postId, authorName, authorRole, content, createdAt FROM post_comments
       WHERE postId IN (?) ${tokenData ? "AND authorRole = 'cliente'" : ""} ORDER BY createdAt ASC`,
      [postIds],
    );
    comments = commentResult as DbRow[];
  }

  const commentsByPost = comments.reduce<Record<string, DbRow[]>>((acc, comment) => {
    const key = String(comment.postId);
    (acc[key] ||= []).push(comment);
    return acc;
  }, {});

  return {
    tokenData: tokenData
      ? safeTokenData(tokenData)
      : {
          id: `public-${clientId}-${month}`,
          clientId,
          month,
          status: 'public',
          createdAt: null,
          expiresAt: null,
          clientNote: null,
        },
    client: {
      ...client,
      owners: [],
      socialLinks: parseJson(client.socialLinks, {}),
      instagramStats: parseJson(client.instagramStats, {}),
      config: parseJson(client.config, {}),
    },
    owners,
    posts: postRows.map((post) => ({
      ...post,
      feedImages: parseJson(post.feedImages, []).map((url: string) => tokenData?.id && /^\/api\/media\/assets\/([^/]+)\/content$/.test(url)
        ? `/api/public/review/${encodeURIComponent(tokenData.id)}/media/${encodeURIComponent(url.match(/^\/api\/media\/assets\/([^/]+)\/content$/)![1])}`
        : url),
      comments: commentsByPost[String(post.id)] || [],
    })),
  };
}

export async function getReviewData(token: string) {
  const tokenData = await validateReviewToken(token);
  if (isReviewDataError(tokenData)) return tokenData;
  return buildReviewData(tokenData.clientId, tokenData.month, tokenData);
}

export async function getPresentationData(clientId: string, month: string) {
  if (!clientId || !/^\d{4}-\d{2}$/.test(month)) {
    return { error: 'Apresentação inválida.', status: 400 } as ReviewDataError;
  }

  return buildReviewData(clientId, month);
}
