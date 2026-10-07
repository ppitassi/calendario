import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getWorkUnitDetails,
  getActivityEvents,
  softDeleteTask,
  softDeleteWorkUnit,
  restoreTask,
  restoreWorkUnit,
} from "@/lib/work-units";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const resolvedParams = await params;
    const workUnitId = resolvedParams.id;

    if (!workUnitId) {
      return NextResponse.json({ error: "ID não fornecido." }, { status: 400 });
    }

    const details = await getWorkUnitDetails(workUnitId);
    if (!details) {
      return NextResponse.json({ error: "Unidade de trabalho não encontrada." }, { status: 404 });
    }

    const events = await getActivityEvents(workUnitId);

    return NextResponse.json({ details, events });
  } catch (error: any) {
    console.error("Erro ao buscar detalhes da unidade de trabalho:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") || "task";

    let success = false;
    if (kind === "workUnit") {
      success = await softDeleteWorkUnit(id, user.id);
    } else {
      success = await softDeleteTask(id, user.id);
    }

    return NextResponse.json({ success, id });
  } catch (error: any) {
    console.error("Erro ao excluir:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json().catch(() => ({}));
    const kind = body.kind || "task";

    let success = false;
    if (kind === "workUnit") {
      success = await restoreWorkUnit(id, user.id);
    } else {
      success = await restoreTask(id, user.id);
    }

    return NextResponse.json({ success, restored: id });
  } catch (error: any) {
    console.error("Erro ao restaurar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
