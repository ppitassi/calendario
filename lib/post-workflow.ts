import "server-only";
import {createHash} from "crypto";
import {NextRequest} from "next/server";
import {getDbPool} from "./db";

export type WorkflowSession={userId:string;role:string;displayName:string};
export async function workflowSession(req:NextRequest):Promise<WorkflowSession|null>{const token=req.cookies.get("cp_session")?.value;if(!token)return null;const[result]:any=await getDbPool().query(`SELECT u.id userId,LOWER(COALESCE(MAX(CASE WHEN ro.key_name='ADMIN' THEN 'admin' WHEN ro.key_name='MANAGEMENT' THEN 'gerente' WHEN ro.key_name='ATENDIMENTO' THEN 'atendimento' END),'user')) role,u.name displayName FROM user_sessions s JOIN users u ON u.id=s.user_id LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles ro ON ro.id=ur.role_id WHERE s.token_hash=? AND s.expires_at>NOW() AND s.revoked_at IS NULL AND u.active=TRUE GROUP BY u.id,u.name LIMIT 1`,[createHash("sha256").update(token).digest("hex")]);return result[0]||null;}
