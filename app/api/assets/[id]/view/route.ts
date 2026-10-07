import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/assets";
import { getAssetPlaybackSource } from "@/lib/storage/nextcloud/playback";

/**
 * Autoriza e redireciona (302) para o Nextcloud. O binário NUNCA passa pela Vercel:
 * o browser faz o stream direto (Range/seek nativos de <img>/<video>).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { id } = await params;
    const source = await getAssetPlaybackSource(id, user);
    const res = NextResponse.redirect(source.url, 302);
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (error: any) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("GET /api/assets/:id/view", error);
    return NextResponse.json({ error: error.message }, { status: error.message?.includes("não encontrado") ? 404 : 500 });
  }
}
