import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createExtraDemand,
  getClientAssignmentContext,
  getClientWorkUnits,
} from "@/lib/demand-service";
import type { CreateExtraDemandInput } from "@/lib/task-types";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const clientId = searchParams.get("clientId");

    // Contexto de atribuição estrutural do cliente
    if (action === "client_context" && clientId) {
      const context = await getClientAssignmentContext(clientId);
      if (!context) {
        return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
      }
      return NextResponse.json({ context });
    }

    // Consulta de demandas extras do cliente
    if (clientId) {
      const type = searchParams.get("type") || "extra_request";
      const items = await getClientWorkUnits(clientId, type);
      return NextResponse.json({ items });
    }

    return NextResponse.json({ error: "Parâmetros insuficientes." }, { status: 400 });
  } catch (error: any) {
    console.error("Erro no GET /api/demands:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // RBAC: Apenas admin ou social_media podem criar demandas
    if (user.role !== "admin" && user.role !== "social_media") {
      return NextResponse.json(
        { error: "Acesso negado: Somente administradores ou social media podem criar demandas." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateExtraDemandInput;

    const result = await createExtraDemand(user, body);

    return NextResponse.json({
      success: true,
      message: "Demanda criada com sucesso!",
      workUnit: result.workUnit,
      tasks: result.tasks,
    });
  } catch (error: any) {
    console.error("Erro no POST /api/demands:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
