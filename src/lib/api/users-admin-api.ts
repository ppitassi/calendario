import axios from "axios";
import { UserProfile } from "../../types";
import { auth } from "../auth";
import { API_URL } from "./core";

export async function getUsers(): Promise<UserProfile[]> {
  const response = await axios.get(`${API_URL}/users`);
  return response.data.map((user: any) => ({ ...user, phoneNumber: user.phoneNumber || user.whatsapp || "" }));
}

export async function getTeamMembers(): Promise<UserProfile[]> {
  const response = await axios.get(`${API_URL}/team/members`);
  return response.data.map((user: any) => ({ ...user, phoneNumber: user.phoneNumber || user.whatsapp || "" }));
}

export async function saveUser(user: UserProfile): Promise<void> {
  await axios.post(`${API_URL}/users`, user);
}

export async function getOwnProfile(): Promise<UserProfile> {
  const response = await axios.get(`${API_URL}/users/me`);
  return response.data;
}

export async function updateOwnProfile(
  profile: Pick<
    UserProfile,
    | "displayName"
    | "birthday"
    | "githubUsername"
    | "portfolioUrl"
    | "photoURL"
  > & { photoAssetId?: string | null },
): Promise<UserProfile> {
  const response = await axios.patch(`${API_URL}/users/me`, {
    displayName: profile.displayName?.trim(),
    birthday: profile.birthday || null,
    githubUsername: profile.githubUsername?.trim() || null,
    portfolioUrl: profile.portfolioUrl?.trim() || null,
    photoURL: profile.photoURL || null,
    ...(profile.photoAssetId ? { photoAssetId: profile.photoAssetId } : {}),
  });
  return response.data;
}

export async function getCustomRoles(): Promise<any[]> {
  const response = await axios.get(`${API_URL}/custom-roles`);
  return response.data;
}

export async function saveCustomRole(role: any): Promise<void> {
  await axios.post(`${API_URL}/custom-roles`, role);
}

export async function saveCustomRoles(roles: any[]): Promise<void> {
  await Promise.all(roles.map((r) => saveCustomRole(r)));
}

export async function saveAgencySettings(data: any): Promise<void> {
  await axios.post(`${API_URL}/agency/settings`, data);
}

export async function deleteUser(uid: string): Promise<void> {
  await axios.delete(`${API_URL}/users/${uid}`);
}

export async function getSettings(id: string): Promise<any> {
  const response = await axios.get(`${API_URL}/settings/${id}`);
  return response.data;
}

export async function saveSettings(id: string, data: any): Promise<void> {
  await axios.post(`${API_URL}/settings/${id}`, data);
}

export async function updateAgencySettings(data: {
  deadline?: string;
  name?: string;
  slogan?: string;
  logo_url?: string;
  logo_dark_url?: string;
  theme_config?: any;
  planning_month?: string;
  deadline_pre?: string;
  deadline_final?: string;
}): Promise<void> {
  await axios.post(`${API_URL}/agency/settings`, data);
}

export async function getHolidays(year: number): Promise<any[]> {
  const res = await axios.get(`${API_URL}/holidays/${year}`);
  return res.data;
}

export async function getAgencies(): Promise<any[]> {
  const res = await axios.get(`${API_URL}/agencies`);
  return res.data;
}

export async function getAgencySettings(id: string): Promise<any> {
  const res = await axios.get(`${API_URL}/agency/settings/${id}`);
  return res.data;
}

export async function getUiPreferences(): Promise<any> {
  const res = await axios.get(`${API_URL}/users/preferences`);
  return res.data || {};
}

export async function updateUiPreferences(patch: Record<string, any>): Promise<any> {
  const res = await axios.post(`${API_URL}/users/preferences`, patch);
  if (auth.currentUser) auth.currentUser.ui_preferences = res.data || {};
  return res.data || {};
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await axios.post(`${API_URL}/users/change-password`, {
    currentPassword,
    newPassword,
  });
}
