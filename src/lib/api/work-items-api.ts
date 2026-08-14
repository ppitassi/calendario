import axios from "axios";
import { API_URL } from "./core";

export async function getPlanningWorkflow(planningId: string): Promise<any> {
  return (await axios.get(`${API_URL}/plannings/${planningId}`)).data;
}

export async function sendPlanningToDesign(planningId: string): Promise<any> {
  return (
    await axios.post(`${API_URL}/plannings/${planningId}/send-to-design`)
  ).data;
}

export async function completePlanning(planningId: string): Promise<any> {
  return (await axios.post(`${API_URL}/plannings/${planningId}/complete`))
    .data;
}

export async function sendPlanningToApproval(planningId: string): Promise<any> {
  return (
    await axios.post(`${API_URL}/plannings/${planningId}/send-to-approval`)
  ).data;
}

export async function markPostAwaitingApproval(postId: string | number): Promise<any> {
  return (
    await axios.post(
      `${API_URL}/work-items/posts/${postId}/mark-awaiting-approval`,
    )
  ).data;
}

export async function requestPostChanges(
  postId: string | number,
  reason: string,
): Promise<any> {
  return (
    await axios.post(
      `${API_URL}/work-items/posts/${postId}/request-changes`,
      { reason },
    )
  ).data;
}

export async function overridePostAssignment(
  postId: string | number,
  payload: any,
): Promise<any> {
  return (
    await axios.post(
      `${API_URL}/work-items/posts/${postId}/override-assignment`,
      payload,
    )
  ).data;
}

export async function getPostWorkItem(postId: string | number): Promise<any> {
  return (await axios.get(`${API_URL}/work-items/posts/${postId}`)).data;
}

export async function getPostActivity(postId: string | number): Promise<any[]> {
  return (await axios.get(`${API_URL}/work-items/posts/${postId}/activity`))
    .data;
}

export async function getPostRevisions(postId: string | number): Promise<any[]> {
  return (await axios.get(`${API_URL}/work-items/posts/${postId}/revisions`))
    .data;
}

export async function getPostAssignments(postId: string | number): Promise<any[]> {
  return (
    await axios.get(`${API_URL}/work-items/posts/${postId}/assignments`)
  ).data;
}

export async function assignPost(
  postId: string | number,
  assignedToUserId: string,
  reason?: string,
): Promise<any> {
  return (
    await axios.post(`${API_URL}/work-items/posts/${postId}/assign`, {
      assignedToUserId,
      reason,
    })
  ).data;
}

export async function transitionPost(
  postId: string | number,
  toStage: string,
  version?: number,
  reason?: string,
  assignedToUserId?: string,
): Promise<any> {
  return (
    await axios.post(`${API_URL}/work-items/posts/${postId}/transition`, {
      toStage,
      version,
      reason,
      assignedToUserId,
    })
  ).data;
}

export async function getArtworkVersions(postId: string | number): Promise<any[]> {
  return (
    await axios.get(`${API_URL}/work-items/posts/${postId}/artwork-versions`)
  ).data;
}

export async function createArtworkVersion(
  postId: string | number,
  mediaAssetIds: string[],
  notes?: string,
): Promise<any> {
  return (
    await axios.post(
      `${API_URL}/work-items/posts/${postId}/artwork-versions`,
      { mediaAssetIds, notes },
    )
  ).data;
}

export async function actOnArtworkVersion(
  postId: string | number,
  versionId: string | number,
  action: "submit" | "request-changes" | "approve",
  reason?: string,
): Promise<any> {
  return (
    await axios.post(
      `${API_URL}/work-items/posts/${postId}/artwork-versions/${versionId}/${action}`,
      { reason },
    )
  ).data;
}
