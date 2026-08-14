import axios from "axios";
import { ClientData } from "../../types";
import { API_URL, apiErrorMessage, isRecord } from "./core";

export async function getClients(): Promise<ClientData[]> {
  const endpoint = `${API_URL}/clients`;
  const response = await fetch(endpoint, {
    credentials: "include",
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      apiErrorMessage(payload, `GET ${endpoint} falhou com status ${response.status}.`),
    );
    console.error("[GET /clients]", {
      status: response.status,
      payload,
      error,
    });
    throw error;
  }
  const clients = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items)
      ? payload.items
      : [];
  return clients as ClientData[];
}

export async function getClient(clientId: string): Promise<ClientData | null> {
  if (!clientId) return null;
  const response = await axios.get(`${API_URL}/clients/${clientId}`);
  return response.data;
}

export async function saveClient(client: ClientData): Promise<string> {
  const response = await axios.post(`${API_URL}/clients`, client);
  return response.data.id || client.id;
}

export async function deleteClient(clientId: string): Promise<void> {
  await axios.delete(`${API_URL}/clients/${clientId}`);
}

export async function saveMetaAccount(
  clientId: string,
  connectionId: string,
  pageId: string | null,
): Promise<any> {
  const response = await axios.post(
    `${API_URL}/clients/${clientId}/meta-account`,
    { connectionId, pageId },
  );
  return response.data;
}
