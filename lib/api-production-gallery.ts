import { NextRequest, NextResponse } from "next/server";
import { rows } from "./db";
import { ok } from "./api-response";
import { publicPost } from "./post-data";

const MAX_PAGE_SIZE = 100;

type GalleryFilters = {
  search: string;
  clientId: string;
  month: string;
  status: string;
  members: string[];
  format: string;
};

function positiveInteger(
  value: string | null,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, max)
    : fallback;
}

function readFilters(url: URL): GalleryFilters {
  return {
    search: (url.searchParams.get("search") || "").trim().slice(0, 150),
    clientId: (url.searchParams.get("clientId") || "").trim(),
    month: (url.searchParams.get("month") || "").trim(),
    status: (url.searchParams.get("status") || "").trim(),
    members: url.searchParams.getAll("member").map(String).filter(Boolean),
    format: (url.searchParams.get("format") || "").trim(),
  };
}

function galleryWhere(filters: GalleryFilters) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    clauses.push("CONCAT_WS(' ', p.title, p.head, p.subhead, c.name) LIKE ?");
    params.push(`%${filters.search}%`);
  }
  if (filters.clientId) {
    clauses.push("p.clientId = ?");
    params.push(filters.clientId);
  }
  if (/^\d{4}-\d{2}$/.test(filters.month)) {
    clauses.push("DATE_FORMAT(p.date, '%Y-%m') = ?");
    params.push(filters.month);
  }
  if (filters.format) {
    clauses.push("p.type = ?");
    params.push(filters.format);
  }
  if (filters.members.length) {
    clauses.push(
      `COALESCE(p.currentAssigneeId, p.assigneeId, '') IN (${filters.members.map(() => "?").join(",")})`,
    );
    params.push(...filters.members);
  }
  if (filters.status === "overdue") {
    clauses.push(
      "p.dueDate < NOW() AND COALESCE(p.currentStage, '') NOT IN ('aprovado','publicado','arquivado')",
    );
  } else if (filters.status === "unassigned") {
    clauses.push("COALESCE(p.currentAssigneeId, p.assigneeId, '') = ''");
  } else if (filters.status) {
    clauses.push("p.currentStage = ?");
    params.push(filters.status);
  }

  return { sql: clauses.join(" AND "), params };
}

export async function handleProductionGalleryApi(
  method: string,
  route: string,
  req: NextRequest,
): Promise<NextResponse | null> {
  if (route !== "/production-gallery" || method !== "GET") return null;

  const url = new URL(req.url);
  const page = positiveInteger(url.searchParams.get("page"), 1);
  const pageSize = positiveInteger(
    url.searchParams.get("pageSize"),
    40,
    MAX_PAGE_SIZE,
  );
  const filters = readFilters(url);
  const where = galleryWhere(filters);
  const offset = (page - 1) * pageSize;

  const [posts, countRows, clients, members] = await Promise.all([
    rows(
      `SELECT p.*, DATE_FORMAT(p.date, '%Y-%m-%d') AS date
       FROM posts p
       LEFT JOIN clients c ON c.id = p.clientId
       ${where.sql ? `WHERE ${where.sql}` : ""}
       ORDER BY p.date DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...where.params, pageSize, offset],
    ),
    rows(
      `SELECT COUNT(*) AS total
       FROM posts p
       LEFT JOIN clients c ON c.id = p.clientId
       ${where.sql ? `WHERE ${where.sql}` : ""}`,
      where.params,
    ),
    rows(
      "SELECT id,name,logoUrl FROM clients ORDER BY name",
    ),
    rows(
      "SELECT uid,displayName,email,photoURL,role FROM users ORDER BY displayName,email",
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return ok({
    items: posts.map((post) => publicPost(post)),
    total,
    totalPages: Math.ceil(total / pageSize),
    hasNextPage: offset + posts.length < total,
    page,
    pageSize,
    clients,
    members,
  });
}
