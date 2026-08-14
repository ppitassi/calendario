import axios from "axios";
import { format, addDays } from "date-fns";
import { ApprovalToken } from "../../types";
import { API_URL, downloadPdf } from "./core";

export async function createToken(token: ApprovalToken): Promise<ApprovalToken> {
  return (await axios.post(`${API_URL}/tokens`, token)).data;
}

export async function getTokens(params: {
  clientId?: string;
  month?: string;
  status?: string;
}): Promise<ApprovalToken[]> {
  const response = await axios.get(`${API_URL}/tokens`, { params });
  return response.data.map((token: ApprovalToken) => ({
    ...token,
    expiresAt: new Date(token.expiresAt).getTime(),
  }));
}

export async function submitPublicReviewAction(
  token: string,
  action: "approve" | "request_changes",
  note?: string,
): Promise<any> {
  const response = await axios.post(
    `${API_URL}/public/review/${token}/action`,
    { action, note },
  );
  return response.data;
}

export async function createApprovalToken(
  clientId: string,
  date: Date,
): Promise<ApprovalToken> {
  const monthStr = format(date, "yyyy-MM");
  const newToken: ApprovalToken = {
    id: "",
    clientId,
    month: monthStr,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: addDays(new Date(), 30).getTime(),
  };

  return createToken(newToken);
}

export async function getPublicPostComments(token: string, postId: number): Promise<any[]> {
  const response = await axios.get(
    `${API_URL}/public/review/${token}/posts/${postId}/comments`,
  );
  return response.data;
}

export async function addPublicPostComment(
  token: string,
  postId: number,
  authorName: string,
  content: string,
): Promise<any> {
  const response = await axios.post(
    `${API_URL}/public/review/${token}/posts/${postId}/comments`,
    { authorName, content },
  );
  return response.data;
}

export function getReviewExportUrl(token: string): string {
  return `${window.location.origin}/review/${token}/export`;
}

export function getPresentationExportUrl(clientId: string, date: Date): string {
  const month = format(date, "yyyy-MM");
  return `${window.location.origin}/presentation/${encodeURIComponent(clientId)}/${month}/export`;
}

export async function downloadPresentationPdf(clientId: string, date: Date): Promise<void> {
  const month = format(date, "yyyy-MM");
  const response = await axios.post(`${API_URL}/presentation/${encodeURIComponent(clientId)}/${month}/pdf-jobs`);
  await waitForPdf(response.data.jobId, `${API_URL}/presentation/pdf-jobs`, `Planejamento - ${month}.pdf`);
}

export async function downloadReviewPdf(token: string): Promise<void> {
  const response = await axios.post(`${API_URL}/public/review/${encodeURIComponent(token)}/pdf-jobs`);
  await waitForPdf(response.data.jobId, `${API_URL}/public/review/${encodeURIComponent(token)}/pdf-jobs`, "Planejamento.pdf");
}

async function waitForPdf(jobId: string, baseUrl: string, fileName: string) {
  if (!jobId) throw new Error("O servidor não retornou o trabalho de PDF.");
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const { data } = await axios.get(`${baseUrl}/${encodeURIComponent(jobId)}`);
    if (data.status === "ready" && data.downloadUrl) { await downloadPdf(data.downloadUrl, fileName); return; }
    if (data.status === "failed" || data.status === "expired") throw new Error(data.error || "A geração do PDF falhou.");
    window.dispatchEvent(new CustomEvent("pdf-job-progress", { detail: { jobId, status: data.status, progress: data.progress } }));
    await new Promise(resolve => window.setTimeout(resolve, 1500));
  }
  throw new Error("A geração do PDF excedeu o tempo de espera. Ela pode ser consultada novamente.");
}

export async function sendReviewWhatsApp(token: string): Promise<void> {
  await axios.post(`${API_URL}/public/review/${token}/send-whatsapp`);
}
