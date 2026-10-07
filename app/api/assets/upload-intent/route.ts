import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertCanViewAsset, ForbiddenError } from "@/lib/assets";
import { nextcloudStorage } from "@/lib/storage/nextcloud/provider";
import type { Asset } from "@/lib/task-types";
import type { AssetType } from "@/lib/storage/storage-provider";

const ASSET_TYPES: AssetType[] = ["image", "video", "document", "master", "other"];

/** createUploadIntent: auth → permissão → resolve destino → devolve alvo de upload direto. */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const b = await request.json();
    const clientId = String(b.clientId || "");
    const filename = String(b.filename || "").trim();
    const assetType = ASSET_TYPES.includes(b.assetType) ? (b.assetType as AssetType) : "other";
    if (!clientId || !filename) {
      return NextResponse.json({ error: "clientId e filename são obrigatórios." }, { status: 400 });
    }

    // Designer só envia para demandas/tarefas em que atua.
    if (user.role === "designer") {
      if (!b.workUnitId && !b.taskId) throw new ForbiddenError();
      await assertCanViewAsset(user, { workUnitId: b.workUnitId, taskId: b.taskId } as Asset);
    }

    const target = await nextcloudStorage.createUploadTarget({
      clientId,
      workUnitId: b.workUnitId || undefined,
      taskId: b.taskId || undefined,
      assetType,
      filename,
      mimeType: b.mimeType || undefined,
      sizeBytes: Number(b.sizeBytes) || undefined,
      userId: user.id,
    });
    return NextResponse.json({ target });
  } catch (error: any) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("POST /api/assets/upload-intent", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
