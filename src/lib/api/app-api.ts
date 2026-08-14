import axios from "axios";
import { API_URL, ProductionGalleryFilters, ProductionGalleryResponse } from "./core";

export async function login(credentials: any) { return (await axios.post(`${API_URL}/auth/login`, credentials)).data; }
export async function validateToken() { return (await axios.post(`${API_URL}/auth/validate-token`, {})).data; }
export async function recordActivity(foregroundSeconds: number) { await axios.post(`${API_URL}/auth/activity`, { foregroundSeconds, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: navigator.language }); }
export async function logout() { await axios.post(`${API_URL}/auth/logout`); }
export async function getDashboardData() { return (await axios.get(`${API_URL}/dashboard`)).data; }
export async function getDashboardLayout() { return (await axios.get(`${API_URL}/dashboard/layout`)).data as { layoutVersion: number; schemaVersion: number; layoutJson: any[]; updatedAt?: string }; }
export async function saveDashboardLayout(layoutJson: any[], expectedLayoutVersion?: number) { return (await axios.put(`${API_URL}/dashboard/layout`, { layoutJson, expectedLayoutVersion })).data; }
export async function resetDashboardLayout() { return (await axios.delete(`${API_URL}/dashboard/layout`)).data; }
export async function getPerformanceStats(userId?: string) { return (await axios.get(`${API_URL}/users/me/performance-stats`, { params: userId ? { userId, period: "current_month" } : { period: "current_month" } })).data; }
export async function chatWithLeia(clientId: string | null, message: string, history: Array<{ sender: string; text: string }>) { return (await axios.post(`${API_URL}/leia/chat`, { clientId, message, history })).data.response as string; }
export async function geolocate() { return (await axios.get(`${API_URL}/geolocate`)).data; }
export async function getProductionGallery(filters: ProductionGalleryFilters = {}) { const response = await axios.get(`${API_URL}/production-gallery`, { params: { ...filters, members: filters.members?.join(",") } }); return response.data as ProductionGalleryResponse; }
