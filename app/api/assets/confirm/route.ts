import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/assets";
import { confirmUpload } from "@/lib/storage/nextcloud/upload";

/** confirmUpload: stat no Nextcloud (fileId/size/MIME/etag) → INSERT assets. */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { intent } = await request.json();
    const asset = await confirmUpload(user, String(intent || ""));
    return NextResponse.json({ asset });
  } catch (error: any) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("POST /api/assets/confirm", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
