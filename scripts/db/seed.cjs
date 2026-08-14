const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { options, mysql } = require("./connection.cjs");

const id = (key) => crypto.createHash("sha256").update(`content-planner:${key}`).digest("hex").slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, "$1-$2-$3-$4-$5");

const permissionKeys = [
  "CLIENT_CREATE", "CLIENT_EDIT", "CLIENT_ARCHIVE", "PROJECT_CREATE", "PROJECT_MANAGE",
  "DEMAND_CREATE", "DEMAND_ASSIGN", "DEMAND_MANAGE", "TASK_CREATE", "TASK_ASSIGN", "TASK_MANAGE",
  "CONTENT_EDIT", "CONTENT_REVIEW", "APPROVAL_MANAGE", "EXTERNAL_OPERATION_PLAN",
  "EXTERNAL_OPERATION_EXECUTE", "EXTERNAL_OPERATION_MONITOR", "USER_MANAGE", "SYSTEM_SETTINGS_MANAGE",
];
const roles = [
  ["ADMIN", "Admin"], ["DIRECTOR", "Diretoria"], ["MANAGEMENT", "Gestão"],
  ["ACCOUNT", "Atendimento"], ["SOCIAL_MEDIA", "Social Media"], ["DESIGNER", "Designer"],
  ["VIDEOMAKER", "Videomaker"], ["PHOTOGRAPHER", "Fotógrafo"], ["COPYWRITER", "Copywriter"],
];
const channels = [["INSTAGRAM", "Instagram"], ["FACEBOOK", "Facebook"], ["TIKTOK", "TikTok"], ["LINKEDIN", "LinkedIn"], ["YOUTUBE", "YouTube"]];
const formats = [["FEED", "Feed"], ["STORY", "Story"], ["FEED_STORY", "Feed + Story"], ["REEL", "Reel"], ["CAROUSEL", "Carrossel"], ["VIDEO", "Vídeo"], ["SHORT", "Short"]];
const stages = [
  ["BRIEFING", "Briefing", "TODO"], ["COPY", "Copy", "IN_PROGRESS"],
  ["WAITING_DESIGN", "Aguardando Design", "TODO"], ["DESIGN", "Design", "IN_PROGRESS"],
  ["INTERNAL_REVIEW", "Revisão Interna", "REVIEW"], ["WAITING_APPROVAL", "Aguardando Aprovação", "REVIEW"],
  ["APPROVAL", "Aprovação", "REVIEW"], ["CHANGES_REQUESTED", "Alterações Solicitadas", "IN_PROGRESS"],
  ["APPROVED", "Aprovado", "DONE"], ["SCHEDULED", "Agendado", "DONE"],
  ["PUBLISHED", "Publicado", "DONE"], ["CANCELLED", "Cancelado", "CANCELLED"], ["ARCHIVED", "Arquivado", "CANCELLED"],
];

(async () => {
  const db = await mysql.createConnection(options());
  const password = process.env.ADMIN_INITIAL_PASSWORD || "ChangeMe!2026";
  if ((process.env.NODE_ENV === "production" || process.env.VERCEL) && !process.env.ADMIN_INITIAL_PASSWORD) {
    throw new Error("ADMIN_INITIAL_PASSWORD é obrigatória em produção");
  }
  const adminId = id("user:admin");
  await db.query(
    `INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), active=TRUE`,
    [adminId, process.env.ADMIN_INITIAL_NAME || "Administrador", process.env.ADMIN_INITIAL_EMAIL || "admin@contentplanner.local", await bcrypt.hash(password, 12)],
  );
  for (const key of permissionKeys) {
    await db.query("INSERT IGNORE INTO permissions (id,key_name,description) VALUES (?,?,?)", [id(`permission:${key}`), key, key.replaceAll("_", " ")]);
  }
  for (const [key, name] of roles) {
    await db.query("INSERT IGNORE INTO roles (id,key_name,name,system_role) VALUES (?,?,?,TRUE)", [id(`role:${key}`), key, name]);
  }
  const adminRole = id("role:ADMIN");
  await db.query("INSERT IGNORE INTO user_roles (user_id,role_id,assigned_by) VALUES (?,?,?)", [adminId, adminRole, adminId]);
  await db.query("INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT ?,id FROM permissions", [adminRole]);
  for (const [key, name] of channels) await db.query("INSERT IGNORE INTO social_channels (id,key_name,name) VALUES (?,?,?)", [id(`channel:${key}`), key, name]);
  for (const [key, name] of formats) await db.query("INSERT IGNORE INTO content_formats (id,key_name,name) VALUES (?,?,?)", [id(`format:${key}`), key, name]);
  const workflowId = id("workflow:EDITORIAL");
  await db.query("INSERT IGNORE INTO workflow_templates (id,key_name,name,description) VALUES (?,?,?,?)", [workflowId, "EDITORIAL", "Editorial", "Workflow editorial padrão"]);
  for (let index = 0; index < stages.length; index += 1) {
    const [key, name, status] = stages[index];
    await db.query("INSERT IGNORE INTO workflow_stages (id,workflow_template_id,key_name,name,maps_to_status,sort_order,terminal) VALUES (?,?,?,?,?,?,?)", [id(`stage:${key}`), workflowId, key, name, status, index, ["PUBLISHED", "CANCELLED", "ARCHIVED"].includes(key)]);
  }
  for (let index = 0; index < 10; index += 1) {
    const from = stages[index][0]; const to = stages[index + 1][0];
    await db.query("INSERT IGNORE INTO workflow_transitions (id,workflow_template_id,from_stage_id,to_stage_id) VALUES (?,?,?,?)", [id(`transition:${from}:${to}`), workflowId, id(`stage:${from}`), id(`stage:${to}`)]);
  }
  for (const from of ["INTERNAL_REVIEW", "WAITING_APPROVAL", "APPROVAL"]) {
    await db.query("INSERT IGNORE INTO workflow_transitions (id,workflow_template_id,from_stage_id,to_stage_id) VALUES (?,?,?,?)", [id(`transition:${from}:CHANGES_REQUESTED`), workflowId, id(`stage:${from}`), id("stage:CHANGES_REQUESTED")]);
  }
  await db.query("INSERT IGNORE INTO workflow_transitions (id,workflow_template_id,from_stage_id,to_stage_id) VALUES (?,?,?,?)", [id("transition:CHANGES_REQUESTED:DESIGN"), workflowId, id("stage:CHANGES_REQUESTED"), id("stage:DESIGN")]);
  await db.query("INSERT IGNORE INTO agency_profile (singleton_id,name,timezone) VALUES (1,?,?)", [process.env.AGENCY_NAME || "Agência", process.env.APP_TIMEZONE || "America/Sao_Paulo"]);
  await db.query("INSERT IGNORE INTO system_settings (key_name,value_json) VALUES ('app', JSON_OBJECT('timezone', ?, 'locale', 'pt-BR'))", [process.env.APP_TIMEZONE || "America/Sao_Paulo"]);
  const tokens = [["BG_COLOR", "#0b1020", "COLOR"], ["PRIMARY_COLOR", "#6d5dfc", "COLOR"], ["FONT_PRIMARY", "Inter, sans-serif", "FONT"], ["RADIUS_MD", "12px", "SIZE"], ["BLUR_MD", "16px", "SIZE"]];
  for (const [key, value, type] of tokens) await db.query("INSERT IGNORE INTO design_tokens (id,key_name,value_text,type,updated_by) VALUES (?,?,?,?,?)", [id(`token:${key}`), key, value, type, adminId]);
  await db.end();
  console.log(`seed concluído; admin=${process.env.ADMIN_INITIAL_EMAIL || "admin@contentplanner.local"}${process.env.ADMIN_INITIAL_PASSWORD ? "" : "; senha local padrão=ChangeMe!2026"}`);
})().catch((error) => { console.error(error.message); process.exit(1); });
