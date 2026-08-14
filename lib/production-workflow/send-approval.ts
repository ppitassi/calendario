import "server-only";
import type {WorkflowSession} from "../post-workflow";
import type {PlanningRef} from "./core";
import {sendPlanningToApproval as send} from "./operations";
export const sendPlanningToApproval=(session:WorkflowSession,ref:PlanningRef)=>send(session,ref);
