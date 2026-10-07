import crypto from "node:crypto";

/** Converte placeholders "?" para "$1, $2, ..." do PostgreSQL */
export function toPostgresSql(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

/** Converte colunas agregadas e normaliza identificadores para camelCase esperado pelo frontend */
export function normalizeRow(row: any): any {
  if (!row || typeof row !== "object") return row;
  const normalized: any = { ...row };
  for (const key of Object.keys(normalized)) {
    if (key === "count" || key.endsWith("_count")) {
      const parsed = Number(normalized[key]);
      if (!isNaN(parsed)) {
        normalized[key] = parsed;
      }
    }
  }

  // Normalização de casing do PostgreSQL para chaves camelCase consumidas no frontend
  const img = normalized.imageUrl ?? normalized.image_url ?? normalized.imageurl ?? "";
  normalized.imageUrl = img;
  normalized.image_url = img;

  const funnel = normalized.funnelStage ?? normalized.funnel_stage ?? normalized.funnelstage ?? "Topo";
  normalized.funnelStage = funnel;
  normalized.funnel_stage = funnel;

  const notes = normalized.internalNotes ?? normalized.internal_notes ?? normalized.internalnotes ?? "";
  normalized.internalNotes = notes;
  normalized.internal_notes = notes;

  const isCollabVal = normalized.isCollab ?? normalized.is_collab ?? normalized.iscollab;
  normalized.isCollab = Boolean(Number(isCollabVal) || isCollabVal === true || isCollabVal === "1");
  normalized.is_collab = normalized.isCollab ? 1 : 0;

  const collabProf = normalized.collabProfile ?? normalized.collab_profile ?? normalized.collabprofile ?? "";
  normalized.collabProfile = collabProf;
  normalized.collab_profile = collabProf;

  const logo = normalized.logoUrl ?? normalized.logo_url ?? normalized.logourl ?? "";
  if (logo) {
    normalized.logoUrl = logo;
    normalized.logo_url = logo;
  }

  const clientLogo = normalized.clientLogoUrl ?? normalized.client_logo_url ?? normalized.clientlogourl ?? "";
  if (clientLogo) {
    normalized.clientLogoUrl = clientLogo;
    normalized.client_logo_url = clientLogo;
  }

  const orderIdx = normalized.orderIndex ?? normalized.order_index ?? 0;
  normalized.orderIndex = Number(orderIdx) || 0;
  normalized.order_index = normalized.orderIndex;

  const comment = normalized.clientComment ?? normalized.client_comment ?? normalized.clientcomment ?? "";
  normalized.clientComment = comment;
  normalized.client_comment = comment;

  const isExtraVal = normalized.isExtra ?? normalized.is_extra ?? normalized.isextra;
  normalized.isExtra = Boolean(Number(isExtraVal) === 1 || isExtraVal === true || isExtraVal === "1");
  normalized.is_extra = normalized.isExtra ? 1 : 0;

  const extraFmt = normalized.extraFormat ?? normalized.extra_format ?? normalized.extraformat ?? "";
  normalized.extraFormat = extraFmt;
  normalized.extra_format = extraFmt;

  const token = normalized.shareToken ?? normalized.share_token ?? normalized.sharetoken ?? "";
  normalized.shareToken = token;
  normalized.share_token = token;

  const feedback = normalized.clientFeedback ?? normalized.client_feedback ?? normalized.clientfeedback ?? "";
  normalized.clientFeedback = feedback;
  normalized.client_feedback = feedback;

  const feedbackStatus = normalized.clientFeedbackStatus ?? normalized.client_feedback_status ?? normalized.clientfeedbackstatus ?? "";
  normalized.clientFeedbackStatus = feedbackStatus;
  normalized.client_feedback_status = feedbackStatus;

  const feedbackAt = normalized.clientFeedbackAt ?? normalized.client_feedback_at ?? normalized.clientfeedbackat ?? "";
  normalized.clientFeedbackAt = feedbackAt;
  normalized.client_feedback_at = feedbackAt;

  const isPreBool = Boolean(
    Number(normalized.is_pre_calendar) === 1 ||
    normalized.is_pre_calendar === true ||
    normalized.is_pre_calendar === "1" ||
    Number(normalized.isPreCalendar) === 1 ||
    normalized.isPreCalendar === true ||
    normalized.isPreCalendar === "1" ||
    Number(normalized.isprecalendar) === 1 ||
    normalized.isprecalendar === true ||
    normalized.isprecalendar === "1" ||
    Number(normalized.client_has_pre_calendar) === 1 ||
    normalized.client_has_pre_calendar === true ||
    normalized.client_has_pre_calendar === "1" ||
    Number(normalized.has_pre_calendar) === 1 ||
    normalized.has_pre_calendar === true ||
    normalized.has_pre_calendar === "1"
  );
  normalized.is_pre_calendar = isPreBool ? 1 : 0;
  normalized.isPreCalendar = isPreBool;

  if (normalized.client_segment && !normalized.segment) {
    normalized.segment = normalized.client_segment;
  }
  if (normalized.client_tone && !normalized.tone) {
    normalized.tone = normalized.client_tone;
  }
  if (normalized.client_audience && !normalized.audience) {
    normalized.audience = normalized.client_audience;
  }

  return normalized;
}

/** Achata parâmetros caso sejam passados como array único ou lista de argumentos */
export function flattenParams(params: any[]): any[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

/** Gera um salt aleatório e armazena a senha como `salt:hash` usando scrypt. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Recalcula o scrypt e compara os hashes em tempo constante; formato inválido falha fechado. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
  } catch {
    return false;
  }
}
