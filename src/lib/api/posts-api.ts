import axios from "axios";
import { PostData } from "../../types";
import { normalizeDate } from "../../../lib/date-utils";
import { API_URL, notifyPostsUpdated } from "./core";

export async function getAllPosts(): Promise<PostData[]> {
  const response = await axios.get(`${API_URL}/posts`);
  return response.data;
}

export async function getPosts(clientId: string): Promise<Record<string, PostData>> {
  if (!clientId) return {};
  const response = await axios.get(`${API_URL}/posts/${clientId}`);
  const posts: Record<string, PostData> = {};
  response.data.forEach((post: any) => {
    const dateStr = normalizeDate(post.date);
    if (!dateStr) return;
    const key = posts[dateStr] ? `${dateStr}#${post.id}` : dateStr;
    posts[key] = {
      ...post,
      feedImages: Array.isArray(post.feedImages) ? post.feedImages : [],
      comments: post.comments || [],
    };
  });
  return posts;
}

export async function savePost(
  clientId: string,
  date: string,
  post: PostData,
): Promise<{ id: string; date: string; workVersion?: number }> {
  const dateStr = normalizeDate(date || post.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    throw new Error("Data de postagem invalida.");
  const data = {
    ...post,
    clientId,
    date: dateStr,
    feedImages: post.feedImages || [],
  };
  const response = await axios.post(`${API_URL}/posts`, data);
  notifyPostsUpdated();
  return response.data;
}

export async function generatePostFields(clientId: string, post: PostData): Promise<any> {
  const response = await axios.post(`${API_URL}/generate-objective`, {
    clientId,
    post,
  });
  return response.data.results?.[0];
}

export async function generateMonthFields(
  clientId: string,
  posts: PostData[],
): Promise<any[]> {
  const response = await axios.post(`${API_URL}/generate-objective`, {
    clientId,
    posts,
    mode: "batch",
  });
  return response.data.results || [];
}

export async function deletePostsBulk(clientId: string, dates: string[]): Promise<void> {
  await axios.post(`${API_URL}/posts-bulk/${clientId}`, { dates });
  notifyPostsUpdated();
}

export async function getPostComments(postId: number): Promise<any[]> {
  const response = await axios.get(`${API_URL}/posts/${postId}/comments`);
  return response.data;
}

export async function addPostComment(postId: number, content: string): Promise<any> {
  const response = await axios.post(`${API_URL}/posts/${postId}/comments`, {
    content,
  });
  return response.data;
}
