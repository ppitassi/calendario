import 'server-only';
import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { getDbPool } from './db';
import { createNotificationEvent, resolvePostRecipients } from './notifications';

export const POST_STAGES = ['briefing','copy','aguardando_design','design','revisao_interna','aguardando_aprovacao','approval','alteracoes_solicitadas','aprovado','agendado','publicado','arquivado','cancelado'] as const;
export type PostStage = typeof POST_STAGES[number];
const TRANSITIONS: Record<PostStage, PostStage[]> = {
  briefing:['copy','cancelado'], copy:['aguardando_design','cancelado'], aguardando_design:['design','cancelado'],
  design:['revisao_interna','cancelado'], revisao_interna:['design','aguardando_aprovacao','cancelado'],
  aguardando_aprovacao:['approval','alteracoes_solicitadas','aprovado','cancelado'], approval:['alteracoes_solicitadas','aprovado','cancelado'], alteracoes_solicitadas:['design','cancelado'],
  aprovado:['agendado','arquivado'], agendado:['publicado','arquivado','cancelado'], publicado:['arquivado'], arquivado:[], cancelado:[]
};
const SNAPSHOT_FIELDS=['title','date','type','channel','head','subhead','subtitle','caption','objective','cta','hashtags','visualBriefing','internalNotes','funnelStage','currentStage','workflowStatus','currentAssigneeId','dueDate','priority'];
const db=()=>getDbPool();
export type WorkflowSession={userId:string;role:string;displayName:string};

export async function workflowSession(req:NextRequest):Promise<WorkflowSession|null>{
  const token=req.cookies.get('cp_session')?.value;if(!token)return null;
  const [r]:any=await db().query('SELECT uid userId,role,displayName FROM users WHERE session_token=? AND session_expires_at>NOW() LIMIT 1',[token]);
  return r[0]||null;
}
export async function accessiblePost(session:WorkflowSession,postId:string|number){
  const [r]:any=await db().query(`SELECT p.*,DATE_FORMAT(p.date,'%Y-%m-%d') date,c.owners,c.name clientName,
    u.displayName assigneeName,u.photoURL assigneePhoto FROM posts p JOIN clients c ON c.id=p.clientId
    LEFT JOIN users u ON u.uid=p.currentAssigneeId WHERE p.id=? LIMIT 1`,[postId]);
  const post=r[0];if(!post)return null;
  if(['admin','gerente','atendimento'].includes(session.role)||post.currentAssigneeId===session.userId||post.createdByUserId===session.userId)return post;
  let owners:any[]=[];try{owners=Array.isArray(post.owners)?post.owners:JSON.parse(post.owners||'[]')}catch{}
  return owners.map(x=>typeof x==='string'?x:x?.uid||x?.id).includes(session.userId)?post:null;
}
export async function recordPostActivity(connection:any,input:{postId:number;actorUserId?:string|null;eventType:string;summary:string;entityType?:string;entityId?:string|number|null;stageFrom?:string|null;stageTo?:string|null;assigneeFromId?:string|null;assigneeToId?:string|null;metadata?:any;correlationId?:string|null}){
  await connection.execute(`INSERT INTO post_activity_events(postId,actorUserId,eventType,entityType,entityId,stageFrom,stageTo,assigneeFromId,assigneeToId,summary,metadataJson,correlationId)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[input.postId,input.actorUserId||null,input.eventType,input.entityType||'post',input.entityId==null?null:String(input.entityId),input.stageFrom||null,input.stageTo||null,input.assigneeFromId||null,input.assigneeToId||null,input.summary.slice(0,700),input.metadata?JSON.stringify(input.metadata):null,input.correlationId||null]);
}
export async function createPostRevision(connection:any,post:any,userId:string,reason:string){
  const [[seq]]:any=await connection.query('SELECT COALESCE(MAX(revisionNumber),0)+1 revisionNumber FROM post_revisions WHERE postId=? FOR UPDATE',[post.id]);
  const snapshot=Object.fromEntries(SNAPSHOT_FIELDS.filter(k=>post[k]!==undefined).map(k=>[k,post[k]]));
  const [result]:any=await connection.execute('INSERT INTO post_revisions(postId,revisionNumber,createdByUserId,reason,stage,status,snapshotJson) VALUES(?,?,?,?,?,?,?)',[post.id,seq.revisionNumber,userId,reason,post.currentStage||'briefing',post.workflowStatus||'pending',JSON.stringify(snapshot)]);
  return {id:result.insertId,revisionNumber:seq.revisionNumber};
}
export async function assignPostToUser(session:WorkflowSession,postId:number,assignedToUserId:string,reason?:string,stage?:string,correlationId=randomBytes(16).toString('hex')){
  const pool=db(),connection=await pool.getConnection();let post:any,newUser:any;
  try{await connection.beginTransaction();const [[locked]]:any=await connection.query('SELECT * FROM posts WHERE id=? FOR UPDATE',[postId]);post=locked;if(!post)throw Object.assign(new Error('Postagem não encontrada.'),{status:404,code:'POST_NOT_FOUND'});
    const [[target]]:any=await connection.query('SELECT uid,displayName FROM users WHERE uid=? LIMIT 1',[assignedToUserId]);newUser=target;if(!target)throw Object.assign(new Error('Responsável inválido.'),{status:422,code:'INVALID_ASSIGNEE'});
    if(!['admin','gerente','atendimento'].includes(session.role)&&post.currentAssigneeId!==session.userId)throw Object.assign(new Error('Sem permissão para repassar esta postagem.'),{status:403,code:'FORBIDDEN'});
    await connection.execute('UPDATE post_assignments SET endedAt=NOW() WHERE postId=? AND endedAt IS NULL',[postId]);
    await connection.execute('INSERT INTO post_assignments(postId,assignedByUserId,assignedToUserId,previousAssigneeId,stage,reason) VALUES(?,?,?,?,?,?)',[postId,session.userId,assignedToUserId,post.currentAssigneeId||null,stage||post.currentStage||'briefing',reason?.slice(0,500)||null]);
    await connection.execute('UPDATE posts SET currentAssigneeId=?,assigneeId=?,assignedAt=NOW(),lastActivityAt=NOW(),workVersion=workVersion+1 WHERE id=?',[assignedToUserId,assignedToUserId,postId]);
    await recordPostActivity(connection,{postId,actorUserId:session.userId,eventType:'assignee_changed',summary:`${session.displayName} atribuiu a postagem a ${target.displayName}.`,assigneeFromId:post.currentAssigneeId,assigneeToId:assignedToUserId,stageTo:stage||post.currentStage,metadata:reason?{reason}:undefined,correlationId});
    await connection.commit();
  }catch(e){await connection.rollback();throw e}finally{connection.release()}
  void createNotificationEvent({actorUserId:session.userId,type:'post_assigned',category:'assignments',entityType:'post',entityId:postId,clientId:post.clientId,title:'Postagem atribuída',body:`${session.displayName} atribuiu uma postagem a você.`,route:`/?clientId=${encodeURIComponent(post.clientId)}&postId=${postId}`,recipientUserIds:[assignedToUserId],dedupeKey:`post-assignment:${postId}`}).catch(()=>{});
  return {success:true,assignee:{uid:assignedToUserId,displayName:newUser.displayName}};
}
export async function transitionPostStage(session:WorkflowSession,postId:number,toStage:PostStage,reason?:string,assignedToUserId?:string,expectedVersion?:number){
  if(!POST_STAGES.includes(toStage))throw Object.assign(new Error('Etapa inválida.'),{status:422,code:'INVALID_STAGE'});
  const connection=await db().getConnection(),correlationId=randomBytes(16).toString('hex');let post:any,revision:any;
  try{await connection.beginTransaction();const [[locked]]:any=await connection.query('SELECT * FROM posts WHERE id=? FOR UPDATE',[postId]);post=locked;if(!post)throw Object.assign(new Error('Postagem não encontrada.'),{status:404,code:'POST_NOT_FOUND'});
    if(expectedVersion!=null&&Number(post.workVersion)!==Number(expectedVersion))throw Object.assign(new Error('A postagem foi alterada por outro colaborador.'),{status:409,code:'POST_VERSION_CONFLICT'});
    const from=(post.currentStage||'briefing') as PostStage;if(!TRANSITIONS[from]?.includes(toStage)&&!(['admin','gerente'].includes(session.role)&&['arquivado','cancelado'].includes(toStage)))throw Object.assign(new Error('Transição não permitida para a etapa atual.'),{status:409,code:'INVALID_TRANSITION'});
    if(!['admin','gerente','atendimento'].includes(session.role)&&post.currentAssigneeId!==session.userId)throw Object.assign(new Error('Esta ação pertence ao responsável atual.'),{status:403,code:'FORBIDDEN'});
    if(['aguardando_design','revisao_interna','aguardando_aprovacao','alteracoes_solicitadas','aprovado'].includes(toStage))revision=await createPostRevision(connection,post,session.userId,`transition:${toStage}`);
    const status=toStage==='aprovado'?'approved':toStage==='alteracoes_solicitadas'?'changes_requested':toStage==='publicado'?'completed':'pending';
    await connection.execute('UPDATE posts SET currentStage=?,workflowStatus=?,stageEnteredAt=NOW(),lastActivityAt=NOW(),workVersion=workVersion+1 WHERE id=?',[toStage,status,postId]);
    await recordPostActivity(connection,{postId,actorUserId:session.userId,eventType:'stage_transition',summary:`${session.displayName} moveu a postagem de ${humanStage(from)} para ${humanStage(toStage)}.`,stageFrom:from,stageTo:toStage,entityType:revision?'revision':'post',entityId:revision?.id,metadata:reason?{reason}:undefined,correlationId});
    await connection.commit();
  }catch(e){await connection.rollback();throw e}finally{connection.release()}
  if(assignedToUserId)await assignPostToUser(session,postId,assignedToUserId,reason,toStage,correlationId);
  const recipients=await resolvePostRecipients(post.clientId,assignedToUserId||post.currentAssigneeId);
  void createNotificationEvent({actorUserId:session.userId,type:`post_${toStage}`,category:toStage.includes('aprov')?'approvals':toStage.includes('design')?'artwork':'posts',entityType:'post',entityId:postId,clientId:post.clientId,title:`Postagem em ${humanStage(toStage)}`,body:reason?reason.slice(0,300):`A postagem avançou para ${humanStage(toStage)}.`,route:`/?clientId=${encodeURIComponent(post.clientId)}&postId=${postId}`,recipientUserIds:recipients,dedupeKey:`post-stage:${postId}:${toStage}`}).catch(()=>{});
  return {success:true,stage:toStage,revision,correlationId};
}
export async function registerArtworkVersion(session:WorkflowSession,postId:number,mediaAssetIds:string[],notes?:string){
  if(!mediaAssetIds.length)throw Object.assign(new Error('Nenhuma mídia foi enviada.'),{status:422,code:'MEDIA_REQUIRED'});
  const connection=await db().getConnection();let versionNumber=0,versionId=0;
  try{await connection.beginTransaction();const [[post]]:any=await connection.query('SELECT * FROM posts WHERE id=? FOR UPDATE',[postId]);if(!post)throw Object.assign(new Error('Postagem não encontrada.'),{status:404,code:'POST_NOT_FOUND'});
    const [assets]:any=await connection.query(`SELECT id FROM media_assets WHERE id IN (?) AND ownerType='post' AND ownerId=? AND status='active'`,[mediaAssetIds,String(postId)]);if(assets.length!==new Set(mediaAssetIds).size)throw Object.assign(new Error('Uma ou mais mídias não pertencem à postagem.'),{status:403,code:'INVALID_MEDIA_ASSET'});
    const [[seq]]:any=await connection.query('SELECT COALESCE(MAX(versionNumber),0)+1 versionNumber,MAX(id) previousId FROM post_artwork_versions WHERE postId=? FOR UPDATE',[postId]);versionNumber=seq.versionNumber;
    if(seq.previousId)await connection.execute("UPDATE post_artwork_versions SET status='superseded' WHERE id=? AND status NOT IN ('approved','rejected')",[seq.previousId]);
    const [created]:any=await connection.execute('INSERT INTO post_artwork_versions(postId,versionNumber,uploadedByUserId,status,changeNotes,supersedesVersionId) VALUES(?,?,?,?,?,?)',[postId,versionNumber,session.userId,'uploaded',notes?.slice(0,1000)||null,seq.previousId||null]);versionId=created.insertId;
    for(const [position,assetId] of mediaAssetIds.entries())await connection.execute('INSERT INTO post_artwork_version_items(artworkVersionId,mediaAssetId,position) VALUES(?,?,?)',[versionId,assetId,position]);
    await connection.execute("UPDATE posts SET artworkCurrentVersion=?,workflowStatus='in_progress',actionAssigneeId=NULL,lastActivityAt=NOW(),workVersion=workVersion+1 WHERE id=?",[versionNumber,postId]);
    await recordPostActivity(connection,{postId,actorUserId:session.userId,eventType:'artwork_version_uploaded',entityType:'artwork_version',entityId:versionId,summary:`${session.displayName} enviou a versão ${versionNumber} da arte.`,metadata:notes?{notes}:undefined});await connection.commit();
  }catch(e){await connection.rollback();throw e}finally{connection.release()}
  return {id:versionId,versionNumber,status:'uploaded'};
}
export async function recordAutosaveActivity(input:{postId:number;actorUserId:string;actorName:string;fields:string[]}){
  const fields=[...new Set(input.fields)].filter(Boolean);if(!fields.length)return;
  const labels:Record<string,string>={head:'Head',subhead:'Subhead',caption:'legenda',objective:'objetivo',visualBriefing:'briefing visual',deadline:'prazo',dueDate:'prazo'};
  const readable=fields.map(x=>labels[x]||x).join(', ');const [recent]:any=await db().query("SELECT id,metadataJson FROM post_activity_events WHERE postId=? AND actorUserId=? AND eventType='copy_updated' AND createdAt>=DATE_SUB(NOW(),INTERVAL 10 MINUTE) ORDER BY id DESC LIMIT 1",[input.postId,input.actorUserId]);
  if(recent[0]){let old:any={};try{old=typeof recent[0].metadataJson==='string'?JSON.parse(recent[0].metadataJson):recent[0].metadataJson||{}}catch{}const merged=[...new Set([...(old.fields||[]),...fields])];await db().execute('UPDATE post_activity_events SET summary=?,metadataJson=?,createdAt=NOW() WHERE id=?',[`${input.actorName} atualizou ${merged.map(x=>labels[x]||x).join(', ')}.`,JSON.stringify({fields:merged}),recent[0].id]);}
  else await recordPostActivity(db(),{postId:input.postId,actorUserId:input.actorUserId,eventType:'copy_updated',summary:`${input.actorName} atualizou ${readable}.`,metadata:{fields}});
}
export function humanStage(stage:string){return ({briefing:'Briefing',copy:'Copy',aguardando_design:'Aguardando design',design:'Design',revisao_interna:'Revisão interna',aguardando_aprovacao:'Aguardando aprovação',alteracoes_solicitadas:'Alterações solicitadas',aprovado:'Aprovado',agendado:'Agendado',publicado:'Publicado',arquivado:'Arquivado',cancelado:'Cancelado'} as any)[stage]||stage;}
export function allowedTransitions(stage:PostStage){return TRANSITIONS[stage]||[];}
