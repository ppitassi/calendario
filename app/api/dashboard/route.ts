import {NextRequest,NextResponse} from 'next/server';import {getDbPool} from '../../../lib/db';import {notificationSession} from '../../../lib/notifications';
const ROLE_PIPELINE=new Set(['admin','gerente','atendimento','designer','estagiario','analista','socialmedia']);
export async function GET(req:NextRequest){const s=await notificationSession(req);if(!s)return NextResponse.json({error:'SessÃ£o expirada.'},{status:401});const db=getDbPool();const[[user]]:any=await db.query('SELECT role FROM users WHERE uid=? LIMIT 1',[s.uid]);if(!user)return NextResponse.json({error:'UsuÃ¡rio nÃ£o encontrado.'},{status:404});let canPipeline=ROLE_PIPELINE.has(user.role);const[[custom]]:any=await db.query('SELECT permissions FROM custom_roles WHERE id=? LIMIT 1',[user.role]);if(custom){try{const p=typeof custom.permissions==='string'?JSON.parse(custom.permissions):custom.permissions;if(Object.prototype.hasOwnProperty.call(p,'canViewProductionGallery'))canPipeline=p.canViewProductionGallery===true}catch{}}
 const[work]:any=await db.query(`SELECT p.id,p.clientId,p.title,p.head,p.currentStage,p.workflowStatus,p.dueDate,p.currentAssigneeId,p.actionAssigneeId,c.name clientName FROM posts p JOIN clients c ON c.id=p.clientId WHERE (p.currentAssigneeId=? OR p.actionAssigneeId=?) AND p.currentStage NOT IN ('publicado','arquivado','cancelado') ORDER BY (p.dueDate IS NOT NULL AND p.dueDate<NOW()) DESC,(p.workflowStatus='changes_requested') DESC,p.dueDate IS NULL,p.dueDate ASC LIMIT 12`,[s.uid,s.uid]);
  const [deadlineRows]: any = await db.query(`SELECT SUM(dueDate<CURRENT_DATE) overdue,SUM(DATE(dueDate)=CURRENT_DATE) today,SUM(DATE(dueDate)>CURRENT_DATE AND DATE(dueDate)<=DATE_ADD(CURRENT_DATE,INTERVAL 3 DAY)) nextThreeDays,SUM(dueDate IS NULL) withoutDue,SUM(workflowStatus='changes_requested') changesRequested FROM posts WHERE (currentAssigneeId=? OR actionAssigneeId=?) AND currentStage NOT IN ('publicado','arquivado','cancelado')`,[s.uid,s.uid]);
  const d = deadlineRows[0] || {};
  const [clients]: any = await db.query(`SELECT c.id,c.name,c.logoUrl,COUNT(DISTINCT p.id) pending,SUM(p.dueDate<NOW()) overdue,MIN(p.dueDate) nextDue FROM clients c JOIN posts p ON p.clientId=c.id WHERE (p.currentAssigneeId=? OR p.actionAssigneeId=?) AND p.currentStage NOT IN ('publicado','arquivado','cancelado') GROUP BY c.id,c.name,c.logoUrl ORDER BY SUM(p.dueDate<NOW()) DESC,MIN(p.dueDate) IS NULL,MIN(p.dueDate) ASC LIMIT 6`,[s.uid,s.uid]);
  const [activities]: any = await db.query(`SELECT e.id,e.postId,e.summary,e.eventType,e.createdAt,p.clientId,c.name clientName FROM post_activity_events e JOIN posts p ON p.id=e.postId LEFT JOIN clients c ON c.id=p.clientId WHERE (p.currentAssigneeId=? OR p.actionAssigneeId=? OR e.actorUserId=?) AND e.eventType NOT IN ('copy_updated') ORDER BY e.createdAt DESC LIMIT 8`,[s.uid,s.uid,s.uid]);
  let pipeline: null | any = null;
  if (canPipeline) {
    const [rows]: any = await db.query(`SELECT currentStage stage,COUNT(*) count FROM posts WHERE currentStage NOT IN ('arquivado','cancelado') GROUP BY currentStage`,[]);
    pipeline = rows;
  }
  return NextResponse.json({
    modules: {
      myWork: (work || []).map((x: any) => ({ ...x, isAction: x.actionAssigneeId === s.uid, isOverdue: Boolean(x.dueDate && new Date(x.dueDate) < new Date()) })),
      deadlines: {
        today: Number(d.today || 0),
        nextThreeDays: Number(d.nextThreeDays || 0),
        overdue: Number(d.overdue || 0),
        withoutDue: Number(d.withoutDue || 0),
        changesRequested: Number(d.changesRequested || 0)
      },
      recentActivities: activities || [],
      clients: clients || [],
      pipeline: pipeline || []
    },
    capabilities: { canViewProductionGallery: canPipeline },
    period: 'current_month'
  });
}
