import { publicHub } from "@/lib/client-hub";
import { hubJson, hubFailure } from "@/lib/client-hub-http";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try { return hubJson(await publicHub((await params).token)); }
  catch (error) { return hubFailure(error); }
}
