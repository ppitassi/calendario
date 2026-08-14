import axios from "axios";
import { API_URL } from "./core";

export type WorkItemType="PROJECT"|"DEMAND"|"TASK";
export async function listWorkItems(filters:Record<string,string>={}){return(await axios.get(`${API_URL}/work-items`,{params:filters})).data;}
export async function getWorkItem(id:string){return(await axios.get(`${API_URL}/work-items/${id}`)).data;}
export async function createWorkItem(input:{type:WorkItemType;title:string;description?:string;clientId?:string|null;parentId?:string|null;dueAt?:string|null;priority?:string}){return(await axios.post(`${API_URL}/work-items`,input)).data;}
export async function updateWorkItem(id:string,patch:Record<string,unknown>){return(await axios.patch(`${API_URL}/work-items/${id}`,patch)).data;}
export async function moveWorkItem(id:string,parentId:string|null,clientId?:string|null){return(await axios.post(`${API_URL}/work-items/${id}/move`,{parentId,clientId})).data;}
export async function addWorkItemAssignee(id:string,userId:string,role?:string,isPrimary=false){return(await axios.post(`${API_URL}/work-items/${id}/assignees`,{userId,role,isPrimary})).data;}
export async function getWorkItemEvents(id:string){return(await axios.get(`${API_URL}/work-items/${id}/events`)).data;}
export async function getCapability(id:string,name:string){return(await axios.get(`${API_URL}/work-items/${id}/${name}`)).data;}
export async function saveCapability(id:string,name:string,data:Record<string,unknown>){return(await axios.put(`${API_URL}/work-items/${id}/${name}`,data)).data;}
export async function addChecklistItem(id:string,data:Record<string,unknown>){return(await axios.post(`${API_URL}/work-items/${id}/checklists`,data)).data;}
export async function toggleChecklistItem(id:string,checklistId:string,completed:boolean){return(await axios.patch(`${API_URL}/work-items/${id}/checklists`,{id:checklistId,completed})).data;}
export async function addComment(id:string,body:string){return(await axios.post(`${API_URL}/work-items/${id}/comments`,{body})).data;}
export async function transitionExternalOperation(id:string,status:string,data?:Record<string,unknown>){return(await axios.post(`${API_URL}/work-items/${id}/external-operation/transition`,{status,data})).data;}
export async function addExternalLocation(id:string,data:Record<string,unknown>){return(await axios.post(`${API_URL}/work-items/${id}/external-operation/locations`,data)).data;}
export async function listWorkItemAssets(id:string){return(await axios.get(`${API_URL}/work-items/${id}/assets`)).data;}
export async function uploadWorkItemAsset(id:string,file:File,category="GENERAL"){const form=new FormData();form.append("file",file);form.append("category",category);return(await axios.post(`${API_URL}/work-items/${id}/assets`,form)).data;}
export async function deleteWorkItemAsset(id:string,assetId:string){return(await axios.delete(`${API_URL}/work-items/${id}/assets/${assetId}`)).data;}

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
  return (await axios.post(`${API_URL}/work-items/${postId}/workflow`,{toStageKey:"WAITING_APPROVAL"})).data;
}

export async function requestPostChanges(
  postId: string | number,
  reason: string,
): Promise<any> {
  return (
    await axios.post(`${API_URL}/work-items/${postId}/workflow`,{toStageKey:"CHANGES_REQUESTED",reason})
  ).data;
}

export async function overridePostAssignment(
  postId: string | number,
  payload: any,
): Promise<any> {
  return (await axios.post(`${API_URL}/work-items/${postId}/assignees`, {
    userId: payload.assignedToUserId || payload.userId,
    role: payload.role,
    isPrimary: true,
  })).data;
}

export async function getPostWorkItem(postId: string | number): Promise<any> {
  return getWorkItem(String(postId));
}

export async function getPostActivity(postId: string | number): Promise<any[]> {
  return (await axios.get(`${API_URL}/work-items/${postId}/events`))
    .data;
}

export async function getPostRevisions(postId: string | number): Promise<any[]> {
  return (await axios.get(`${API_URL}/work-items/${postId}/content-versions`))
    .data;
}

export async function getPostAssignments(postId: string | number): Promise<any[]> {
  return (
    await axios.get(`${API_URL}/work-items/${postId}/assignees`)
  ).data;
}

export async function assignPost(
  postId: string | number,
  assignedToUserId: string,
  reason?: string,
): Promise<any> {
  return (
    await axios.post(`${API_URL}/work-items/${postId}/assignees`, {
      userId: assignedToUserId,
      isPrimary: true,
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
  const stageKeys:Record<string,string>={aguardando_design:"WAITING_DESIGN",revisao_interna:"INTERNAL_REVIEW",aguardando_aprovacao:"WAITING_APPROVAL",alteracoes_solicitadas:"CHANGES_REQUESTED",aprovado:"APPROVED",agendado:"SCHEDULED",publicado:"PUBLISHED",arquivado:"ARCHIVED",cancelado:"CANCELLED"};
  return (
    await axios.post(`${API_URL}/work-items/${postId}/workflow`, {
      toStageKey: stageKeys[toStage] || toStage.toUpperCase(),
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
