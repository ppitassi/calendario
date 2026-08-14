import { parseJson } from "./db";

export function normalizeFeedImages(value: unknown): string[] {
  const parsed = typeof value === "string" ? parseJson(value, []) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

export function publicPost<T extends Record<string, unknown>>(
  post: T,
): T & { feedImages: string[] } {
  return { ...post, feedImages: normalizeFeedImages(post.feedImages) };
}
