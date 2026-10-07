import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserWorkQueue,
  getTeamWorkQueue,
  updateTaskStatus,
  updateWorkUnitStatus,
  assignTask,
  assignCalendarExecutor,
  changeTaskOwner,
  softDeleteTask,
  softDeleteWorkUnit,
  restoreTask,
  restoreWorkUnit,
  getTeamMembers,
  type TaskStatus,
} from "@/lib/work-units";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get("scope") as "me" | "team") || "me";
    const clientId = searchParams.get("clientId") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const type = searchParams.get("type") || undefined;
    // Em Meu Trabalho (scope === "me"), o filtro de responsável não se aplica
    const responsibleFilter =
      scope === "team" ? searchParams.get("responsibleFilter") || undefined : undefined;
    
    // Suporte a includeCompleted (default: false)
    const includeCompletedParam = searchParams.get("includeCompleted");
    const includeCompleted =
      includeCompletedParam !== null
        ? includeCompletedParam === "true"
        : searchParams.get("hideCompleted") === "false";

    let items;
    if (scope === "team") {
      // 15. Visão de equipe: Somente para roles autorizadas
      if (user.role !== "admin" && user.role !== "social_media") {
        return NextResponse.json(
          { error: "Acesso negado: visão de equipe reservada a administradores e social media." },
          { status: 403 }
        );
      }
      items = await getTeamWorkQueue({
        includeCompleted,
        clientId,
        status,
        search,
        type,
        responsibleFilter,
      });
    } else {
      // 13. Meu Trabalho: estritamente restrito ao usuário autenticado
      items = await getUserWorkQueue(user.id, {
        scope: "me",
        includeCompleted,
        clientId,
        status,
        search,
        type,
      });
    }

    const teamMembers = await getTeamMembers();

    return NextResponse.json({ items, teamMembers });
  } catch (error: any) {
    console.error("Erro ao buscar fila de trabalho:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, assigneeId, executorId, ownerId, kind = "workUnit" } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Parâmetro id é obrigatório." },
        { status: 400 }
      );
    }

    let success = false;

    // Mudança de Status
    if (status !== undefined) {
      if (kind === "workUnit") {
        success = await updateWorkUnitStatus(id, status as TaskStatus, user.id);
      } else {
        success = await updateTaskStatus(id, status as TaskStatus, user.id);
      }
    }

    // Atribuição de Executor do Calendário (executorId)
    if (executorId !== undefined && kind === "workUnit") {
      success = await assignCalendarExecutor({
        calendarId: id,
        executorId: executorId || null,
        actorId: user.id,
      });
    }

    // Atribuição de Executor de Tarefa ou Unidade (assigneeId)
    if (assigneeId !== undefined) {
      success = await assignTask({
        taskId: id,
        assigneeId: assigneeId || null,
        actorId: user.id,
        kind,
      });
    }

    // Mudança de Dono da Tarefa (ownerId)
    if (ownerId !== undefined) {
      success = await changeTaskOwner({
        taskId: id,
        ownerId,
        actorId: user.id,
        kind,
      });
    }

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error("Erro ao atualizar tarefa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    let kind = searchParams.get("kind") || "task";

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
        kind = body.kind || kind;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: "ID não fornecido." }, { status: 400 });
    }

    let success = false;
    if (kind === "workUnit") {
      success = await softDeleteWorkUnit(id, user.id);
    } else {
      success = await softDeleteTask(id, user.id);
    }

    return NextResponse.json({ success, id });
  } catch (error: any) {
    console.error("Erro ao excluir tarefa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { action, id, kind = "task" } = body;

    if (action === "restore" && id) {
      let success = false;
      if (kind === "workUnit") {
        success = await restoreWorkUnit(id, user.id);
      } else {
        success = await restoreTask(id, user.id);
      }
      return NextResponse.json({ success, restored: id });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error: any) {
    console.error("Erro na rota de tarefas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
